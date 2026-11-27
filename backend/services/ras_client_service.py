import asyncio
import base64
import datetime
import inspect
import json
import os
import shutil
import socket
import ssl
import subprocess
import time
import urllib.parse
from typing import Any, Dict, List, Optional

import httpx
import websockets
from fastapi import APIRouter, Body, HTTPException, Request

from backend.services.hardware_info import get_system_hardware_fingerprint as get_hardware_fingerprint
from backend.scripts.network_recovery import get_live_interfaces

ras_client_router = APIRouter()

DEFAULT_RAS_CONFIG: Dict[str, Any] = {
    "enabled": False,
    "hub_url": "",
    "subdomain": "merkez",
    "subdomain_locked": False,
    "locked_subdomain": "",
    "secret_token": "",
    "remote_ssh_enabled": True,
    "central_ssh_managed": True,
    "emergency_ssh_override": False,
    "turn_enabled": True,
    "turn_server": "",
    "turn_username": "nornia",
    "turn_password": "nornia_turn_secret_2026",
    "auto_reconnect": True,
}

# Live runtime state of the RAS Tunnel Client
RAS_RUNTIME_STATE: Dict[str, Any] = {
    "status": "disabled",  # "disabled" | "connecting" | "connected" | "error"
    "connected": False,
    "latency_ms": None,
    "last_connected_at": None,
    "last_ping_at": None,
    "last_error": "",
    "public_ras_url": "",
    "mobile_ras_url": "",
    "wss_sip_url": "",
    "active_streams": 0,
    "bytes_tx": 0,
    "bytes_rx": 0,
    "reconnect_count": 0,
    "sip_edge": {
        "enabled": False,
        "active": False,
        "wg_installed": False,
        "wg_active": False,
        "pbx_tunnel_ip": "",
        "hub_endpoint": "",
        "endpoint_mode": "",
        "sip_domain": "",
        "sip_port": 5060,
        "sip_tls_port": 5061,
        "last_error": "",
    },
}

_PBX_WG_IFACE = "wg-nornia"
_PBX_WG_DIR = "/etc/wireguard"
_PBX_WG_PRIV_PATH = "/etc/wireguard/nornia_wg.key"
_PBX_WG_PUB_PATH = "/etc/wireguard/nornia_wg_public.key"
_PBX_WG_CONF_PATH = "/etc/wireguard/wg-nornia.conf"


def ensure_pbx_wg_keypair_sync() -> str:
    """
    Ensures a persistent WireGuard keypair exists on this PBX when `wg` is installed.
    Returns the Base64 public key string (or empty string if WireGuard is not installed).
    """
    wg_bin = shutil.which("wg")
    if not wg_bin:
        RAS_RUNTIME_STATE["sip_edge"]["wg_installed"] = False
        return ""
    RAS_RUNTIME_STATE["sip_edge"]["wg_installed"] = True
    try:
        os.makedirs(_PBX_WG_DIR, mode=0o700, exist_ok=True)
        if os.path.isfile(_PBX_WG_PRIV_PATH) and os.path.isfile(_PBX_WG_PUB_PATH):
            with open(_PBX_WG_PUB_PATH, "r", encoding="utf-8") as fp:
                pub = fp.read().strip()
                if len(pub) >= 40:
                    return pub
        gen_priv = subprocess.run([wg_bin, "genkey"], capture_output=True, text=True, timeout=4.0)
        if gen_priv.returncode != 0 or not gen_priv.stdout.strip():
            return ""
        priv_val = gen_priv.stdout.strip()
        gen_pub = subprocess.run([wg_bin, "pubkey"], input=priv_val + "\n", capture_output=True, text=True, timeout=4.0)
        if gen_pub.returncode != 0 or not gen_pub.stdout.strip():
            return ""
        pub_val = gen_pub.stdout.strip()
        with open(_PBX_WG_PRIV_PATH, "w", encoding="utf-8") as f_pr:
            f_pr.write(priv_val + "\n")
        os.chmod(_PBX_WG_PRIV_PATH, 0o600)
        with open(_PBX_WG_PUB_PATH, "w", encoding="utf-8") as f_pu:
            f_pu.write(pub_val + "\n")
        os.chmod(_PBX_WG_PUB_PATH, 0o644)
        return pub_val
    except Exception as ex_wg:
        print(f"[Nornia SIP Edge] PBX WireGuard keygen warning: {ex_wg}")
        return ""


def _select_best_wg_endpoint(hub_ep: str, hub_lan_ip: str, hub_lan_ep: str) -> tuple[str, str]:
    """
    If this PBX shares the exact same local LAN subnet as the Hub (e.g. both on 172.20.5.0/24
    in the same datacenter/office), use the Hub's LAN endpoint directly to avoid UDP Hairpin NAT.
    Otherwise use the public Hub endpoint (connect.nornia.com.tr:51820).
    """
    if hub_lan_ip and hub_lan_ep:
        try:
            import ipaddress
            hub_addr = ipaddress.IPv4Address(hub_lan_ip)
            ip_bin = shutil.which("ip")
            if ip_bin:
                r = subprocess.run([ip_bin, "-4", "-o", "addr", "show"], capture_output=True, text=True, timeout=2.0)
                if r.returncode == 0 and r.stdout:
                    for ln in r.stdout.splitlines():
                        parts = ln.split()
                        if "inet" in parts:
                            cidr = parts[parts.index("inet") + 1]
                            if "/" in cidr and not cidr.startswith("127.") and not cidr.startswith("10.200."):
                                try:
                                    iface_net = ipaddress.IPv4Interface(cidr).network
                                    if hub_addr in iface_net and str(ipaddress.IPv4Interface(cidr).ip) != hub_lan_ip:
                                        return hub_lan_ep, "lan"
                                except Exception:
                                    pass
        except Exception:
            pass
    return hub_ep, "wan"


def apply_pbx_sip_edge_wireguard_sync(sip_edge_cfg: Dict[str, Any]):
    """
    Auto-configures and brings up `/etc/wireguard/wg-nornia.conf` using Hub-provisioned parameters.
    Strictly routes ONLY `AllowedIPs = 10.200.0.1/32` (Hub Kamailio/RTPEngine) so PBX default gateway
    and operator /30 VLAN policy routes are NEVER affected.
    """
    if not isinstance(sip_edge_cfg, dict) or not sip_edge_cfg.get("enabled"):
        RAS_RUNTIME_STATE["sip_edge"]["enabled"] = False
        RAS_RUNTIME_STATE["sip_edge"]["active"] = False
        RAS_RUNTIME_STATE["sip_edge"]["wg_active"] = False
        RAS_RUNTIME_STATE["sip_edge"]["last_error"] = str((sip_edge_cfg or {}).get("reason") or "")
        return

    hub_pub = str(sip_edge_cfg.get("hub_public_key") or "").strip()
    hub_ep_raw = str(sip_edge_cfg.get("hub_endpoint") or "").strip()
    hub_lan_ip = str(sip_edge_cfg.get("hub_lan_ip") or "").strip()
    hub_lan_ep = str(sip_edge_cfg.get("hub_lan_endpoint") or "").strip()
    hub_ep, ep_mode = _select_best_wg_endpoint(hub_ep_raw, hub_lan_ip, hub_lan_ep)
    pbx_cidr = str(sip_edge_cfg.get("pbx_tunnel_cidr") or "").strip()
    pbx_ip = str(sip_edge_cfg.get("pbx_tunnel_ip") or "").strip()
    hub_ip = str(sip_edge_cfg.get("hub_tunnel_ip") or "10.200.0.1").strip()
    sip_dom = str(sip_edge_cfg.get("sip_domain") or "").strip()

    wg_bin = shutil.which("wg")
    wg_quick_bin = shutil.which("wg-quick")
    RAS_RUNTIME_STATE["sip_edge"].update({
        "enabled": True,
        "wg_installed": bool(wg_bin and wg_quick_bin),
        "pbx_tunnel_ip": pbx_ip,
        "hub_endpoint": hub_ep,
        "endpoint_mode": ep_mode,
        "sip_domain": sip_dom,
        "sip_port": int(sip_edge_cfg.get("sip_port") or 5060),
        "sip_tls_port": int(sip_edge_cfg.get("sip_tls_port") or 5061),
    })

    if not (wg_bin and wg_quick_bin and hub_pub and hub_ep and pbx_cidr and os.path.isfile(_PBX_WG_PRIV_PATH)):
        RAS_RUNTIME_STATE["sip_edge"]["active"] = False
        RAS_RUNTIME_STATE["sip_edge"]["wg_active"] = False
        if not wg_bin:
            RAS_RUNTIME_STATE["sip_edge"]["last_error"] = "apt install -y wireguard"
        return

    try:
        with open(_PBX_WG_PRIV_PATH, "r", encoding="utf-8") as fp:
            pbx_priv = fp.read().strip()
        if not pbx_priv:
            return

        conf_text = "\n".join([
            "# Auto-managed by Nornia Connect SIP/RTP Edge v2",
            "[Interface]",
            f"Address = {pbx_cidr}",
            f"PrivateKey = {pbx_priv}",
            "MTU = 1380",
            "",
            "[Peer]",
            f"PublicKey = {hub_pub}",
            f"Endpoint = {hub_ep}",
            f"AllowedIPs = {hub_ip}/32",
            "PersistentKeepalive = 25",
            "",
        ])
        need_write = True
        if os.path.isfile(_PBX_WG_CONF_PATH):
            try:
                with open(_PBX_WG_CONF_PATH, "r", encoding="utf-8") as fold:
                    if fold.read() == conf_text:
                        need_write = False
            except Exception:
                pass
        if need_write:
            with open(_PBX_WG_CONF_PATH, "w", encoding="utf-8") as fw:
                fw.write(conf_text)
            os.chmod(_PBX_WG_CONF_PATH, 0o600)

        chk = subprocess.run([wg_bin, "show", _PBX_WG_IFACE], capture_output=True, text=True, timeout=3.0)
        if chk.returncode != 0:
            up_res = subprocess.run([wg_quick_bin, "up", _PBX_WG_IFACE], capture_output=True, text=True, timeout=10.0)
            is_ok = (up_res.returncode == 0)
            RAS_RUNTIME_STATE["sip_edge"]["wg_active"] = is_ok
            RAS_RUNTIME_STATE["sip_edge"]["active"] = is_ok
            RAS_RUNTIME_STATE["sip_edge"]["last_error"] = "" if is_ok else (up_res.stderr or "").strip()
            if is_ok:
                print(f"[Nornia SIP Edge] WireGuard tüneli aktif ({ep_mode.upper()}): {_PBX_WG_IFACE} ({pbx_ip} <-> {hub_ip} via {hub_ep}) | SIP: {sip_dom}:5060")
            else:
                print(f"[Nornia SIP Edge] wg-quick up warning: {up_res.stderr}")
        else:
            if need_write:
                subprocess.run([wg_quick_bin, "down", _PBX_WG_IFACE], capture_output=True, text=True, timeout=6.0)
                up2 = subprocess.run([wg_quick_bin, "up", _PBX_WG_IFACE], capture_output=True, text=True, timeout=10.0)
                is_ok2 = (up2.returncode == 0)
                RAS_RUNTIME_STATE["sip_edge"]["wg_active"] = is_ok2
                RAS_RUNTIME_STATE["sip_edge"]["active"] = is_ok2
                RAS_RUNTIME_STATE["sip_edge"]["last_error"] = "" if is_ok2 else (up2.stderr or "").strip()
            else:
                RAS_RUNTIME_STATE["sip_edge"]["wg_active"] = True
                RAS_RUNTIME_STATE["sip_edge"]["active"] = True
                RAS_RUNTIME_STATE["sip_edge"]["last_error"] = ""
    except Exception as ex_apply:
        RAS_RUNTIME_STATE["sip_edge"]["last_error"] = str(ex_apply)
        print(f"[Nornia SIP Edge] Apply WireGuard error: {ex_apply}")

