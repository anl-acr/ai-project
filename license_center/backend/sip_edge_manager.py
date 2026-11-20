import asyncio
import ipaddress
import os
import re
import shutil
import subprocess
import time
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from license_center.backend.models import ClientServer

WG_INTERFACE = "wg0"
WG_CONF_PATH = "/etc/wireguard/wg0.conf"
WG_HUB_PUBKEY_PATH = "/etc/wireguard/wg0_public.key"
WG_HUB_PRIVKEY_PATH = "/etc/wireguard/wg0.key"
WG_HUB_TUNNEL_IP = "10.200.0.1"
WG_SUBNET_CIDR = "10.200.0.0/16"
WG_LISTEN_PORT = 51820

KAMAILIO_ROUTES_MAP = "/etc/kamailio/nornia_routes.map"
HUB_PUBLIC_DOMAIN = os.getenv("NORNIA_HUB_DOMAIN", "connect.nornia.com.tr").strip() or "connect.nornia.com.tr"
SIP_BASE_DOMAIN = os.getenv("NORNIA_SIP_BASE_DOMAIN", "nornia.com.tr").strip() or "nornia.com.tr"

_WG_PUBKEY_RE = re.compile(r"^[A-Za-z0-9+/]{42,44}={0,2}$")


def _run_cmd(args: List[str], timeout: float = 5.0) -> Dict[str, Any]:
    try:
        proc = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
        return {
            "ok": proc.returncode == 0,
            "stdout": (proc.stdout or "").strip(),
            "stderr": (proc.stderr or "").strip(),
        }
    except Exception as ex:
        return {"ok": False, "stdout": "", "stderr": str(ex)}


def is_valid_wg_pubkey(key: Optional[str]) -> bool:
    if not key or not isinstance(key, str):
        return False
    return bool(_WG_PUBKEY_RE.match(key.strip()))


def get_hub_lan_ip() -> str:
    """Detects Hub's primary local interface IPv4 (e.g. 172.20.5.251) so same-LAN PBXs avoid Hairpin NAT."""
    ip_bin = shutil.which("ip")
    if ip_bin:
        r = _run_cmd([ip_bin, "-4", "route", "get", "1.1.1.1"], timeout=2.0)
        if r["ok"] and r["stdout"]:
            parts = r["stdout"].split()
            for idx, tok in enumerate(parts):
                if tok == "src" and idx + 1 < len(parts):
                    cand = parts[idx + 1].strip()
                    if cand and not cand.startswith("127."):
                        return cand
    return ""


def get_hub_wg_public_key() -> str:
    if os.path.isfile(WG_HUB_PUBKEY_PATH):
        try:
            with open(WG_HUB_PUBKEY_PATH, "r", encoding="utf-8") as f:
                val = f.read().strip()
                if is_valid_wg_pubkey(val):
                    return val
        except Exception:
            pass
    wg_bin = shutil.which("wg")
    if wg_bin:
        res = _run_cmd([wg_bin, "show", WG_INTERFACE, "public-key"])
        if res["ok"] and is_valid_wg_pubkey(res["stdout"]):
            return res["stdout"]
    return ""


def _read_live_wg_peers_sync() -> Dict[str, Dict[str, Any]]:
    """Parses `wg show wg0 dump` to get live handshake age and rx/tx byte counters per peer pubkey."""
    peers: Dict[str, Dict[str, Any]] = {}
    wg_bin = shutil.which("wg")
    if not wg_bin:
        return peers
    res = _run_cmd([wg_bin, "show", WG_INTERFACE, "dump"])
    if not res["ok"] or not res["stdout"]:
        return peers
    now_ts = int(time.time())
    lines = res["stdout"].splitlines()
    for ln in lines[1:]:
        parts = ln.split("\t")
        if len(parts) < 7:
            continue
        pubkey = parts[0].strip()
        endpoint = parts[2].strip()
        allowed_ips = parts[3].strip()
        try:
            last_hs = int(parts[4] or 0)
        except Exception:
            last_hs = 0
        try:
            rx_b = int(parts[5] or 0)
            tx_b = int(parts[6] or 0)
        except Exception:
            rx_b, tx_b = 0, 0
        hs_age = (now_ts - last_hs) if last_hs > 0 else None
        peers[pubkey] = {
            "pubkey": pubkey,
            "endpoint": endpoint if endpoint != "(none)" else "",
            "allowed_ips": allowed_ips,
            "last_handshake_sec": hs_age,
            "connected": hs_age is not None and hs_age <= 180,
            "rx_mb": round(rx_b / (1024.0 * 1024.0), 2),
            "tx_mb": round(tx_b / (1024.0 * 1024.0), 2),
        }
    return peers