_ras_worker_task: Optional[asyncio.Task] = None
_ras_reconnect_event: Optional[asyncio.Event] = None
_active_ws_streams: Dict[str, asyncio.Task] = {}
_active_ws_conns: Dict[str, Any] = {}
_active_tcp_writers: Dict[str, asyncio.StreamWriter] = {}
_active_web_ssh_sessions: Dict[str, Dict[str, Any]] = {}


def is_ssh_currently_allowed(cfg: Optional[Dict[str, Any]] = None) -> bool:
    c = cfg or get_ras_config()
    if bool(c.get("emergency_ssh_override", False)):
        return True
    return bool(c.get("remote_ssh_enabled", True))


def _close_all_web_ssh_sessions():
    import signal
    for sid, sess in list(_active_web_ssh_sessions.items()):
        _active_web_ssh_sessions.pop(sid, None)
        proc = sess.get("proc")
        master_fd = sess.get("master_fd")
        if proc and proc.poll() is None:
            try:
                os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
            except Exception:
                try:
                    proc.terminate()
                except Exception:
                    pass
        if master_fd is not None:
            try:
                os.close(master_fd)
            except Exception:
                pass
    for tid, writer in list(_active_tcp_writers.items()):
        _active_tcp_writers.pop(tid, None)
        try:
            writer.close()
        except Exception:
            pass


def _sync_system_sshd_state(allow_ssh: bool):
    """Starts or stops the local Linux ssh/sshd daemon when controlled from Central License Server."""
    if os.uname().sysname.lower() != "linux":
        return
    try:
        if allow_ssh:
            subprocess.run(
                ["bash", "-c", "sudo systemctl start ssh 2>/dev/null || sudo systemctl start sshd 2>/dev/null || true"],
                capture_output=True,
                timeout=4.0,
                check=False,
            )
        else:
            subprocess.run(
                ["bash", "-c", "sudo systemctl stop ssh 2>/dev/null; sudo systemctl stop sshd 2>/dev/null || true"],
                capture_output=True,
                timeout=4.0,
                check=False,
            )
    except Exception:
        pass


def apply_central_ssh_control(enabled: bool):
    """Applies Central License Server's SSH enable/disable state to this PBX."""
    try:
        from backend.main import save_settings, settings_db
        rc = get_ras_config()
        new_state = bool(enabled)
        old_state = bool(rc.get("remote_ssh_enabled", True))
        rc["remote_ssh_enabled"] = new_state
        rc["central_ssh_managed"] = True
        if new_state and rc.get("emergency_ssh_override"):
            # Central server re-opened SSH, clear emergency override flag
            rc["emergency_ssh_override"] = False
        if old_state != new_state or not settings_db.get("ras_config", {}).get("central_ssh_managed"):
            settings_db["ras_config"] = rc
            save_settings(settings_db)

        effective_allow = is_ssh_currently_allowed(rc)
        if not effective_allow:
            _close_all_web_ssh_sessions()
        if old_state != new_state:
            _sync_system_sshd_state(effective_allow)
    except Exception as e:
        print(f"[Nornia RAS] Central SSH control sync error: {e}")


def ensure_emergency_ssh_cli_installed():
    """Installs /usr/local/bin/nornia-emergency-ssh for hypervisor/virtualization console backdoor recovery."""
    if os.uname().sysname.lower() != "linux":
        return
    cli_path = "/usr/local/bin/nornia-emergency-ssh"
    script_content = """#!/bin/bash
# Nornia Santral — Sanallastirma Konsolu (VMware / Proxmox / KVM) Acil Durum SSH Arka Kapisi
ACTION="${1:-on}"
python3 /opt/ai-project/backend/scripts/network_recovery.py --emergency-ssh "$ACTION"
"""
    try:
        if not os.path.exists(cli_path):
            with open(cli_path, "w", encoding="utf-8") as f:
                f.write(script_content)
            os.chmod(cli_path, 0o755)
    except Exception:
        pass


def get_ras_config() -> Dict[str, Any]:
    from backend.main import settings_db
    saved = settings_db.get("ras_config")
    if not isinstance(saved, dict):
        saved = {}
    merged = {**DEFAULT_RAS_CONFIG, **saved}
    if not saved.get("subdomain"):
        fqdn_cfg = settings_db.get("fqdn")
        if isinstance(fqdn_cfg, dict) and fqdn_cfg.get("subdomain"):
            merged["subdomain"] = str(fqdn_cfg.get("subdomain")).strip().lower()
    if not merged.get("secret_token"):
        lic = settings_db.get("license") or {}
        if isinstance(lic, dict) and lic.get("license_key"):
            merged["secret_token"] = str(lic.get("license_key")).strip()
        else:
            t_list = settings_db.get("tenants")
            if isinstance(t_list, list) and t_list and isinstance(t_list[0], dict) and t_list[0].get("license_key"):
                merged["secret_token"] = str(t_list[0].get("license_key")).strip()
    return merged


def save_ras_config(updated: Dict[str, Any], persist: bool = True, reconnect: bool = True) -> Dict[str, Any]:
    """Saves Nornia Connect (RAS) config into settings_db, syncs TURN/RTP, and triggers tunnel reconnect."""
    from backend.main import save_settings, settings_db
    current = get_ras_config()
    merged = {**DEFAULT_RAS_CONFIG, **current, **(updated if isinstance(updated, dict) else {})}
    if merged.get("subdomain"):
        merged["subdomain"] = str(merged["subdomain"]).strip().lower()
    settings_db["ras_config"] = merged
    if persist:
        save_settings(settings_db)
    try:
        sync_asterisk_rtp_turn_config(merged)
    except Exception:
        pass
    if reconnect:
        try:
            trigger_ras_reconnect()
        except Exception:
            pass
    return merged