def _check_systemd_active_sync(service_names: List[str]) -> bool:
    sc = shutil.which("systemctl")
    if not sc:
        return False
    for name in service_names:
        r = _run_cmd([sc, "is-active", name], timeout=2.0)
        if r["ok"] and r["stdout"].strip() == "active":
            return True
    return False


def get_sip_edge_live_status_sync() -> Dict[str, Any]:
    """Returns live Hub status of WireGuard (wg0), Kamailio (5060/5061), and RTPEngine (20000-40000)."""
    wg_bin = shutil.which("wg")
    hub_pubkey = get_hub_wg_public_key()
    wg_active = False
    if wg_bin:
        r_wg = _run_cmd([wg_bin, "show", WG_INTERFACE], timeout=2.0)
        wg_active = bool(r_wg["ok"] and r_wg["stdout"])
    kam_active = _check_systemd_active_sync(["kamailio"])
    rtp_active = _check_systemd_active_sync(["rtpengine", "ngcp-rtpengine-daemon", "rtpengine-daemon"])
    peers_map = _read_live_wg_peers_sync() if wg_active else {}
    return {
        "installed": bool(wg_bin and hub_pubkey),
        "wg_active": wg_active,
        "kamailio_active": kam_active,
        "rtpengine_active": rtp_active,
        "ready": bool(wg_active and kam_active and rtp_active and hub_pubkey),
        "hub_public_key": hub_pubkey,
        "hub_endpoint": f"{HUB_PUBLIC_DOMAIN}:{WG_LISTEN_PORT}",
        "hub_tunnel_ip": WG_HUB_TUNNEL_IP,
        "sip_domain_base": SIP_BASE_DOMAIN,
        "peers_count": len(peers_map),
        "active_peers_count": sum(1 for p in peers_map.values() if p.get("connected")),
        "peers_by_pubkey": peers_map,
    }


def _apply_wg_peer_sync(pubkey: str, tunnel_ip: str, remove: bool = False):
    wg_bin = shutil.which("wg")
    if not wg_bin or not is_valid_wg_pubkey(pubkey):
        return
    if remove:
        _run_cmd([wg_bin, "set", WG_INTERFACE, "peer", pubkey, "remove"])
    else:
        _run_cmd([wg_bin, "set", WG_INTERFACE, "peer", pubkey, "allowed-ips", f"{tunnel_ip}/32"])


def _persist_wg0_and_kamailio_sync(active_peers: List[Dict[str, str]]):
    """
    Persists all active PBX peers to /etc/wireguard/wg0.conf (preserving Hub [Interface] section)
    and updates /etc/kamailio/nornia_routes.map followed by zero-downtime `kamcmd htable.reload nornia_routes`.
    """
    # 1. Persist WireGuard wg0.conf if Hub private key exists
    if os.path.isfile(WG_HUB_PRIVKEY_PATH) and os.path.isdir(os.path.dirname(WG_CONF_PATH)):
        try:
            with open(WG_HUB_PRIVKEY_PATH, "r", encoding="utf-8") as f_priv:
                hub_priv = f_priv.read().strip()
            if hub_priv:
                lines = [
                    "# Auto-managed by Nornia Connect Hub (SIP/RTP Edge v2)",
                    "[Interface]",
                    f"Address = {WG_HUB_TUNNEL_IP}/16",
                    f"ListenPort = {WG_LISTEN_PORT}",
                    f"PrivateKey = {hub_priv}",
                    "# Strict Client-to-Client Isolation: PBX peers can ONLY reach Hub (10.200.0.1)",
                    f"PostUp = iptables -C FORWARD -i {WG_INTERFACE} -o {WG_INTERFACE} -j DROP 2>/dev/null || iptables -I FORWARD -i {WG_INTERFACE} -o {WG_INTERFACE} -j DROP",
                    f"PostDown = iptables -D FORWARD -i {WG_INTERFACE} -o {WG_INTERFACE} -j DROP 2>/dev/null || true",
                    "",
                ]
                for p in active_peers:
                    pk = p.get("wg_public_key") or ""
                    ip = p.get("wg_tunnel_ip") or ""
                    sub = p.get("subdomain") or ""
                    if is_valid_wg_pubkey(pk) and ip:
                        lines.append(f"# PBX: {sub}.{SIP_BASE_DOMAIN}")
                        lines.append("[Peer]")
                        lines.append(f"PublicKey = {pk}")
                        lines.append(f"AllowedIPs = {ip}/32")
                        lines.append("")
                tmp_wg = f"{WG_CONF_PATH}.tmp"
                with open(tmp_wg, "w", encoding="utf-8") as fw:
                    fw.write("\n".join(lines))
                os.chmod(tmp_wg, 0o600)
                os.replace(tmp_wg, WG_CONF_PATH)
        except Exception as ex_wg:
            print(f"[SIP Edge] wg0.conf persist warning: {ex_wg}")

    # 2. Write Kamailio domain -> PBX WireGuard IP map and reload htable with zero downtime
    kam_dir = os.path.dirname(KAMAILIO_ROUTES_MAP)
    if os.path.isdir(kam_dir):
        try:
            map_lines = [
                "# Auto-managed by Nornia Connect Hub: domain => pbx_wg_ip:5060",
            ]
            for p in active_peers:
                sub = (p.get("subdomain") or "").strip().lower()
                ip = (p.get("wg_tunnel_ip") or "").strip()
                if sub and ip:
                    map_lines.append(f"{sub}.{SIP_BASE_DOMAIN} {ip}:5060")
            tmp_map = f"{KAMAILIO_ROUTES_MAP}.tmp"
            with open(tmp_map, "w", encoding="utf-8") as fm:
                fm.write("\n".join(map_lines) + "\n")
            os.replace(tmp_map, KAMAILIO_ROUTES_MAP)

            # Sync Kamailio in-memory htable (`nornia_routes`) dynamically
            kamcmd_bin = shutil.which("kamcmd") or shutil.which("kamctl")
            if kamcmd_bin and os.path.basename(kamcmd_bin) == "kamcmd":
                # Flush & re-populate htable cleanly via kamcmd (works without db_text reload caveats)
                _run_cmd([kamcmd_bin, "htable.flush", "nornia_routes"], timeout=3.0)
                for p in active_peers:
                    sub = (p.get("subdomain") or "").strip().lower()
                    ip = (p.get("wg_tunnel_ip") or "").strip()
                    if sub and ip:
                        _run_cmd(
                            [kamcmd_bin, "htable.sets", "nornia_routes", f"{sub}.{SIP_BASE_DOMAIN}", f"sip:{ip}:5060"],
                            timeout=3.0,
                        )
        except Exception as ex_kam:
            print(f"[SIP Edge] Kamailio routes reload warning: {ex_kam}")


async def _allocate_next_wg_ip(db: AsyncSession) -> str:
    res = await db.execute(select(ClientServer.wg_tunnel_ip))
    used = {str(x).strip() for (x,) in res.all() if x}
    used.add(WG_HUB_TUNNEL_IP)
    net = ipaddress.IPv4Network(WG_SUBNET_CIDR)
    for host_ip in net.hosts():
        s_ip = str(host_ip)
        if s_ip not in used and not s_ip.endswith(".0") and not s_ip.endswith(".255"):
            return s_ip
    raise RuntimeError("WireGuard 10.200.0.0/16 IP havuzu dolu.")