def build_ras_ice_servers(ras_cfg: Optional[Dict[str, Any]] = None, fallback_host: str = "") -> List[Dict[str, Any]]:
    cfg = ras_cfg or get_ras_config()
    ice_servers: List[Dict[str, Any]] = [
        {"urls": ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"]}
    ]
    has_wg_edge = os.path.isfile(_PBX_WG_CONF_PATH)
    if not ((cfg.get("enabled") and cfg.get("turn_enabled", True)) or has_wg_edge):
        return ice_servers

    turn_srv = str(cfg.get("turn_server") or "").strip()
    if not turn_srv and cfg.get("hub_url"):
        try:
            parsed = urllib.parse.urlparse(str(cfg.get("hub_url")).strip())
            if parsed.hostname:
                turn_srv = f"{parsed.hostname}:3478"
        except Exception:
            pass
    if not turn_srv and fallback_host:
        clean_fb = str(fallback_host).split(":")[0].strip()
        if clean_fb and clean_fb not in ("localhost", "127.0.0.1"):
            turn_srv = f"{clean_fb}:3478"

    if turn_srv:
        if not turn_srv.startswith(("turn:", "turns:")):
            turn_srv = f"turn:{turn_srv}"
        turn_entry: Dict[str, Any] = {"urls": [turn_srv, f"{turn_srv}?transport=tcp"]}
        t_user = str(cfg.get("turn_username") or "nornia").strip()
        t_pass = str(cfg.get("turn_password") or "nornia_turn_secret_2026").strip()
        if t_user:
            turn_entry["username"] = t_user
        if t_pass:
            turn_entry["credential"] = t_pass
        ice_servers.append(turn_entry)
    return ice_servers


def sync_asterisk_rtp_turn_config(ras_cfg: Optional[Dict[str, Any]] = None):
    """Updates /etc/asterisk/rtp.conf with STUN/TURN settings when RAS TURN relay is active."""
    if not os.path.exists("/etc/asterisk"):
        return
    cfg = ras_cfg or get_ras_config()
    turn_lines = ""
    has_wg_edge = os.path.isfile(_PBX_WG_CONF_PATH)
    if (cfg.get("enabled") and cfg.get("turn_enabled", True)) or has_wg_edge:
        turn_srv = str(cfg.get("turn_server") or "").strip()
        if not turn_srv and cfg.get("hub_url"):
            try:
                parsed = urllib.parse.urlparse(str(cfg.get("hub_url")).strip())
                if parsed.hostname:
                    turn_srv = f"{parsed.hostname}:3478"
            except Exception:
                pass
        if has_wg_edge:
            # Prefer WireGuard Hub TURN IP (10.200.0.1:3478) to avoid LAN Hairpin NAT and bypass outbound/inbound firewall blocks
            turn_host, turn_port = "10.200.0.1", "3478"
        elif turn_srv:
            clean_turn = turn_srv.replace("turn:", "").replace("turns:", "").split("?")[0].strip()
            turn_host, _, turn_port = clean_turn.partition(":")
            turn_port = turn_port or "3478"
        else:
            turn_host, turn_port = "", ""
        if turn_host:
            t_user = str(cfg.get("turn_username") or "nornia").strip()
            t_pass = str(cfg.get("turn_password") or "nornia_turn_secret_2026").strip()
            turn_lines = (
                f"turnaddr={turn_host}:{turn_port}\n"
                f"turnusername={t_user}\n"
                f"turnpassword={t_pass}\n"
            )

    rtp_content = (
        "; ==========================================\n"
        "; AIDA-PBX RTP & ICE / TURN CONFIGURATION\n"
        "; ==========================================\n"
        "[general]\n"
        "rtpstart=10000\n"
        "rtpend=20000\n"
        "icesupport=yes\n"
        "stunaddr=stun.l.google.com:19302\n"
        f"{turn_lines}"
    )
    try:
        with open("/etc/asterisk/rtp.conf", "w", encoding="utf-8") as f:
            f.write(rtp_content)
        subprocess.run(
            ["asterisk", "-rx", "module reload res_rtp_asterisk.so"],
            capture_output=True,
            text=True,
            timeout=2.0,
            check=False,
        )
    except Exception as e:
        print(f"[Nornia RAS] rtp.conf güncelleme uyarısı: {e}")


def _compute_hub_ws_candidates(hub_url: str, subdomain: str, hw_id: str) -> List[str]:
    """Returns ordered candidate WebSocket URLs (:8050, :80 via Nginx, :443 via Nginx SSL) so both LAN and WAN Firewall setups connect seamlessly."""
    raw = str(hub_url or "").strip().rstrip("/")
    if not raw:
        return []
    has_explicit_scheme = raw.startswith(("http://", "https://", "ws://", "wss://"))
    norm = raw if has_explicit_scheme else f"http://{raw}"
    parsed = urllib.parse.urlparse(norm)
    netloc = parsed.netloc or parsed.path
    host_only = netloc.split(":")[0]
    has_explicit_port = ":" in netloc

    query = urllib.parse.urlencode({
        "subdomain": subdomain or "merkez",
        "hardware_id": hw_id,
    })

    if has_explicit_port:
        ws_scheme = "wss" if parsed.scheme in ("https", "wss") else "ws"
        return [f"{ws_scheme}://{netloc}/api/v1/ras/tunnel?{query}"]

    if parsed.scheme in ("https", "wss"):
        return [
            f"wss://{host_only}/api/v1/ras/tunnel?{query}",
            f"ws://{host_only}:8050/api/v1/ras/tunnel?{query}",
            f"ws://{host_only}/api/v1/ras/tunnel?{query}",
        ]

    # Default when user enters an IP or hostname without port (e.g. 213.74.214.246):
    # Try Port 80 (Nginx HTTP), Port 443 (Nginx HTTPS), and Port 8050 (Direct Hub API)
    return [
        f"ws://{host_only}:8050/api/v1/ras/tunnel?{query}",
        f"ws://{host_only}/api/v1/ras/tunnel?{query}",
        f"wss://{host_only}/api/v1/ras/tunnel?{query}",
    ]


def _compute_public_ras_urls(hub_url: str, subdomain: str) -> Dict[str, str]:
    raw = str(hub_url or "").strip().rstrip("/")
    if not raw:
        return {"public_ras_url": "", "mobile_ras_url": "", "wss_sip_url": ""}
    if not raw.startswith(("http://", "https://", "ws://", "wss://")):
        raw = f"http://{raw}"
    parsed = urllib.parse.urlparse(raw)
    http_scheme = "https" if parsed.scheme in ("https", "wss") else "http"
    ws_scheme = "wss" if http_scheme == "https" else "ws"
    netloc = parsed.netloc or parsed.path
    if ":" not in netloc and http_scheme == "http":
        netloc = f"{netloc}:8050"

    sub = str(subdomain or "merkez").strip().lower()
    host_only = netloc.split(":")[0]
    is_ip = all(p.isdigit() for p in host_only.split(".")) if "." in host_only else False

    if is_ip or host_only == "localhost":
        pub_url = f"{http_scheme}://{netloc}"
        wss_url = f"{ws_scheme}://{netloc}/ras-sip-ws"
    else:
        pub_url = f"{http_scheme}://{sub}.{netloc}" if not netloc.startswith(f"{sub}.") else f"{http_scheme}://{netloc}"
        wss_Host = f"{sub}.{netloc}" if not netloc.startswith(f"{sub}.") else netloc
        wss_url = f"{ws_scheme}://{wss_Host}/ras-sip-ws"

    return {
        "public_ras_url": pub_url,
        "mobile_ras_url": pub_url,
        "wss_sip_url": wss_url,
    }


async def _handle_tunneled_http_request(tunnel_ws: Any, msg: Dict[str, Any]):
    """Executes an HTTP request received from the Central RAS Hub against local PBX Backend (8000) or Frontend (3000)."""
    req_id = str(msg.get("req_id") or "")
    method = str(msg.get("method") or "GET").upper()
    path = str(msg.get("path") or "/")
    query_str = str(msg.get("query") or "")
    headers_in = dict(msg.get("headers") or {})
    body_b64 = msg.get("body_b64") or ""

    # Route /api/*, /uploads/*, Cisco root provisioning files (/SEP*, /spa*, /dialplan.xml, /XMLDefault.cnf.xml), /sdk/* directly to FastAPI Backend (127.0.0.1:8000)
    # Route everything else to Next.js Frontend (127.0.0.1:3000)
    _path_low = path.lower()
    if (
        path.startswith(("/api/", "/uploads/", "/settings/", "/calls/", "/webhooks/", "/webhook/", "/docs", "/openapi.json", "/sdk/"))
        or _path_low.startswith(("/sep", "/spa", "/dialplan.xml", "/xmldefault.cnf.xml"))
    ):
        target_base = "http://127.0.0.1:8000"
    else:
        target_base = "http://127.0.0.1:3000"

    target_url = f"{target_base}{path}"
    if query_str:
        target_url += f"?{query_str}"

    req_body = base64.b64decode(body_b64) if body_b64 else None
    RAS_RUNTIME_STATE["bytes_rx"] += len(req_body) if req_body else 0

    clean_headers = {
        k: v
        for k, v in headers_in.items()
        if k.lower() not in ("host", "content-length", "transfer-encoding", "connection")
    }
    clean_headers["X-Nornia-RAS-Tunnel"] = "1"
    clean_headers["X-RAS-Forwarded"] = "1"
    if msg.get("public_host"):
        clean_headers["X-Forwarded-Host"] = str(msg.get("public_host"))
        clean_headers["Host"] = str(msg.get("public_host"))
    if msg.get("public_proto"):
        clean_headers["X-Forwarded-Proto"] = str(msg.get("public_proto"))

    try:
        async with httpx.AsyncClient(timeout=120.0, follow_redirects=False) as client:
            resp = await client.request(
                method=method,
                url=target_url,
                headers=clean_headers,
                content=req_body,
            )
            resp_bytes = resp.content or b""
            RAS_RUNTIME_STATE["bytes_tx"] += len(resp_bytes)
            resp_headers = {
                k: v
                for k, v in resp.headers.items()
                if k.lower() not in ("content-encoding", "transfer-encoding", "content-length", "connection")
            }
            reply = {
                "type": "HTTP_RES",
                "req_id": req_id,
                "status_code": resp.status_code,
                "headers": resp_headers,
                "body_b64": base64.b64encode(resp_bytes).decode("ascii"),
            }
    except Exception as exc:
        err_bytes = json.dumps({"detail": f"RAS Local Proxy Error: {exc}"}).encode("utf-8")
        reply = {
            "type": "HTTP_RES",
            "req_id": req_id,
            "status_code": 502,
            "headers": {"content-type": "application/json"},
            "body_b64": base64.b64encode(err_bytes).decode("ascii"),
        }

    try:
        await tunnel_ws.send(json.dumps(reply))
    except Exception:
        pass


async def _handle_tunneled_ws_open(tunnel_ws: Any, msg: Dict[str, Any]):
    """Bridges a WebSocket stream (e.g. /ras-sip-ws -> Asterisk 127.0.0.1:8088/ws or /ws -> Backend 127.0.0.1:8000/ws)."""
    stream_id = str(msg.get("stream_id") or "")
    target_kind = str(msg.get("target") or "sip").lower()
    subprotocol = str(msg.get("subprotocol") or "").strip()

    if target_kind == "sip" or str(msg.get("path") or "").startswith("/ras-sip-ws"):
        local_ws_url = "ws://127.0.0.1:8088/ws"
        subprotocols = ["sip"]
    else:
        local_ws_url = "ws://127.0.0.1:8000/ws"
        subprotocols = [subprotocol] if subprotocol else None

    async def _bridge_ws():
        RAS_RUNTIME_STATE["active_streams"] = max(0, RAS_RUNTIME_STATE.get("active_streams", 0) + 1)
        try:
            connect_kwargs: Dict[str, Any] = {"ping_interval": 20, "ping_timeout": 20}
            if subprotocols:
                connect_kwargs["subprotocols"] = subprotocols
            async with websockets.connect(local_ws_url, **connect_kwargs) as local_ws:
                _active_ws_conns[stream_id] = local_ws
                await tunnel_ws.send(json.dumps({"type": "WS_OPEN_ACK", "stream_id": stream_id, "ok": True}))
                async for frame in local_ws:
                    is_bin = isinstance(frame, (bytes, bytearray))
                    payload_str = (
                        base64.b64encode(frame).decode("ascii")
                        if is_bin
                        else str(frame)
                    )
                    RAS_RUNTIME_STATE["bytes_tx"] += len(frame)
                    await tunnel_ws.send(
                        json.dumps({
                            "type": "WS_DATA",
                            "stream_id": stream_id,
                            "is_binary": is_bin,
                            "data": payload_str,
                        })
                    )
        except Exception as e:
            try:
                await tunnel_ws.send(
                    json.dumps({"type": "WS_CLOSE", "stream_id": stream_id, "reason": str(e)})
                )
            except Exception:
                pass
        finally:
            _active_ws_conns.pop(stream_id, None)
            _active_ws_streams.pop(stream_id, None)
            RAS_RUNTIME_STATE["active_streams"] = max(0, RAS_RUNTIME_STATE.get("active_streams", 1) - 1)

    task = asyncio.create_task(_bridge_ws())
    _active_ws_streams[stream_id] = task


async def _handle_tunneled_tcp_open(tunnel_ws: Any, msg: Dict[str, Any]):
    """Bridges a TCP stream (e.g., Remote Support SSH port 22) when remote_ssh_enabled is True."""
    stream_id = str(msg.get("stream_id") or "")
    target_port = int(msg.get("port") or 22)
    cfg = get_ras_config()

    if target_port == 22 and not is_ssh_currently_allowed(cfg):
        await tunnel_ws.send(
            json.dumps({
                "type": "TCP_CLOSE",
                "stream_id": stream_id,
                "reason": "Merkez Lisans Sunucusu tarafından Santral SSH erişimi kapatılmış.",
            })
        )
        return

    allowed_ports = {22, 8000, 3000, 5060, 5160, 8088, 8089}
    if target_port not in allowed_ports:
        await tunnel_ws.send(
            json.dumps({
                "type": "TCP_CLOSE",
                "stream_id": stream_id,
                "reason": f"Port {target_port} izin verilen RAS portları arasında değil.",
            })
        )
        return

    async def _bridge_tcp():
        RAS_RUNTIME_STATE["active_streams"] = max(0, RAS_RUNTIME_STATE.get("active_streams", 0) + 1)
        writer = None
        try:
            reader, writer = await asyncio.open_connection("127.0.0.1", target_port)
            _active_tcp_writers[stream_id] = writer
            await tunnel_ws.send(json.dumps({"type": "TCP_OPEN_ACK", "stream_id": stream_id, "ok": True}))
            while True:
                chunk = await reader.read(16384)
                if not chunk:
                    break
                RAS_RUNTIME_STATE["bytes_tx"] += len(chunk)
                await tunnel_ws.send(
                    json.dumps({
                        "type": "TCP_DATA",
                        "stream_id": stream_id,
                        "data_b64": base64.b64encode(chunk).decode("ascii"),
                    })
                )
        except Exception as e:
            try:
                await tunnel_ws.send(
                    json.dumps({"type": "TCP_CLOSE", "stream_id": stream_id, "reason": str(e)})
                )
            except Exception:
                pass
        finally:
            _active_tcp_writers.pop(stream_id, None)
            if writer:
                try:
                    writer.close()
                except Exception:
                    pass
            RAS_RUNTIME_STATE["active_streams"] = max(0, RAS_RUNTIME_STATE.get("active_streams", 1) - 1)

    asyncio.create_task(_bridge_tcp())


async def _ras_tunnel_loop():
    """Background daemon loop that maintains the persistent outbound RAS tunnel to the Central Hub."""
    global _ras_reconnect_event
    if _ras_reconnect_event is None:
        _ras_reconnect_event = asyncio.Event()

    while True:
        cfg = get_ras_config()
        if not cfg.get("enabled") or not str(cfg.get("hub_url") or "").strip():
            RAS_RUNTIME_STATE["status"] = "disabled"
            RAS_RUNTIME_STATE["connected"] = False
            RAS_RUNTIME_STATE["latency_ms"] = None
            _ras_reconnect_event.clear()
            try:
                await asyncio.wait_for(_ras_reconnect_event.wait(), timeout=5.0)
            except asyncio.TimeoutError:
                pass
            continue

        hw_info = get_hardware_fingerprint()
        hw_id = hw_info.get("hardware_id", "HW-UNKNOWN")
        subdomain = str(cfg.get("subdomain") or "merkez").strip().lower()
        ws_candidates = _compute_hub_ws_candidates(str(cfg.get("hub_url")), subdomain, hw_id)
        urls_info = _compute_public_ras_urls(str(cfg.get("hub_url")), subdomain)
        RAS_RUNTIME_STATE.update(urls_info)
        if not RAS_RUNTIME_STATE.get("connected"):
            RAS_RUNTIME_STATE["status"] = "connecting"

        _ras_reconnect_event.clear()
        last_conn_err = ""
        connected_once = False

        for ws_url in ws_candidates:
            try:
                ifaces = get_live_interfaces()
                local_ips = [i.get("primary_cidr") for i in ifaces if i.get("primary_cidr")]
                conn_kwargs: Dict[str, Any] = {
                    "ping_interval": None,
                    "max_size": 150 * 1024 * 1024,
                    "open_timeout": 5.0,
                }
                if ws_url.startswith("wss://"):
                    ssl_ctx = ssl.create_default_context()
                    if os.getenv("NORNIA_ALLOW_INSECURE_TLS", "0") == "1":
                        ssl_ctx.check_hostname = False
                        ssl_ctx.verify_mode = ssl.CERT_NONE
                    conn_kwargs["ssl"] = ssl_ctx

                async with websockets.connect(ws_url, **conn_kwargs) as tunnel_ws:
                    connected_once = True
                    # Send initial registration handshake
                    try:
                        from backend.services.telemetry_worker import get_current_pbx_version
                        live_pbx_ver = get_current_pbx_version()
                    except Exception:
                        live_pbx_ver = ""
                    pbx_wg_pubkey = await asyncio.to_thread(ensure_pbx_wg_keypair_sync)
                    def _collect_local_prov_sync_snapshot():
                        macs_set = set()
                        sip_users_set = set()
                        try:
                            from backend.main import settings_db as _s_prov
                            from backend.services.autoprovision_service import normalize_mac_address as _norm_m
                            for _ap in (_s_prov.get("autoprovision") or []):
                                if isinstance(_ap, dict):
                                    _, _mh = _norm_m(_ap.get("mac") or "")
                                    if len(_mh) == 12:
                                        macs_set.add(_mh)
                                    _asu = str(_ap.get("sip_username") or "").strip()
                                    if _asu:
                                        sip_users_set.add(_asu)
                            for _u in (_s_prov.get("users") or []):
                                if not isinstance(_u, dict) or _u.get("is_active") is False:
                                    continue
                                _sdevs = _u.get("sip_devices")
                                if isinstance(_sdevs, str) and _sdevs.strip().startswith("["):
                                    try:
                                        _sdevs = json.loads(_sdevs)
                                    except Exception:
                                        _sdevs = []
                                if isinstance(_sdevs, list):
                                    for _sd in _sdevs:
                                        if not isinstance(_sd, dict) or _sd.get("is_active") is False:
                                            continue
                                        _dt = str(_sd.get("device_type") or "").strip().lower()
                                        if _dt in ("web_phone", "virtual_subscriber"):
                                            continue
                                        _, _mh2 = _norm_m(_sd.get("mac") or "")
                                        if len(_mh2) == 12:
                                            macs_set.add(_mh2)
                                        _su2 = str(_sd.get("sip_username") or "").strip()
                                        if _su2:
                                            sip_users_set.add(_su2)
                                        _drv2 = str(_sd.get("sip_driver") or "").strip().lower()
                                        _br2 = str(_sd.get("brand") or "").strip().lower()
                                        _u_ext2 = str(_u.get("extension") or "").strip()
                                        if _u_ext2 and (_drv2 in ("chan_sip", "sip", "cisco_sip") or "cisco" in _br2):
                                            sip_users_set.add(_u_ext2)
                            for _dk, _dv in ((_s_prov.get("user_deskphone_configs") or {}).items()):
                                if isinstance(_dv, dict):
                                    _, _mh3 = _norm_m(_dv.get("mac") or "")
                                    if len(_mh3) == 12:
                                        macs_set.add(_mh3)
                        except Exception:
                            pass
                        return sorted(macs_set), sorted(sip_users_set)

                    reg_macs_init, reg_susers_init = _collect_local_prov_sync_snapshot()
                    _last_prov_sig = [f"{','.join(reg_macs_init)}|{','.join(reg_susers_init)}"]

                    tunnel_trunk_dids: List[str] = []
                    try:
                        from backend.main import settings_db as _s_tr
                        for _tr in (_s_tr.get("trunks") or []):
                            if not isinstance(_tr, dict) or _tr.get("is_active", True) is False:
                                continue
                            _sh = _tr.get("sip_headers")
                            if isinstance(_sh, str):
                                try:
                                    _sh = json.loads(_sh)
                                except Exception:
                                    _sh = {}
                            if isinstance(_sh, dict) and _sh.get("use_tunnel_proxy"):
                                for _k in ("did_number", "username"):
                                    _val = str(_tr.get(_k) or "").strip()
                                    if _val and _val not in tunnel_trunk_dids:
                                        tunnel_trunk_dids.append(_val)
                                _ex = str(_sh.get("extra_match_dids") or "").strip()
                                for _it in _ex.replace(";", ",").split(","):
                                    _ic = _it.strip()
                                    if _ic and _ic not in tunnel_trunk_dids:
                                        tunnel_trunk_dids.append(_ic)
                    except Exception:
                        pass
                    hello_payload = {
                        "type": "RAS_REGISTER",
                        "hardware_id": hw_id,
                        "hostname": socket.gethostname(),
                        "subdomain": subdomain,
                        "secret_token": str(cfg.get("secret_token") or ""),
                        "remote_ssh_enabled": bool(cfg.get("remote_ssh_enabled", True)),
                        "local_ips": local_ips,
                        "version": live_pbx_ver,
                        "wg_public_key": pbx_wg_pubkey,
                        "tunnel_trunk_dids": tunnel_trunk_dids,
                        "registered_macs": reg_macs_init,
                        "registered_sip_users": reg_susers_init,
                    }
                    t0 = time.monotonic()
                    await tunnel_ws.send(json.dumps(hello_payload))

                    RAS_RUNTIME_STATE["status"] = "connected"
                    RAS_RUNTIME_STATE["connected"] = True
                    RAS_RUNTIME_STATE["last_connected_at"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    RAS_RUNTIME_STATE["last_error"] = ""
                    RAS_RUNTIME_STATE["latency_ms"] = max(0.1, round((time.monotonic() - t0) * 1000, 1))

                    async def _ping_keepalive():
                        while True:
                            await asyncio.sleep(15)
                            p_start = time.monotonic()
                            ping_msg: Dict[str, Any] = {
                                "type": "PING",
                                "ts": p_start,
                                "remote_ssh_enabled": bool(get_ras_config().get("remote_ssh_enabled", True)),
                            }
                            cur_macs, cur_susers = _collect_local_prov_sync_snapshot()
                            cur_sig = f"{','.join(cur_macs)}|{','.join(cur_susers)}"
                            if cur_sig != _last_prov_sig[0]:
                                _last_prov_sig[0] = cur_sig
                                ping_msg["registered_macs"] = cur_macs
                                ping_msg["registered_sip_users"] = cur_susers
                            await tunnel_ws.send(json.dumps(ping_msg))

                    async def _watch_manual_reconnect():
                        await _ras_reconnect_event.wait()
                        _ras_reconnect_event.clear()
                        try:
                            await tunnel_ws.close()
                        except Exception:
                            pass

                    ping_task = asyncio.create_task(_ping_keepalive())
                    watch_task = asyncio.create_task(_watch_manual_reconnect())
                    try:
                        async for raw_msg in tunnel_ws:
                            try:
                                msg = json.loads(raw_msg)
                            except Exception:
                                continue

                            mtype = msg.get("type")
                            if mtype == "PONG":
                                sent_ts = float(msg.get("ts") or 0)
                                if sent_ts > 0:
                                    RAS_RUNTIME_STATE["latency_ms"] = max(0.1, round((time.monotonic() - sent_ts) * 1000, 1))
                                RAS_RUNTIME_STATE["last_ping_at"] = datetime.datetime.now().strftime("%H:%M:%S")
                                if "remote_ssh_enabled" in msg and msg["remote_ssh_enabled"] is not None:
                                    apply_central_ssh_control(bool(msg["remote_ssh_enabled"]))
                            elif mtype == "RAS_SSH_CONTROL":
                                apply_central_ssh_control(bool(msg.get("remote_ssh_enabled", True)))
                            elif mtype in ("RAS_THREAT_BAN", "RAS_THREAT_UNBAN"):
                                async def _apply_realtime_threat(push_msg):
                                    try:
                                        from backend.services.threat_intel_service import apply_global_threat_intel
                                        from backend.main import (
                                            settings_db as main_settings_db,
                                            _execute_firewall_ban,
                                            _execute_firewall_unban,
                                            _is_trusted_or_local_ip,
                                            save_settings as main_save_settings,
                                        )
                                        await asyncio.to_thread(
                                            apply_global_threat_intel,
                                            push_msg.get("items", []) if push_msg.get("type") == "RAS_THREAT_BAN" else [],
                                            push_msg.get("ips", []) if push_msg.get("type") == "RAS_THREAT_UNBAN" else [],
                                            main_settings_db,
                                            _execute_firewall_ban,
                                            _execute_firewall_unban,
                                            _is_trusted_or_local_ip,
                                            main_save_settings,
                                            True,
                                            7,
                                            True,
                                        )
                                    except Exception as th_err:
                                        print(f"[Nornia Connect] Realtime threat push apply warning: {th_err}")
                                asyncio.create_task(_apply_realtime_threat(msg))
                            elif mtype == "RAS_LICENSE_SYNC":
                                try:
                                    from backend.services.telemetry_worker import send_single_telemetry_heartbeat
                                    asyncio.create_task(send_single_telemetry_heartbeat())
                                except Exception:
                                    pass
                            elif mtype == "RAS_OTA_UPDATE":
                                asyncio.create_task(_execute_remote_ota_update(msg))
                            elif mtype == "RAS_LICENSE_SYNC":
                                try:
                                    from backend.services.telemetry_worker import send_single_telemetry_heartbeat
                                    print("[Nornia Connect] Instant license/quota sync signal received from Central Panel.")
                                    asyncio.create_task(send_single_telemetry_heartbeat())
                                except Exception:
                                    pass
                            elif mtype == "RAS_WELCOME":
                                if msg.get("public_ras_url"):
                                    RAS_RUNTIME_STATE["public_ras_url"] = msg["public_ras_url"]
                                    RAS_RUNTIME_STATE["mobile_ras_url"] = msg["public_ras_url"]
                                if msg.get("wss_sip_url"):
                                    RAS_RUNTIME_STATE["wss_sip_url"] = msg["wss_sip_url"]
                                if "remote_ssh_enabled" in msg and msg["remote_ssh_enabled"] is not None:
                                    apply_central_ssh_control(bool(msg["remote_ssh_enabled"]))
                                if isinstance(msg.get("sip_edge"), dict):
                                    asyncio.create_task(asyncio.to_thread(apply_pbx_sip_edge_wireguard_sync, msg["sip_edge"]))
                                if msg.get("subdomain_locked"):
                                    try:
                                        from backend.main import save_settings, settings_db
                                        rc = get_ras_config()
                                        rc["subdomain_locked"] = True
                                        rc["locked_subdomain"] = str(msg.get("subdomain") or subdomain).strip().lower()
                                        rc["subdomain"] = rc["locked_subdomain"]
                                        settings_db["ras_config"] = rc
                                        save_settings(settings_db)
                                    except Exception:
                                        pass
                                try:
                                    from backend.services.telemetry_worker import send_single_telemetry_heartbeat
                                    asyncio.create_task(send_single_telemetry_heartbeat())
                                except Exception:
                                    pass
                            elif mtype == "RAS_REJECTED":
                                reason_str = str(msg.get("reason") or "Alt alan adı başka bir santral tarafından kullanılmaktadır.")
                                RAS_RUNTIME_STATE["status"] = "error"
                                RAS_RUNTIME_STATE["connected"] = False
                                RAS_RUNTIME_STATE["last_error"] = reason_str
                                try:
                                    from backend.main import save_settings, settings_db
                                    rc = get_ras_config()
                                    if msg.get("locked_subdomain"):
                                        rc["subdomain_locked"] = True
                                        rc["locked_subdomain"] = str(msg["locked_subdomain"]).strip().lower()
                                        rc["subdomain"] = rc["locked_subdomain"]
                                    else:
                                        rc["subdomain_locked"] = False
                                        rc["locked_subdomain"] = ""
                                        rc["enabled"] = False
                                    settings_db["ras_config"] = rc
                                    save_settings(settings_db)
                                except Exception:
                                    pass
                                break
                            elif mtype == "RAS_UNBOUND":
                                msg_unbind = str(msg.get("message") or "Merkez Lisans Sunucusu üzerinden alt alan adı kilidi kaldırıldı.")
                                RAS_RUNTIME_STATE["status"] = "disabled"
                                RAS_RUNTIME_STATE["connected"] = False
                                RAS_RUNTIME_STATE["last_error"] = msg_unbind
                                try:
                                    from backend.main import save_settings, settings_db
                                    rc = get_ras_config()
                                    rc["subdomain_locked"] = False
                                    rc["locked_subdomain"] = ""
                                    rc["enabled"] = False
                                    settings_db["ras_config"] = rc
                                    save_settings(settings_db)
                                except Exception:
                                    pass
                                break
                            elif mtype == "HTTP_REQ":
                                asyncio.create_task(_handle_tunneled_http_request(tunnel_ws, msg))
                            elif mtype == "WS_OPEN":
                                await _handle_tunneled_ws_open(tunnel_ws, msg)
                            elif mtype == "WS_DATA":
                                sid = str(msg.get("stream_id") or "")
                                l_ws = _active_ws_conns.get(sid)
                                if l_ws:
                                    data_val = msg.get("data") or ""
                                    if msg.get("is_binary"):
                                        raw_b = base64.b64decode(data_val)
                                        RAS_RUNTIME_STATE["bytes_rx"] += len(raw_b)
                                        await l_ws.send(raw_b)
                                    else:
                                        RAS_RUNTIME_STATE["bytes_rx"] += len(data_val)
                                        await l_ws.send(data_val)
                            elif mtype == "WS_CLOSE":
                                sid = str(msg.get("stream_id") or "")
                                l_ws = _active_ws_conns.pop(sid, None)
                                if l_ws:
                                    try:
                                        await l_ws.close()
                                    except Exception:
                                        pass
                            elif mtype == "TCP_OPEN":
                                await _handle_tunneled_tcp_open(tunnel_ws, msg)
                            elif mtype == "TCP_DATA":
                                sid = str(msg.get("stream_id") or "")
                                writer = _active_tcp_writers.get(sid)
                                if writer:
                                    raw_b = base64.b64decode(msg.get("data_b64") or "")
                                    RAS_RUNTIME_STATE["bytes_rx"] += len(raw_b)
                                    writer.write(raw_b)
                                    await writer.drain()
                            elif mtype == "TCP_CLOSE":
                                sid = str(msg.get("stream_id") or "")
                                writer = _active_tcp_writers.pop(sid, None)
                                if writer:
                                    try:
                                        writer.close()
                                    except Exception:
                                        pass
                    finally:
                        ping_task.cancel()
                        watch_task.cancel()
                        RAS_RUNTIME_STATE["connected"] = False
                        RAS_RUNTIME_STATE["status"] = "connecting"
                    break
            except Exception as exc:
                last_conn_err = f"{ws_url.split('?')[0]} -> {exc}"

        if not connected_once and last_conn_err:
            RAS_RUNTIME_STATE["status"] = "error"
            RAS_RUNTIME_STATE["connected"] = False
            RAS_RUNTIME_STATE["last_error"] = last_conn_err
            RAS_RUNTIME_STATE["reconnect_count"] = int(RAS_RUNTIME_STATE.get("reconnect_count") or 0) + 1
            try:
                await asyncio.wait_for(_ras_reconnect_event.wait(), timeout=3.0)
            except asyncio.TimeoutError:
                pass
        else:
            await asyncio.sleep(0.3)


def resolve_central_hub_base_url(explicit_hub_url: str = "") -> str:
    """Resolves the Central Nornia Hub HTTP(S) base URL cleanly from explicit param, env, or ras_config."""
    cand = str(explicit_hub_url or "").strip().rstrip("/")
    if not cand:
        env_u = str(os.getenv("LICENSE_CENTER_URL") or "").strip()
        if env_u:
            cand = env_u.split("/api/")[0].rstrip("/")
    if not cand:
        try:
            rc = get_ras_config()
            cand = str((rc or {}).get("hub_url") or "").strip().rstrip("/")
        except Exception:
            cand = ""
    if not cand:
        cand = "https://panel.nornia.com.tr"
    if cand.startswith("wss://"):
        cand = "https://" + cand[6:]
    elif cand.startswith("ws://"):
        cand = "http://" + cand[5:]
    if not cand.startswith(("http://", "https://")):
        host_part = cand.split(":")[0]
        if all(p.isdigit() for p in host_part.split(".")) and ":" not in cand:
            cand = f"http://{cand}:8050"
        else:
            cand = f"https://{cand}"
    return cand.rstrip("/")


def spawn_nornia_updater(
    mode: str = "now",
    target_version: str = "",
    target_commit: str = "",
    triggered_by: str = "admin",
    source: str = "pbx",
    hub_url: str = "",
    hardware_id: str = "",
) -> bool:
    """Launches the unified detached backend/scripts/nornia_updater.py process safely."""
    import sys as _sys
    project_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    script_path = os.path.join(project_dir, "backend", "scripts", "nornia_updater.py")
    if not os.path.isfile(script_path):
        print(f"[Nornia Updater Error]: Script not found at {script_path}")
        return False

    resolved_hub = resolve_central_hub_base_url(hub_url)
    hw_id = str(hardware_id or "").strip().upper()
    if not hw_id:
        try:
            from backend.services.hardware_info import get_hardware_id
            hw_id = str(get_hardware_id() or "").strip().upper()
        except Exception:
            hw_id = ""

    import shlex as _shlex
    import shutil as _shutil
    import time as _time

    py_cmd = [
        _sys.executable,
        script_path,
        "--mode",
        str(mode or "now").strip(),
        "--triggered-by",
        str(triggered_by or "admin").strip(),
        "--source",
        str(source or "pbx").strip(),
        "--hub-url",
        resolved_hub,
        "--hardware-id",
        hw_id,
    ]
    if target_version:
        py_cmd.extend(["--target-version", str(target_version).strip()])
    if target_commit:
        py_cmd.extend(["--target-commit", str(target_commit).strip()])

    try:
        # CRITICAL: Launch completely OUTSIDE aida-backend's PM2 process tree (PPID=1 / own systemd unit)
        # so `pm2 restart aida-backend` (PM2 treekill) NEVER kills nornia_updater.py mid-step!
        if _shutil.which("systemd-run") and os.path.exists("/run/systemd/system"):
            unit_name = f"nornia-updater-{int(_time.time())}"
            cur_path = os.environ.get("PATH") or "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
            cur_home = os.environ.get("HOME") or "/root"
            cur_pm2_home = os.environ.get("PM2_HOME") or os.path.join(cur_home, ".pm2")
            sd_cmd = [
                "systemd-run",
                "--unit",
                unit_name,
                "--collect",
                "--no-block",
                "--working-directory",
                project_dir,
                f"--setenv=PATH={cur_path}",
                f"--setenv=HOME={cur_home}",
                f"--setenv=PM2_HOME={cur_pm2_home}",
            ] + py_cmd
            res_sd = subprocess.run(sd_cmd, capture_output=True, text=True, timeout=5)
            if res_sd.returncode == 0:
                return True

        # Fallback: double-fork via immediate-exit shell so kernel reparents updater to PID 1 (PPID=1)
        quoted_cmd = " ".join(_shlex.quote(arg) for arg in py_cmd)
        subprocess.run(
            ["sh", "-c", f"nohup {quoted_cmd} >/dev/null 2>&1 </dev/null &"],
            cwd=project_dir,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=5,
        )
        return True
    except Exception as exc:
        print(f"[Nornia Updater Spawn Error]: {exc}")
        return False


async def _execute_remote_ota_update(msg: Dict[str, Any]):
    """Executes an Over-The-Air (OTA) update via the unified safe nornia_updater.py engine."""
    triggered_by = str(msg.get("triggered_by") or "admin")
    target_version = str(msg.get("target_version") or "").strip()
    target_commit = str(msg.get("target_commit") or "").strip()
    mode = str(msg.get("mode") or "now").strip().lower()
    if mode not in ("now", "after_calls"):
        mode = "now"
    hub_url = str(msg.get("hub_url") or "").strip()

    try:
        from backend.main import log_event
        await log_event(
            user_id="system",
            action="OTA_UPDATE_START",
            module="Nornia Connect OTA",
            details={
                "summary": f"Merkez Lisans Panelinden ({triggered_by}) uzaktan OTA güncelleme başlatıldı (Hedef: {target_version or 'Son'}, Mod: {mode})."
            },
        )
    except Exception:
        pass

    spawn_nornia_updater(
        mode=mode,
        target_version=target_version,
        target_commit=target_commit,
        triggered_by=triggered_by,
        source="central_panel_ota",
        hub_url=hub_url,
    )


def start_ras_tunnel_worker():
    global _ras_worker_task
    ensure_emergency_ssh_cli_installed()
    if _ras_worker_task is None or _ras_worker_task.done():
        sync_asterisk_rtp_turn_config()
        _ras_worker_task = asyncio.create_task(_ras_tunnel_loop())


def trigger_ras_reconnect():
    global _ras_reconnect_event
    if _ras_reconnect_event is not None:
        _ras_reconnect_event.set()
    start_ras_tunnel_worker()


async def _query_hub_subdomain_check(hub_url: str, subdomain: str, hw_id: str) -> Dict[str, Any]:
    """Queries the Central Hub to check if `subdomain` is available or locked to `hw_id`."""
    raw = str(hub_url or "").strip().rstrip("/")
    if not raw:
        return {"reachable": False, "available": True, "locked_to_this_hw": False}
    has_scheme = raw.startswith(("http://", "https://"))
    norm = raw if has_scheme else f"http://{raw}"
    parsed = urllib.parse.urlparse(norm)
    host_only = (parsed.netloc or parsed.path).split(":")[0]
    has_port = ":" in (parsed.netloc or parsed.path)

    query = urllib.parse.urlencode({"subdomain": subdomain, "hardware_id": hw_id})
    if has_port:
        http_scheme = "https" if parsed.scheme == "https" else "http"
        candidates = [f"{http_scheme}://{parsed.netloc}/api/v1/connect/check-subdomain?{query}"]
    elif parsed.scheme == "https":
        candidates = [
            f"https://{host_only}/api/v1/connect/check-subdomain?{query}",
            f"http://{host_only}:8050/api/v1/connect/check-subdomain?{query}",
            f"http://{host_only}/api/v1/connect/check-subdomain?{query}",
        ]
    else:
        candidates = [
            f"http://{host_only}:8050/api/v1/connect/check-subdomain?{query}",
            f"https://{host_only}/api/v1/connect/check-subdomain?{query}",
            f"http://{host_only}/api/v1/connect/check-subdomain?{query}",
        ]

    from backend.services.auth_service import is_trusted_nornia_hub_url, validate_outbound_url
    if not is_trusted_nornia_hub_url(norm):
        ok_u, _ = validate_outbound_url(norm, allow_private=True)
        if not ok_u:
            return {"reachable": False, "available": False, "locked_to_this_hw": False, "message": "Güvenlik politikası: Geçersiz Hub adresi."}

    verify_tls = os.getenv("NORNIA_ALLOW_INSECURE_TLS", "0") != "1"
    async with httpx.AsyncClient(timeout=4.0, verify=verify_tls) as client:
        for url in candidates:
            try:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    if isinstance(data, dict) and "available" in data:
                        return {"reachable": True, **data}
            except Exception:
                continue
    return {"reachable": False, "available": True, "locked_to_this_hw": False}


@ras_client_router.get("/api/settings/ras/check-subdomain")
async def check_ras_subdomain_from_pbx(subdomain: str, hub_url: str = "", sync_lock: bool = False):
    from backend.main import save_settings, settings_db
    cfg = get_ras_config()
    target_hub = str(hub_url or cfg.get("hub_url") or "").strip()
    hw_id = get_hardware_fingerprint().get("hardware_id", "HW-UNKNOWN")

    if not target_hub:
        return {
            "available": False,
            "message": "Sorgulama yapabilmek için önce 1. alana Merkez Sunucu Adresini (Hub URL / IP) giriniz.",
        }

    res = await _query_hub_subdomain_check(target_hub, subdomain, hw_id)
    if not res.get("reachable"):
        return {
            "available": False,
            "reachable": False,
            "message": f"Merkez sunucuya ({target_hub}) ulaşılamadı. Lütfen adresi kontrol ediniz.",
        }

    # If sync_lock is requested and the hub says this hardware_id is NO LONGER locked (deleted from Central License Server), unlock locally!
    if sync_lock and cfg.get("subdomain_locked") and not res.get("locked_to_this_hw"):
        cfg["subdomain_locked"] = False
        cfg["locked_subdomain"] = ""
        settings_db["ras_config"] = cfg
        save_settings(settings_db)

    return res


@ras_client_router.get("/api/settings/ras/status")
async def get_ras_status_endpoint(request: Request):
    from backend.main import save_settings, settings_db
    cfg = get_ras_config()
    hw_info = get_hardware_fingerprint()
    hw_id = hw_info.get("hardware_id", "HW-UNKNOWN")

    # If tunnel is currently connected, ensure subdomain_locked is reflected as True
    if RAS_RUNTIME_STATE.get("connected") and cfg.get("enabled") and cfg.get("subdomain") and not cfg.get("subdomain_locked"):
        cfg["subdomain_locked"] = True
        cfg["locked_subdomain"] = cfg["subdomain"]
        settings_db["ras_config"] = cfg
        save_settings(settings_db)

    ifaces = get_live_interfaces()
    urls = _compute_public_ras_urls(cfg.get("hub_url", ""), cfg.get("subdomain", "merkez"))
    return {
        "status": "ok",
        "config": cfg,
        "runtime": {
            **RAS_RUNTIME_STATE,
            "public_ras_url": RAS_RUNTIME_STATE.get("public_ras_url") or urls["public_ras_url"],
            "mobile_ras_url": RAS_RUNTIME_STATE.get("mobile_ras_url") or urls["mobile_ras_url"],
            "wss_sip_url": RAS_RUNTIME_STATE.get("wss_sip_url") or urls["wss_sip_url"],
        },
        "hardware_id": hw_id,
        "hostname": socket.gethostname(),
        "local_interfaces": ifaces,
        "ice_servers": build_ras_ice_servers(cfg),
    }


@ras_client_router.post("/api/settings/ras/config")
async def save_ras_config_endpoint(request: Request, payload: Dict[str, Any] = Body(...)):
    from backend.main import get_user_info, log_event, save_settings, settings_db

    u_info = get_user_info(request)
    if inspect.isawaitable(u_info):
        u_info = await u_info
    current = get_ras_config()
    hw_id = get_hardware_fingerprint().get("hardware_id", "HW-UNKNOWN")

    req_hub_url = str(payload.get("hub_url", current.get("hub_url", ""))).strip()
    req_sub = str(payload.get("subdomain", current.get("subdomain", "merkez"))).strip().lower() or "merkez"
    req_enabled = bool(payload.get("enabled", current.get("enabled", False)))

    was_locked = bool(current.get("subdomain_locked"))
    locked_sub = str(current.get("locked_subdomain") or current.get("subdomain") or "").strip().lower()

    # 1. If already locked locally, check if Central License Server still holds the lock for this hardware_id
    if was_locked and locked_sub:
        check_hub = str(current.get("hub_url") or req_hub_url).strip()
        if check_hub:
            remote_status = await _query_hub_subdomain_check(check_hub, locked_sub, hw_id)
            if remote_status.get("reachable") and not remote_status.get("locked_to_this_hw"):
                # Central admin deleted or unlocked the record on panel.nornia.com.tr! Unlock locally:
                was_locked = False
                locked_sub = ""

    if was_locked and locked_sub:
        if req_sub != locked_sub:
            raise HTTPException(
                status_code=403,
                detail=f"Bu santral '{locked_sub}.nornia.com.tr' adıyla Merkez Lisans Sunucusuna tescillenmiştir ve kilitlidir. Alt alan adını değiştirmek veya silmek için önce Merkez Lisans Paneli (panel.nornia.com.tr) üzerinden kaydı silmeniz gerekmektedir.",
            )
        final_sub = locked_sub
        final_locked = True
    else:
        final_sub = req_sub
        final_locked = False
        if req_enabled and req_hub_url:
            remote_check = await _query_hub_subdomain_check(req_hub_url, req_sub, hw_id)
            if remote_check.get("reachable") and not remote_check.get("available"):
                raise HTTPException(
                    status_code=409,
                    detail=remote_check.get("message") or f"'{req_sub}' alt alan adı başka bir santral tarafından kullanılmaktadır. Lütfen farklı bir ad seçiniz.",
                )
            if remote_check.get("reachable") and remote_check.get("available"):
                final_locked = True
                locked_sub = final_sub

    updated = {
        "enabled": req_enabled,
        "hub_url": req_hub_url,
        "subdomain": final_sub,
        "subdomain_locked": final_locked,
        "locked_subdomain": locked_sub if final_locked else "",
        "secret_token": str(payload.get("secret_token", current.get("secret_token", ""))).strip(),
        "remote_ssh_enabled": bool(current.get("remote_ssh_enabled", True)),
        "central_ssh_managed": True,
        "emergency_ssh_override": bool(current.get("emergency_ssh_override", False)),
        "turn_enabled": bool(payload.get("turn_enabled", current.get("turn_enabled", True))),
        "turn_server": str(payload.get("turn_server", current.get("turn_server", ""))).strip(),
        "turn_username": str(payload.get("turn_username", current.get("turn_username", "nornia"))).strip(),
        "turn_password": str(payload.get("turn_password", current.get("turn_password", "nornia_turn_secret_2026"))).strip(),
        "auto_reconnect": True,
    }

    if updated["enabled"] and not updated["hub_url"]:
        raise HTTPException(
            status_code=400,
            detail="Nornia Connect Bulut Köprüsünü aktif etmek için Merkez Sunucu Adresi (Hub URL / IP) girilmelidir.",
        )

    settings_db["ras_config"] = updated
    save_settings(settings_db)

    sync_asterisk_rtp_turn_config(updated)
    trigger_ras_reconnect()

    await log_event(
        user_id=u_info.get("user_id", "admin"),
        action="NORNIA_CONNECT_UPDATE",
        module="Nornia Connect",
        details={
            "summary": f"Nornia Connect Bulut Köprüsü ayarları güncellendi (Durum: {'Aktif' if updated['enabled'] else 'Pasif'}, Hub: {updated['hub_url'] or '-'})",
            "subdomain": updated["subdomain"],
            "remote_ssh_enabled": updated["remote_ssh_enabled"],
        },
    )

    urls = _compute_public_ras_urls(updated["hub_url"], updated["subdomain"])
    return {
        "status": "ok",
        "message": "Nornia Connect Bulut Köprüsü ayarları kaydedildi ve bağlantı başlatıldı.",
        "config": updated,
        "runtime": {
            **RAS_RUNTIME_STATE,
            **urls,
        },
    }


@ras_client_router.post("/api/settings/ras/reconnect")
async def reconnect_ras_endpoint(request: Request):
    trigger_ras_reconnect()
    await asyncio.sleep(0.4)
    return {
        "status": "ok",
        "message": "Nornia Connect bulut köprüsü yeniden başlatıldı.",
        "runtime": RAS_RUNTIME_STATE,
    }


def _check_user_server_ssh_permission(u_info: Dict[str, Any]) -> bool:
    """Checks if the authenticated PBX user has 'server_ssh:access' or '*' permission."""
    from backend.main import settings_db

    raw_uid = str(u_info.get("raw_user_id") or u_info.get("user_id") or "admin").strip()
    role_code = str(u_info.get("role") or "").strip().lower()

    if not role_code:
        users = settings_db.get("users") or []
        matched_user = None
        for u in users:
            if not isinstance(u, dict):
                continue
            if (
                str(u.get("id") or "").strip() == raw_uid
                or str(u.get("extension") or "").strip() == raw_uid
                or str(u.get("username") or "").strip().lower() == raw_uid.lower()
                or str(u.get("email") or "").strip().lower() == raw_uid.lower()
                or str(u.get("full_name") or "").strip().lower() == raw_uid.lower()
            ):
                matched_user = u
                break
        if matched_user:
            role_code = str(matched_user.get("role") or "admin").strip().lower()
        elif raw_uid.lower() in ("admin", "superadmin", "1", ""):
            role_code = "admin"

    if role_code in ("admin", "superadmin"):
        return True

    roles = settings_db.get("roles") or []
    matched_role = next((r for r in roles if str(r.get("role_code") or "").strip().lower() == role_code), None)
    perms = (matched_role.get("permissions") if matched_role else None) or u_info.get("permissions") or []
    return "*" in perms or "server_ssh:access" in perms or "server_ssh" in perms or "ras_settings:write" in perms


def _set_pty_winsize(fd: int, rows: int = 30, cols: int = 120):
    """Sets the terminal window size (TIOCSWINSZ) on the PTY master/slave file descriptor."""
    try:
        import fcntl
        import struct
        import termios
        r = max(10, min(300, int(rows or 30)))
        c = max(40, min(500, int(cols or 120)))
        winsize = struct.pack("HHHH", r, c, 0, 0)
        fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)
    except Exception:
        pass


def _spawn_authenticated_ssh_pty_process(
    sess_obj: Dict[str, Any],
    ssh_user: str,
    ssh_password: str = "",
    rows: int = 30,
    cols: int = 120,
):
    """Spawns the real Linux SSH/PAM process on an open PTY pair, strictly requiring password authentication."""
    import pty
    import re

    clean_user = re.sub(r"[^a-zA-Z0-9._-]", "", str(ssh_user or "aida").strip()) or "aida"
    master_fd, slave_fd = pty.openpty()
    _set_pty_winsize(master_fd, rows, cols)
    _set_pty_winsize(slave_fd, rows, cols)

    env = dict(os.environ)
    env["TERM"] = "xterm-256color"
    env["COLORTERM"] = "truecolor"
    env["LANG"] = env.get("LANG") or "en_US.UTF-8"

    # Ensure local sshd is running on 127.0.0.1:22
    sshd_listening = False
    try:
        with socket.create_connection(("127.0.0.1", 22), timeout=0.6):
            sshd_listening = True
    except Exception:
        _sync_system_sshd_state(True)
        try:
            with socket.create_connection(("127.0.0.1", 22), timeout=1.0):
                sshd_listening = True
        except Exception:
            sshd_listening = False

    if sshd_listening:
        # Force password/keyboard-interactive authentication (never bypass password via local pubkey)
        cmd = [
            "ssh",
            "-tt",
            "-o", "StrictHostKeyChecking=no",
            "-o", "UserKnownHostsFile=/dev/null",
            "-o", "LogLevel=ERROR",
            "-o", "ConnectTimeout=8",
            "-o", "PubkeyAuthentication=no",
            "-o", "PreferredAuthentications=keyboard-interactive,password",
            "-o", "NumberOfPasswordPrompts=3",
            f"{clean_user}@127.0.0.1",
        ]
    else:
        # Fallback to PAM su/login if sshd port 22 is unavailable
        cmd = ["su", "-", clean_user] if os.path.exists("/bin/su") or os.path.exists("/usr/bin/su") else ["login", clean_user]

    def _setup_ctty():
        os.setsid()
        try:
            import fcntl
            import termios
            fcntl.ioctl(0, termios.TIOCSCTTY, 0)
        except Exception:
            pass

    proc = subprocess.Popen(
        cmd,
        stdin=slave_fd,
        stdout=slave_fd,
        stderr=slave_fd,
        close_fds=True,
        env=env,
        preexec_fn=_setup_ctty,
    )
    try:
        os.close(slave_fd)
    except Exception:
        pass

    sess_obj["username"] = clean_user
    sess_obj["master_fd"] = master_fd
    sess_obj["proc"] = proc
    sess_obj["awaiting_username"] = False
    sess_obj["password_sent"] = False

    async def _pty_reader_bg():
        while not sess_obj["closed"]:
            try:
                chunk = await asyncio.to_thread(os.read, master_fd, 8192)
                if not chunk:
                    break
                txt = chunk.decode("utf-8", errors="replace")
                sess_obj["buffer"] += txt
                if len(sess_obj["buffer"]) > 200000:
                    sess_obj["buffer"] = sess_obj["buffer"][-200000:]

                # Auto-fill password if explicitly supplied in login form
                if ssh_password and not sess_obj.get("password_sent"):
                    low = txt.lower()
                    if "password:" in low or "parola:" in low:
                        sess_obj["password_sent"] = True
                        try:
                            await asyncio.sleep(0.06)
                            await asyncio.to_thread(os.write, master_fd, (ssh_password + "\n").encode("utf-8"))
                        except Exception:
                            pass
            except OSError:
                break
            except Exception:
                break
        sess_obj["closed"] = True
        sess_obj["buffer"] += "\r\n\x1b[33m[SSH Oturumu Sonlandı — Yeniden bağlanmak için Enter'a veya Yeni Oturum butonuna basın]\x1b[0m\r\n"

    asyncio.create_task(_pty_reader_bg())


@ras_client_router.post("/api/settings/ras/web-ssh/start")
async def start_pbx_web_ssh_session(request: Request, payload: Dict[str, Any] = Body(...)):
    """
    Starts an authentic macOS-Terminal / xterm.js interactive SSH session.
    Strictly requires Linux SSH username & password authentication (never opens an unauthenticated shell).
    If username is omitted, prompts `login as: ` directly inside the terminal first.
    """
    import re
    import uuid
    from backend.main import get_user_info, log_event

    u_info = get_user_info(request)
    if inspect.isawaitable(u_info):
        u_info = await u_info

    if not _check_user_server_ssh_permission(u_info):
        raise HTTPException(
            status_code=403,
            detail="Sunucu Web SSH Terminali erişimi için rol yetkiniz ('server_ssh:access') bulunmamaktadır.",
        )

    cfg = get_ras_config()
    if not is_ssh_currently_allowed(cfg):
        raise HTTPException(
            status_code=403,
            detail="Merkez Lisans Sunucusu tarafından bu santralin SSH erişimi kapatılmıştır. Erişim açmak için Merkez Lisans Panelinden SSH şalterini açınız.",
        )

    raw_user = re.sub(r"[^a-zA-Z0-9._-]", "", str(payload.get("username") or "").strip())
    ssh_password = str(payload.get("password") or "")
    rows = int(payload.get("rows") or 30)
    cols = int(payload.get("cols") or 120)
    session_id = f"pty-{uuid.uuid4().hex[:16]}"
    host_label = socket.gethostname()

    banner = (
        f"\x1b[1;32mNornia SSH Terminali\x1b[0m \x1b[90m({host_label})\x1b[0m\r\n"
    )

    sess_obj: Dict[str, Any] = {
        "session_id": session_id,
        "username": raw_user,
        "username_buf": "",
        "awaiting_username": not bool(raw_user),
        "master_fd": None,
        "proc": None,
        "rows": rows,
        "cols": cols,
        "password_sent": False,
        "buffer": banner,
        "closed": False,
        "created_at": time.time(),
        "last_active": time.time(),
    }
    _active_web_ssh_sessions[session_id] = sess_obj

    if not raw_user:
        # Interactive "login as: " prompt inside the terminal just like real SSH / PuTTY / macOS Terminal
        sess_obj["buffer"] += "login as: "
    else:
        try:
            _spawn_authenticated_ssh_pty_process(
                sess_obj=sess_obj,
                ssh_user=raw_user,
                ssh_password=ssh_password,
                rows=rows,
                cols=cols,
            )
        except Exception as exc:
            _active_web_ssh_sessions.pop(session_id, None)
            raise HTTPException(status_code=500, detail=f"SSH PTY başlatılamadı: {exc}")
        await asyncio.sleep(0.25)

    await log_event(
        user_id=u_info.get("user_id", "admin"),
        action="WEB_SSH_START",
        module="Sunucu Web SSH",
        details={"summary": f"Web SSH Terminal oturumu başlatıldı (Kullanıcı: {raw_user or 'Terminalden Soruluyor'})", "session_id": session_id},
    )

    initial_out = sess_obj["buffer"]
    sess_obj["buffer"] = ""
    return {
        "status": "ok",
        "session_id": session_id,
        "username": raw_user,
        "output": initial_out,
        "closed": sess_obj["closed"],
    }


@ras_client_router.get("/api/settings/ras/web-ssh/poll")
async def poll_pbx_web_ssh_session(request: Request, session_id: str):
    """Polls buffered output from an active Web SSH PTY session."""
    from backend.main import get_user_info

    u_info = get_user_info(request)
    if inspect.isawaitable(u_info):
        u_info = await u_info
    if not _check_user_server_ssh_permission(u_info):
        raise HTTPException(status_code=403, detail="Yetkisiz erişim.")

    if not is_ssh_currently_allowed():
        _close_all_web_ssh_sessions()
        return {"status": "closed", "output": "\r\n🔒 [Merkez Lisans Sunucusu tarafından SSH erişimi kapatıldı.]\r\n", "closed": True}

    sess = _active_web_ssh_sessions.get(session_id)
    if not sess:
        return {"status": "closed", "output": "", "closed": True}

    sess["last_active"] = time.time()
    out = sess["buffer"]
    sess["buffer"] = ""
    if sess["closed"]:
        _active_web_ssh_sessions.pop(session_id, None)
    return {"status": "ok", "output": out, "closed": sess["closed"]}


@ras_client_router.post("/api/settings/ras/web-ssh/input")
async def input_pbx_web_ssh_session(request: Request, payload: Dict[str, Any] = Body(...)):
    """Sends raw xterm.js keystrokes / terminal input to an active Web SSH PTY session."""
    import re
    from backend.main import get_user_info

    u_info = get_user_info(request)
    if inspect.isawaitable(u_info):
        u_info = await u_info
    if not _check_user_server_ssh_permission(u_info):
        raise HTTPException(status_code=403, detail="Yetkisiz erişim.")

    if not is_ssh_currently_allowed():
        _close_all_web_ssh_sessions()
        raise HTTPException(status_code=403, detail="Merkez Lisans Sunucusu tarafından SSH erişimi kapatılmıştır.")

    session_id = str(payload.get("session_id") or "")
    data_str = str(payload.get("data") or "")
    sess = _active_web_ssh_sessions.get(session_id)
    if not sess or sess.get("closed"):
        raise HTTPException(status_code=404, detail="Aktif SSH oturumu bulunamadı.")

    sess["last_active"] = time.time()

    # Handle interactive "login as: " username prompt before spawning SSH PTY
    if sess.get("awaiting_username"):
        for ch in data_str:
            if ch in ("\r", "\n"):
                raw_entered = sess.get("username_buf", "").strip()
                if "@" in raw_entered:
                    raw_entered = raw_entered.split("@", 1)[0].strip()
                entered_user = re.sub(r"[^a-zA-Z0-9._-]", "", raw_entered)
                sess["username_buf"] = ""
                if not entered_user:
                    sess["buffer"] += "\r\nlogin as: "
                else:
                    sess["buffer"] += "\r\n"
                    try:
                        _spawn_authenticated_ssh_pty_process(
                            sess_obj=sess,
                            ssh_user=entered_user,
                            rows=int(sess.get("rows") or 30),
                            cols=int(sess.get("cols") or 120),
                        )
                        await asyncio.sleep(0.22)
                    except Exception as exc:
                        sess["buffer"] += f"\r\n\x1b[31mSSH başlatılamadı: {exc}\x1b[0m\r\nlogin as: "
                        sess["awaiting_username"] = True
                break
            elif ch in ("\x7f", "\x08"):
                if sess.get("username_buf"):
                    sess["username_buf"] = sess["username_buf"][:-1]
                    sess["buffer"] += "\b \b"
            elif ch == "\x03":
                sess["username_buf"] = ""
                sess["buffer"] += "^C\r\nlogin as: "
            elif ch.isprintable():
                sess["username_buf"] = sess.get("username_buf", "") + ch
                sess["buffer"] += ch

        out = sess["buffer"]
        sess["buffer"] = ""
        return {"status": "ok", "output": out, "closed": sess["closed"], "username": sess.get("username")}

    master_fd = sess.get("master_fd")
    if master_fd is not None and data_str:
        try:
            await asyncio.to_thread(os.write, master_fd, data_str.encode("utf-8"))
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Terminal yazma hatası: {exc}")

    await asyncio.sleep(0.035)
    out = sess["buffer"]
    sess["buffer"] = ""
    return {"status": "ok", "output": out, "closed": sess["closed"], "username": sess.get("username")}


@ras_client_router.post("/api/settings/ras/web-ssh/resize")
async def resize_pbx_web_ssh_session(request: Request, payload: Dict[str, Any] = Body(...)):
    """Dynamically resizes the Linux PTY window (TIOCSWINSZ) to match xterm.js rows and cols."""
    session_id = str(payload.get("session_id") or "")
    rows = int(payload.get("rows") or 30)
    cols = int(payload.get("cols") or 120)
    sess = _active_web_ssh_sessions.get(session_id)
    if sess and not sess.get("closed"):
        sess["rows"] = rows
        sess["cols"] = cols
        master_fd = sess.get("master_fd")
        if master_fd is not None:
            _set_pty_winsize(master_fd, rows, cols)
    return {"status": "ok"}


@ras_client_router.post("/api/settings/ras/web-ssh/stop")
async def stop_pbx_web_ssh_session(request: Request, payload: Dict[str, Any] = Body(...)):
    """Terminates an active Web SSH PTY session."""
    import signal
    session_id = str(payload.get("session_id") or "")
    sess = _active_web_ssh_sessions.pop(session_id, None)
    if sess:
        sess["closed"] = True
        proc = sess.get("proc")
        master_fd = sess.get("master_fd")
        if proc and proc.poll() is None:
            try:
                os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
            except Exception:
                try:
                    proc.terminate()
                except Exception:
                    pass
        if master_fd is not None:
            try:
                os.close(master_fd)
            except Exception:
                pass
    return {"status": "ok"}