async def sync_all_sip_edge_peers_from_db(db: AsyncSession):
    """Syncs all active, non-suspended, sip_edge_enabled clients to wg0 and Kamailio."""
    res = await db.execute(select(ClientServer))
    all_clients = res.scalars().all()
    active_peers: List[Dict[str, str]] = []
    for c in all_clients:
        if c.status == "suspended":
            continue
        if c.sip_edge_enabled is False:
            continue
        if c.wg_public_key and c.wg_tunnel_ip and c.connect_subdomain:
            active_peers.append({
                "subdomain": c.connect_subdomain.strip().lower(),
                "wg_public_key": c.wg_public_key.strip(),
                "wg_tunnel_ip": c.wg_tunnel_ip.strip(),
            })
            await asyncio.to_thread(_apply_wg_peer_sync, c.wg_public_key.strip(), c.wg_tunnel_ip.strip(), False)
    await asyncio.to_thread(_persist_wg0_and_kamailio_sync, active_peers)


async def provision_pbx_sip_edge(
    db: AsyncSession,
    subdomain: str,
    hardware_id: str,
    wg_public_key: str,
) -> Dict[str, Any]:
    """
    Auto-provisions a PBX's WireGuard peer IP and Kamailio SIP route when it connects via 443/WSS.
    Returns the `sip_edge` configuration dictionary to send back inside `RAS_WELCOME`.
    """
    sub_clean = (subdomain or "").strip().lower()
    hw_clean = (hardware_id or "").strip().upper()
    pk_clean = (wg_public_key or "").strip()

    hub_pubkey = get_hub_wg_public_key()
    if not hub_pubkey:
        return {"enabled": False, "reason": "Hub sunucusunda SIP Edge (WireGuard) henüz kurulmamış."}
    if not is_valid_wg_pubkey(pk_clean):
        return {"enabled": False, "reason": "Santralden geçerli WireGuard public key gelmedi."}

    res = await db.execute(
        select(ClientServer).where(ClientServer.connect_subdomain == sub_clean)
    )
    client = res.scalars().first()
    if not client and hw_clean:
        res2 = await db.execute(
            select(ClientServer).where(ClientServer.hardware_id == hw_clean)
        )
        client = res2.scalars().first()
    if not client:
        return {"enabled": False, "reason": "Eşleşen müşteri kaydı bulunamadı."}

    if client.status == "suspended" or client.sip_edge_enabled is False:
        if client.wg_public_key:
            await asyncio.to_thread(_apply_wg_peer_sync, client.wg_public_key, "", True)
        await sync_all_sip_edge_peers_from_db(db)
        return {"enabled": False, "reason": "Müşteri askıda veya SIP Edge kapalı."}

    old_pubkey = (client.wg_public_key or "").strip()
    if old_pubkey and old_pubkey != pk_clean:
        await asyncio.to_thread(_apply_wg_peer_sync, old_pubkey, "", True)

    if not client.wg_tunnel_ip:
        client.wg_tunnel_ip = await _allocate_next_wg_ip(db)
    client.wg_public_key = pk_clean
    await db.commit()

    await asyncio.to_thread(_apply_wg_peer_sync, pk_clean, client.wg_tunnel_ip, False)
    await sync_all_sip_edge_peers_from_db(db)

    hub_lan_ip = get_hub_lan_ip()
    return {
        "enabled": True,
        "hub_public_key": hub_pubkey,
        "hub_endpoint": f"{HUB_PUBLIC_DOMAIN}:{WG_LISTEN_PORT}",
        "hub_lan_ip": hub_lan_ip,
        "hub_lan_endpoint": f"{hub_lan_ip}:{WG_LISTEN_PORT}" if hub_lan_ip else "",
        "hub_tunnel_ip": WG_HUB_TUNNEL_IP,
        "pbx_tunnel_ip": client.wg_tunnel_ip,
        "pbx_tunnel_cidr": f"{client.wg_tunnel_ip}/16",
        "sip_domain": f"{sub_clean}.{SIP_BASE_DOMAIN}",
        "sip_port": 5060,
        "sip_tls_port": 5061,
    }


async def revoke_pbx_sip_edge(db: AsyncSession, wg_public_key: Optional[str] = None):
    """Immediately revokes a suspended/deleted PBX peer from wg0 and refreshes Kamailio routes."""
    if wg_public_key and is_valid_wg_pubkey(wg_public_key):
        await asyncio.to_thread(_apply_wg_peer_sync, wg_public_key.strip(), "", True)
    await sync_all_sip_edge_peers_from_db(db)
