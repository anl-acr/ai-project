import asyncio
import base64
import datetime
import json
import os
import re
import subprocess
import time
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request, Response, WebSocket, WebSocketDisconnect
from sqlalchemy import func, or_, select
from starlette.websockets import WebSocketState

from license_center.backend.database import AsyncSessionLocal
from license_center.backend.license_generator import (
    compute_system_serial_number,
    generate_signed_license_key,
    generate_tenant_serial_number,
)
from license_center.backend.models import ClientServer

connect_hub_router = APIRouter()

RESERVED_SUBDOMAINS = {"panel", "www", "mail", "ftp", "ns1", "ns2", "api", "admin", "license"}


class ConnectedPBXSession:
    def __init__(self, websocket: WebSocket, subdomain: str, hardware_id: str):
        self.websocket = websocket
        self.subdomain = subdomain.lower().strip() or "merkez"
        self.hardware_id = hardware_id.strip() or "HW-UNKNOWN"
        self.hostname = ""
        self.version = ""
        self.remote_ssh_enabled = True
        self.ssh_tunnel_port: int = 0
        self.local_ips = []
        self.client_ip = ""
        self.connected_at = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        self.last_seen_at = time.time()
        self.pending_http: Dict[str, asyncio.Future] = {}
        self.ws_streams: Dict[str, WebSocket] = {}
        self.ws_open_waiters: Dict[str, asyncio.Future] = {}
        self.tcp_streams: Dict[str, WebSocket] = {}
        self.tcp_raw_writers: Dict[str, asyncio.StreamWriter] = {}
        self.tcp_open_waiters: Dict[str, asyncio.Future] = {}
        self.bytes_tx = 0
        self.bytes_rx = 0
        self.send_lock = asyncio.Lock()

    async def send_json(self, payload: Dict[str, Any]):
        raw = json.dumps(payload)
        self.bytes_tx += len(raw)
        async with self.send_lock:
            await self.websocket.send_text(raw)


# Active tunnels keyed by subdomain (e.g. "merkez") and hardware_id
ACTIVE_TUNNELS_BY_SUBDOMAIN: Dict[str, ConnectedPBXSession] = {}
ACTIVE_TUNNELS_BY_HWID: Dict[str, ConnectedPBXSession] = {}


async def push_ssh_control_to_pbx(
    hardware_id: Optional[str] = None,
    subdomain: Optional[str] = None,
    enabled: bool = True,
):
    """Pushes real-time SSH enable/disable command from Central License Server to the connected PBX."""
    sess = None
    if subdomain and subdomain.strip().lower() in ACTIVE_TUNNELS_BY_SUBDOMAIN:
        sess = ACTIVE_TUNNELS_BY_SUBDOMAIN.get(subdomain.strip().lower())
    if not sess and hardware_id and hardware_id.strip().upper() in ACTIVE_TUNNELS_BY_HWID:
        sess = ACTIVE_TUNNELS_BY_HWID.get(hardware_id.strip().upper())

    if sess:
        sess.remote_ssh_enabled = bool(enabled)
        try:
            await sess.send_json({
                "type": "RAS_SSH_CONTROL",
                "remote_ssh_enabled": bool(enabled),
                "message": (
                    "Merkez Lisans Sunucusu tarafından Santral SSH erişimi AKTİF edildi."
                    if enabled
                    else "Merkez Lisans Sunucusu tarafından Santral SSH erişimi KAPATILDI."
                ),
            })
        except Exception:
            pass


_HUB_RESERVED_HOSTS = {"www", "connect", "panel", "api", "hub"}


def extract_customer_subdomain_from_host(host_header: Optional[str]) -> str:
    """Extracts customer subdomain (e.g. 'home' from 'home.nornia.com.tr'), returning '' for IPs or reserved hub hosts."""
    if not host_header:
        return ""
    h_clean = host_header.split(",")[0].split(":")[0].strip().lower()
    if not h_clean or h_clean == "localhost":
        return ""
    parts = h_clean.split(".")
    if len(parts) >= 3 and not all(p.isdigit() for p in parts):
        cand = parts[0]
        if cand and cand not in _HUB_RESERVED_HOSTS:
            return cand
    return ""


def resolve_target_pbx_session(
    subdomain: Optional[str] = None,
    host_header: Optional[str] = None,
    cookie_target: Optional[str] = None,
) -> Optional[ConnectedPBXSession]:
    """
    Strictly resolves the target PBX tunnel session with ZERO cross-tenant fallback.
    - Explicit customer FQDN Host (e.g. home.nornia.com.tr) ALWAYS takes top priority and NEVER falls back to another PBX.
    - Explicit subdomain param (/connect/<sub>, Web SSH, TCP relay) ONLY matches that exact subdomain/HW-ID.
    - Cookie target is ONLY consulted on bare hub/IP URLs without a customer subdomain in Host.
    """
    host_sub = extract_customer_subdomain_from_host(host_header)
    if host_sub:
        return ACTIVE_TUNNELS_BY_SUBDOMAIN.get(host_sub)

    if subdomain:
        s_clean = subdomain.strip().lower()
        if s_clean in ACTIVE_TUNNELS_BY_SUBDOMAIN:
            return ACTIVE_TUNNELS_BY_SUBDOMAIN[s_clean]
        s_upper = subdomain.strip().upper()
        if s_upper in ACTIVE_TUNNELS_BY_HWID:
            return ACTIVE_TUNNELS_BY_HWID[s_upper]
        return None

    if cookie_target:
        c_clean = cookie_target.strip().lower()
        return ACTIVE_TUNNELS_BY_SUBDOMAIN.get(c_clean)

    return None


@connect_hub_router.get("/api/v1/connect/tunnels")
async def list_active_connect_tunnels():
    out = []
    for sub, sess in list(ACTIVE_TUNNELS_BY_SUBDOMAIN.items()):
        out.append({
            "subdomain": sess.subdomain,
            "hardware_id": sess.hardware_id,
            "hostname": sess.hostname,
            "version": sess.version,
            "client_ip": sess.client_ip,
            "local_ips": sess.local_ips,
            "remote_ssh_enabled": sess.remote_ssh_enabled,
            "connected_at": sess.connected_at,
            "last_seen_seconds_ago": max(0, int(round(time.time() - sess.last_seen_at))),
            "active_ws_streams": len(sess.ws_streams),
            "bytes_tx": sess.bytes_tx,
            "bytes_rx": sess.bytes_rx,
        })
    return {"status": "ok", "count": len(out), "tunnels": out}


async def check_subdomain_availability_db(subdomain: str, hardware_id: str = "") -> Dict[str, Any]:
    sub = re.sub(r"[^a-z0-9-_]", "", str(subdomain or "").strip().lower())
    hw = str(hardware_id or "").strip().upper()

    if not sub or len(sub) < 2:
        return {
            "available": False,
            "locked_to_this_hw": False,
            "subdomain": sub,
            "message": "Alt alan adı en az 2 karakter olmalıdır.",
        }

    if sub in RESERVED_SUBDOMAINS:
        return {
            "available": False,
            "locked_to_this_hw": False,
            "subdomain": sub,
            "message": f"'{sub}' sistem tarafından ayrılmış bir alt alan adıdır. Lütfen farklı bir ad seçiniz.",
        }

    # 1. Check live active tunnel in memory
    live_sess = ACTIVE_TUNNELS_BY_SUBDOMAIN.get(sub)
    if live_sess and live_sess.hardware_id.upper() != hw and hw not in ("", "HW-UNKNOWN"):
        return {
            "available": False,
            "locked_to_this_hw": False,
            "subdomain": sub,
            "owner_hardware_id": live_sess.hardware_id,
            "message": f"'{sub}.nornia.com.tr' şu anda başka bir aktif santral ({live_sess.hardware_id}) tarafından kullanılmaktadır.",
        }

    # 2. Check Central License Database (ClientServer)
    async with AsyncSessionLocal() as db:
        res = await db.execute(
            select(ClientServer).where(
                or_(
                    func.lower(ClientServer.connect_subdomain) == sub,
                    func.lower(ClientServer.tenant_code) == sub,
                    func.lower(ClientServer.domain_name) == f"{sub}.nornia.com.tr",
                )
            )
        )
        existing_clients = res.scalars().all()
        for c in existing_clients:
            c_hw = str(c.hardware_id or "").strip().upper()
            c_sub = str(c.connect_subdomain or "").strip().lower()
            if c_hw and c_hw not in ("UNBOUND", "BILINMIYOR", "BİLİNMİYOR", "HW-UNKNOWN"):
                if hw and c_hw == hw:
                    return {
                        "available": True,
                        "locked_to_this_hw": bool(c_sub == sub),
                        "subdomain": sub,
                        "owner_hardware_id": c_hw,
                        "client_id": c.id,
                        "message": f"'{sub}.nornia.com.tr' alt alan adı bu santrale ({c_hw}) tescillidir.",
                    }
                else:
                    return {
                        "available": False,
                        "locked_to_this_hw": False,
                        "subdomain": sub,
                        "owner_hardware_id": c_hw,
                        "message": f"'{sub}.nornia.com.tr' başka bir santral ({c.company_name} — {c_hw}) adına tescillidir! Lütfen farklı bir ad seçiniz.",
                    }

        # Also check if this hardware_id already has a DIFFERENT locked connect_subdomain in DB
        if hw and hw not in ("UNBOUND", "HW-UNKNOWN"):
            res_hw = await db.execute(
                select(ClientServer).where(func.upper(ClientServer.hardware_id) == hw)
            )
            hw_client = res_hw.scalars().first()
            if hw_client and hw_client.connect_subdomain:
                locked_s = hw_client.connect_subdomain.strip().lower()
                if locked_s and locked_s != sub:
                    return {
                        "available": False,
                        "locked_to_this_hw": True,
                        "locked_subdomain": locked_s,
                        "subdomain": sub,
                        "message": f"Bu santral ({hw}) Merkez Lisans Sunucusunda '{locked_s}.nornia.com.tr' adına kilitlenmiştir. Değiştirmek için önce Merkez Lisans Panelinden kaydı silmeniz gerekir.",
                    }

    return {
        "available": True,
        "locked_to_this_hw": False,
        "subdomain": sub,
        "owner_hardware_id": None,
        "message": f"'{sub}.nornia.com.tr' müsait ve bu santrale tescil edilebilir.",
    }


_ssl_provision_lock = asyncio.Lock()


async def ensure_subdomain_ssl_and_nginx(new_subdomain: str = ""):
    """
    Ensures Nginx routes *.nornia.com.tr as default_server on both 80 and 443 to 127.0.0.1:8050,
    and automatically expands the Let's Encrypt certificate to include any newly registered subdomain (e.g. app.nornia.com.tr).
    """
    if not os.path.exists("/etc/nginx/sites-available"):
        return

    async with _ssl_provision_lock:
        try:
            os.makedirs("/var/www/html/.well-known/acme-challenge", exist_ok=True)
            # Auto-discover active Let's Encrypt certificate directory (nornia.com.tr wildcard/SAN, panel.nornia.com.tr, etc.)
            cert_name = "nornia.com.tr"
            cert_dir = f"/etc/letsencrypt/live/{cert_name}"
            for cand_name in ("nornia.com.tr", "panel.nornia.com.tr", "connect.nornia.com.tr"):
                cand_dir = f"/etc/letsencrypt/live/{cand_name}"
                if os.path.exists(f"{cand_dir}/fullchain.pem") and os.path.exists(f"{cand_dir}/privkey.pem"):
                    cert_name = cand_name
                    cert_dir = cand_dir
                    break
            has_le_cert = os.path.exists(f"{cert_dir}/fullchain.pem") and os.path.exists(f"{cert_dir}/privkey.pem")
            ssl_cert = f"{cert_dir}/fullchain.pem" if has_le_cert else "/etc/nginx/ssl/nornia_connect.crt"
            ssl_key = f"{cert_dir}/privkey.pem" if has_le_cert else "/etc/nginx/ssl/nornia_connect.key"

            nginx_conf = f"""map $http_upgrade $connection_upgrade {{
    default upgrade;
    ''      close;
}}

server {{
    listen 80;
    server_name panel.nornia.com.tr;

    location /.well-known/acme-challenge/ {{
        root /var/www/html;
    }}

    location / {{
        return 301 https://$host$request_uri;
    }}
}}

server {{
    listen 443 ssl;
    server_name panel.nornia.com.tr;

    ssl_certificate {ssl_cert};
    ssl_certificate_key {ssl_key};
    ssl_protocols TLSv1.2 TLSv1.3;

    client_max_body_size 50M;

    location /api/v1/connect/web-ssh/ {{
        proxy_pass http://127.0.0.1:8050;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }}

    location / {{
        proxy_pass http://127.0.0.1:3050;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}
}}

server {{
    listen 80 default_server;
    server_name nornia.com.tr www.nornia.com.tr *.nornia.com.tr _;

    client_max_body_size 100M;

    location /.well-known/acme-challenge/ {{
        root /var/www/html;
    }}

    location /api/ {{
        proxy_pass http://127.0.0.1:8050;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $http_host;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }}

    location /ssh/ {{
        proxy_pass http://127.0.0.1:8050;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }}

    location / {{
        return 301 https://$host$request_uri;
    }}
}}

server {{
    listen 443 ssl default_server;
    server_name nornia.com.tr www.nornia.com.tr *.nornia.com.tr _;

    ssl_certificate {ssl_cert};
    ssl_certificate_key {ssl_key};
    ssl_protocols TLSv1.2 TLSv1.3;

    client_max_body_size 100M;

    location / {{
        proxy_pass http://127.0.0.1:8050;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $http_host;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }}
}}
"""
            cfg_path = "/etc/nginx/sites-available/nornia_connect_hub"
            current_txt = ""
            if os.path.exists(cfg_path):
                with open(cfg_path, "r", encoding="utf-8") as f:
                    current_txt = f.read()
            if current_txt != nginx_conf:
                with open(cfg_path, "w", encoding="utf-8") as f:
                    f.write(nginx_conf)
                await asyncio.to_thread(
                    subprocess.run,
                    ["systemctl", "reload", "nginx"],
                    capture_output=True,
                    timeout=5.0,
                    check=False,
                )

            # Check if new_subdomain needs to be added to Let's Encrypt certificate
            sub_clean = re.sub(r"[^a-z0-9-_]", "", str(new_subdomain or "").strip().lower())
            if sub_clean and has_le_cert:
                fqdn = f"{sub_clean}.nornia.com.tr"
                chk_proc = await asyncio.to_thread(
                    subprocess.run,
                    ["openssl", "x509", "-in", ssl_cert, "-noout", "-text"],
                    capture_output=True,
                    text=True,
                    timeout=4.0,
                    check=False,
                )
                cert_text = chk_proc.stdout or ""
                if "DNS:*.nornia.com.tr" not in cert_text and f"DNS:{fqdn}" not in cert_text:
                    # Preserve ONLY SAN domains already validated in this cert + the new subdomain
                    existing_sans = re.findall(r"DNS:([a-zA-Z0-9._-]+)", cert_text)
                    domains = []
                    for d_ex in existing_sans:
                        d_low = d_ex.strip().lower()
                        if d_low and not d_low.startswith("*.") and d_low not in domains:
                            domains.append(d_low)
                    for base_d in ("panel.nornia.com.tr", "connect.nornia.com.tr", fqdn):
                        if base_d not in domains:
                            domains.append(base_d)

                    cmd = [
                        "certbot",
                        "certonly",
                        "--webroot",
                        "-w",
                        "/var/www/html",
                        "--non-interactive",
                        "--agree-tos",
                        "--expand",
                        "--cert-name",
                        cert_name,
                    ]
                    for d in domains:
                        cmd.extend(["-d", d])

                    print(f"[Nornia Connect Hub] Yeni alt alan adı için SSL sertifikası genişletiliyor: {fqdn} (cert={cert_name}, domains={len(domains)})")
                    cb_res = await asyncio.to_thread(
                        subprocess.run,
                        cmd,
                        capture_output=True,
                        text=True,
                        timeout=60.0,
                        check=False,
                    )
                    if cb_res.returncode != 0:
                        print(f"[Nornia Connect Hub] Certbot genişletme hatası (rc={cb_res.returncode}): {(cb_res.stderr or cb_res.stdout or '')[-500:]}")
                    else:
                        print(f"[Nornia Connect Hub] SSL sertifikası başarıyla genişletildi: {fqdn}")
                    await asyncio.to_thread(
                        subprocess.run,
                        ["systemctl", "reload", "nginx"],
                        capture_output=True,
                        timeout=5.0,
                        check=False,
                    )
        except Exception as exc:
            print(f"[Nornia Connect Hub] Nginx/SSL otomatik güncelleme uyarısı: {exc}")


async def bind_subdomain_to_hardware_db(
    subdomain: str,
    hardware_id: str,
    hostname: str = "",
    client_ip: str = "",
    version: str = "",
) -> Dict[str, Any]:
    """Verifies availability and permanently binds (locks) subdomain <-> hardware_id in Central License DB."""
    check = await check_subdomain_availability_db(subdomain, hardware_id)
    if not check.get("available"):
        return {"ok": False, "reason": check.get("message") or "Alt alan adı kullanımda."}

    sub = check["subdomain"]
    hw = str(hardware_id or "").strip().upper()
    if not hw or hw == "HW-UNKNOWN":
        return {"ok": True, "subdomain": sub, "locked": False}

    async with AsyncSessionLocal() as db:
        # Find all existing client rows for this hardware_id (multi-tenant host) or unbound tenant_code
        res = await db.execute(
            select(ClientServer).where(
                or_(
                    func.upper(ClientServer.hardware_id) == hw,
                    func.lower(ClientServer.connect_subdomain) == sub,
                    func.lower(ClientServer.tenant_code) == sub,
                )
            )
        )
        clients = res.scalars().all()
        sys_sn = compute_system_serial_number(hw)

        central_ssh_enabled = True
        if not clients:
            t_sn = generate_tenant_serial_number(sub, 100)
            exp_date = "2027-12-31"
            gen_key = generate_signed_license_key(sub, exp_date, hw)
            client = ClientServer(
                company_name=f"Nornia Santral ({hostname or sub})",
                tenant_code=sub,
                tenant_serial_number=t_sn,
                system_serial_number=sys_sn,
                hardware_id=hw,
                connect_subdomain=sub,
                remote_ssh_enabled=True,
                domain_name=f"{sub}.nornia.com.tr",
                ip_address=client_ip,
                status="active",
                current_license_key=gen_key,
                license_expires_at=exp_date,
                software_version=version or None,
                last_heartbeat_at=datetime.datetime.utcnow(),
            )
            db.add(client)
        else:
            for client in clients:
                if client.remote_ssh_enabled is not None:
                    central_ssh_enabled = bool(client.remote_ssh_enabled)
                else:
                    client.remote_ssh_enabled = True
                client.hardware_id = hw
                client.system_serial_number = sys_sn
                client.connect_subdomain = sub
                client.domain_name = f"{sub}.nornia.com.tr"
                if client_ip:
                    client.ip_address = client_ip
                if version:
                    client.software_version = version
                client.last_heartbeat_at = datetime.datetime.utcnow()

        await db.commit()

    asyncio.create_task(ensure_subdomain_ssl_and_nginx(sub))
    return {"ok": True, "subdomain": sub, "locked": True, "remote_ssh_enabled": central_ssh_enabled}


async def notify_and_unbind_pbx_tunnel(hardware_id: Optional[str] = None, subdomain: Optional[str] = None):
    """Notifies a connected PBX that its registration/subdomain lock was removed on Central License Server."""
    sess = None
    if subdomain and subdomain.strip().lower() in ACTIVE_TUNNELS_BY_SUBDOMAIN:
        sess = ACTIVE_TUNNELS_BY_SUBDOMAIN.pop(subdomain.strip().lower(), None)
    if not sess and hardware_id and hardware_id.strip().upper() in ACTIVE_TUNNELS_BY_HWID:
        sess = ACTIVE_TUNNELS_BY_HWID.pop(hardware_id.strip().upper(), None)

    if sess:
        ACTIVE_TUNNELS_BY_SUBDOMAIN.pop(sess.subdomain, None)
        ACTIVE_TUNNELS_BY_HWID.pop(sess.hardware_id, None)
        try:
            await sess.send_json({
                "type": "RAS_UNBOUND",
                "message": "Merkez Lisans Sunucusu üzerinden santral kaydı / alt alan adı kilidi kaldırıldı. Yeni bir alt alan adı tanımlayabilirsiniz.",
            })
            await sess.websocket.close(code=1000)
        except Exception:
            pass


async def notify_pbx_license_sync(hardware_id: Optional[str] = None, subdomain: Optional[str] = None) -> bool:
    """Pushes an instant RAS_LICENSE_SYNC event to the connected PBX over the tunnel so new module entitlements & quotas apply immediately."""
    sess = None
    if subdomain and subdomain.strip().lower() in ACTIVE_TUNNELS_BY_SUBDOMAIN:
        sess = ACTIVE_TUNNELS_BY_SUBDOMAIN.get(subdomain.strip().lower())
    if not sess and hardware_id and hardware_id.strip().upper() in ACTIVE_TUNNELS_BY_HWID:
        sess = ACTIVE_TUNNELS_BY_HWID.get(hardware_id.strip().upper())

    if sess:
        try:
            await sess.send_json({"type": "RAS_LICENSE_SYNC", "ts": time.time()})
            return True
        except Exception:
            pass
    return False


async def trigger_pbx_ota_update(
    hardware_id: Optional[str] = None,
    subdomain: Optional[str] = None,
    triggered_by: str = "admin",
    target_version: str = "",
    target_commit: str = "",
    mode: str = "now",
    hub_url: str = "",
) -> bool:
    """Sends a RAS_OTA_UPDATE command over the active Nornia Connect tunnel to remotely pull, build, and restart the PBX."""
    sess = None
    if subdomain and subdomain.strip().lower() in ACTIVE_TUNNELS_BY_SUBDOMAIN:
        sess = ACTIVE_TUNNELS_BY_SUBDOMAIN.get(subdomain.strip().lower())
    if not sess and hardware_id and hardware_id.strip().upper() in ACTIVE_TUNNELS_BY_HWID:
        sess = ACTIVE_TUNNELS_BY_HWID.get(hardware_id.strip().upper())

    if sess:
        try:
            await sess.send_json({
                "type": "RAS_OTA_UPDATE",
                "triggered_by": triggered_by,
                "target_version": str(target_version or "").strip(),
                "target_commit": str(target_commit or "").strip(),
                "mode": str(mode or "now").strip(),
                "hub_url": str(hub_url or "").strip(),
                "ts": time.time(),
            })
            return True
        except Exception:
            pass
    return False


async def trigger_pbx_license_sync(hardware_id: Optional[str] = None, subdomain: Optional[str] = None) -> bool:
    """Sends a RAS_LICENSE_SYNC command over the active Nornia Connect tunnel so the PBX pulls new license & quotas immediately."""
    sess = None
    if subdomain and subdomain.strip().lower() in ACTIVE_TUNNELS_BY_SUBDOMAIN:
        sess = ACTIVE_TUNNELS_BY_SUBDOMAIN.get(subdomain.strip().lower())
    if not sess and hardware_id and hardware_id.strip().upper() in ACTIVE_TUNNELS_BY_HWID:
        sess = ACTIVE_TUNNELS_BY_HWID.get(hardware_id.strip().upper())

    if sess:
        try:
            await sess.send_json({
                "type": "RAS_LICENSE_SYNC",
                "ts": time.time(),
            })
            return True
        except Exception:
            pass
    return False


async def fetch_pbx_live_system_stats(hardware_id: Optional[str] = None, subdomain: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Queries /api/system/stats on the remote PBX through the active Nornia Connect WebSocket tunnel in real-time."""
    sess = None
    if subdomain and subdomain.strip().lower() in ACTIVE_TUNNELS_BY_SUBDOMAIN:
        sess = ACTIVE_TUNNELS_BY_SUBDOMAIN.get(subdomain.strip().lower())
    if not sess and hardware_id and hardware_id.strip().upper() in ACTIVE_TUNNELS_BY_HWID:
        sess = ACTIVE_TUNNELS_BY_HWID.get(hardware_id.strip().upper())

    if not sess:
        return None

    req_id = f"stat-{uuid.uuid4().hex[:10]}"
    loop = asyncio.get_running_loop()
    fut = loop.create_future()
    sess.pending_http[req_id] = fut
    try:
        await sess.send_json({
            "type": "HTTP_REQ",
            "req_id": req_id,
            "method": "GET",
            "path": "/api/system/stats",
            "query": "",
            "headers": {"accept": "application/json"},
            "public_host": f"{sess.subdomain}.nornia.com.tr",
            "public_proto": "https",
            "body_b64": "",
        })
        res_msg = await asyncio.wait_for(fut, timeout=3.5)
        raw_bytes = base64.b64decode(res_msg.get("body_b64") or "")
        return json.loads(raw_bytes.decode("utf-8"))
    except Exception:
        sess.pending_http.pop(req_id, None)
        return None


@connect_hub_router.get("/api/v1/connect/check-subdomain")
async def check_subdomain_endpoint(subdomain: str, hardware_id: str = ""):
    return await check_subdomain_availability_db(subdomain=subdomain, hardware_id=hardware_id)


@connect_hub_router.websocket("/api/v1/ras/tunnel")
async def pbx_ras_tunnel_endpoint(websocket: WebSocket):
    await websocket.accept()
    subdomain = (websocket.query_params.get("subdomain") or websocket.headers.get("x-ras-subdomain") or "merkez").strip().lower()
    hw_id = (websocket.query_params.get("hardware_id") or websocket.headers.get("x-hardware-id") or "HW-UNKNOWN").strip().upper()

    session = ConnectedPBXSession(websocket=websocket, subdomain=subdomain, hardware_id=hw_id)
    xff = websocket.headers.get("x-forwarded-for") or websocket.headers.get("x-real-ip")
    session.client_ip = xff.split(",")[0].strip() if xff else (websocket.client.host if websocket.client else "unknown")

    # Initial check before registering tunnel
    pre_check = await check_subdomain_availability_db(subdomain, hw_id)
    if not pre_check.get("available"):
        await session.send_json({
            "type": "RAS_REJECTED",
            "reason": pre_check.get("message") or f"'{subdomain}' alt alan adı başka bir santral tarafından kullanılmaktadır.",
            "locked_subdomain": pre_check.get("locked_subdomain"),
        })
        await websocket.close(code=1008)
        return

    ACTIVE_TUNNELS_BY_SUBDOMAIN[session.subdomain] = session
    ACTIVE_TUNNELS_BY_HWID[session.hardware_id] = session
    print(f"[Nornia Connect Hub] Santral tüneli bağlandı: subdomain={session.subdomain}, hw={session.hardware_id}, ip={session.client_ip}")

    try:
        while True:
            raw_msg = await websocket.receive_text()
            session.last_seen_at = time.time()
            session.bytes_rx += len(raw_msg)
            try:
                msg = json.loads(raw_msg)
            except Exception:
                continue

            mtype = msg.get("type")
            if mtype == "RAS_REGISTER":
                session.hostname = str(msg.get("hostname") or "")
                session.version = str(msg.get("version") or "")
                session.local_ips = msg.get("local_ips") or []
                req_sub = str(msg.get("subdomain") or session.subdomain).strip().lower()
                req_hw = str(msg.get("hardware_id") or session.hardware_id).strip().upper()

                bind_res = await bind_subdomain_to_hardware_db(
                    subdomain=req_sub,
                    hardware_id=req_hw,
                    hostname=session.hostname,
                    client_ip=session.client_ip,
                    version=session.version,
                )
                if not bind_res.get("ok"):
                    await session.send_json({
                        "type": "RAS_REJECTED",
                        "reason": bind_res.get("reason") or "Alt alan adı çakışması nedeniyle bağlantı reddedildi.",
                    })
                    await websocket.close(code=1008)
                    return

                if req_sub != session.subdomain:
                    ACTIVE_TUNNELS_BY_SUBDOMAIN.pop(session.subdomain, None)
                    session.subdomain = req_sub
                    ACTIVE_TUNNELS_BY_SUBDOMAIN[session.subdomain] = session
                session.hardware_id = req_hw
                ACTIVE_TUNNELS_BY_HWID[session.hardware_id] = session
                session.remote_ssh_enabled = bool(bind_res.get("remote_ssh_enabled", True))

                # Auto-provision WireGuard + Kamailio SIP/RTP Edge if PBX sent its WG public key
                sip_edge_cfg = {"enabled": False}
                req_wg_pubkey = str(msg.get("wg_public_key") or "").strip()
                if req_wg_pubkey:
                    try:
                        from license_center.backend.database import AsyncSessionLocal as _EdgeSess
                        from license_center.backend.sip_edge_manager import provision_pbx_sip_edge
                        async with _EdgeSess() as edge_db:
                            sip_edge_cfg = await provision_pbx_sip_edge(
                                edge_db,
                                subdomain=session.subdomain,
                                hardware_id=session.hardware_id,
                                wg_public_key=req_wg_pubkey,
                            )
                    except Exception as ex_edge:
                        print(f"[Nornia SIP Edge Provision Warning]: {ex_edge}")

                await session.send_json({
                    "type": "RAS_WELCOME",
                    "subdomain": session.subdomain,
                    "status": "connected",
                    "subdomain_locked": True,
                    "remote_ssh_enabled": session.remote_ssh_enabled,
                    "public_ras_url": f"https://{session.subdomain}.nornia.com.tr",
                    "wss_sip_url": f"wss://{session.subdomain}.nornia.com.tr/ras-sip-ws",
                    "sip_edge": sip_edge_cfg,
                })

            elif mtype == "PING":
                await session.send_json({
                    "type": "PONG",
                    "ts": msg.get("ts"),
                    "remote_ssh_enabled": session.remote_ssh_enabled,
                })

            elif mtype == "HTTP_RES":
                req_id = str(msg.get("req_id") or "")
                fut = session.pending_http.pop(req_id, None)
                if fut and not fut.done():
                    fut.set_result(msg)

            elif mtype == "WS_OPEN_ACK":
                stream_id = str(msg.get("stream_id") or "")
                w_fut = session.ws_open_waiters.pop(stream_id, None)
                if w_fut and not w_fut.done():
                    w_fut.set_result(bool(msg.get("ok", True)))

            elif mtype == "WS_DATA":
                stream_id = str(msg.get("stream_id") or "")
                ext_ws = session.ws_streams.get(stream_id)
                if ext_ws and ext_ws.client_state == WebSocketState.CONNECTED:
                    try:
                        if msg.get("is_binary"):
                            await ext_ws.send_bytes(base64.b64decode(msg.get("data") or ""))
                        else:
                            await ext_ws.send_text(str(msg.get("data") or ""))
                    except Exception:
                        pass

            elif mtype == "WS_CLOSE":
                stream_id = str(msg.get("stream_id") or "")
                w_fut = session.ws_open_waiters.pop(stream_id, None)
                if w_fut and not w_fut.done():
                    w_fut.set_result(False)
                ext_ws = session.ws_streams.pop(stream_id, None)
                if ext_ws:
                    try:
                        await ext_ws.close()
                    except Exception:
                        pass

            elif mtype in ("TCP_OPEN_ACK", "TCP_DATA", "TCP_CLOSE"):
                stream_id = str(msg.get("stream_id") or "")
                if mtype == "TCP_OPEN_ACK":
                    t_fut = session.tcp_open_waiters.pop(stream_id, None)
                    if t_fut and not t_fut.done():
                        t_fut.set_result(bool(msg.get("ok", True)))
                elif mtype == "TCP_DATA":
                    raw_writer = session.tcp_raw_writers.get(stream_id)
                    if raw_writer:
                        try:
                            raw_bytes = base64.b64decode(msg.get("data_b64") or "")
                            if raw_bytes:
                                raw_writer.write(raw_bytes)
                                await raw_writer.drain()
                        except Exception:
                            pass
                elif mtype == "TCP_CLOSE":
                    t_fut = session.tcp_open_waiters.pop(stream_id, None)
                    if t_fut and not t_fut.done():
                        t_fut.set_result(False)
                    raw_writer = session.tcp_raw_writers.pop(stream_id, None)
                    if raw_writer:
                        try:
                            raw_writer.close()
                        except Exception:
                            pass

                ssh_ws = session.tcp_streams.get(stream_id)
                if ssh_ws and ssh_ws.client_state == WebSocketState.CONNECTED:
                    try:
                        await ssh_ws.send_text(json.dumps(msg))
                    except Exception:
                        pass
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        print(f"[Nornia Connect Hub] Tünel hatası ({session.subdomain}): {exc}")
    finally:
        if ACTIVE_TUNNELS_BY_SUBDOMAIN.get(session.subdomain) is session:
            ACTIVE_TUNNELS_BY_SUBDOMAIN.pop(session.subdomain, None)
        if ACTIVE_TUNNELS_BY_HWID.get(session.hardware_id) is session:
            ACTIVE_TUNNELS_BY_HWID.pop(session.hardware_id, None)
        for fut in session.pending_http.values():
            if not fut.done():
                fut.cancel()
        print(f"[Nornia Connect Hub] Santral tüneli kapandı: subdomain={session.subdomain}")


@connect_hub_router.websocket("/ras-sip-ws")
@connect_hub_router.websocket("/ws")
async def relay_client_websocket_to_pbx(websocket: WebSocket):
    """Relays browser/mobile/desktop SIP WebRTC (/ras-sip-ws) or Event (/ws) WebSockets through the Nornia Connect tunnel."""
    path = websocket.scope.get("path") or "/ws"
    is_sip = path.startswith("/ras-sip-ws")
    req_sub = websocket.query_params.get("connect_target")
    cookie_sub = websocket.cookies.get("nornia_connect_target")
    host_hdr = websocket.headers.get("x-forwarded-host") or websocket.headers.get("host") or ""

    session = resolve_target_pbx_session(subdomain=req_sub, host_header=host_hdr, cookie_target=cookie_sub)
    if not session:
        await websocket.close(code=1013)
        return

    if is_sip:
        await websocket.accept(subprotocol="sip")
    else:
        await websocket.accept()

    stream_id = f"ws-{uuid.uuid4().hex[:12]}"
    session.ws_streams[stream_id] = websocket
    loop = asyncio.get_running_loop()
    ack_fut = loop.create_future()
    session.ws_open_waiters[stream_id] = ack_fut

    try:
        await session.send_json({
            "type": "WS_OPEN",
            "stream_id": stream_id,
            "path": path,
            "target": "sip" if is_sip else "events",
            "subprotocol": "sip" if is_sip else "",
        })
        try:
            ok = await asyncio.wait_for(ack_fut, timeout=8.0)
            if not ok:
                await websocket.close(code=1011)
                return
        except asyncio.TimeoutError:
            await websocket.close(code=1011)
            return

        while True:
            msg = await websocket.receive()
            if msg.get("type") == "websocket.disconnect":
                break
            if "bytes" in msg and msg["bytes"] is not None:
                await session.send_json({
                    "type": "WS_DATA",
                    "stream_id": stream_id,
                    "is_binary": True,
                    "data": base64.b64encode(msg["bytes"]).decode("ascii"),
                })
            elif "text" in msg and msg["text"] is not None:
                await session.send_json({
                    "type": "WS_DATA",
                    "stream_id": stream_id,
                    "is_binary": False,
                    "data": msg["text"],
                })
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        session.ws_streams.pop(stream_id, None)
        session.ws_open_waiters.pop(stream_id, None)
        try:
            await session.send_json({"type": "WS_CLOSE", "stream_id": stream_id})
        except Exception:
            pass


@connect_hub_router.get("/ssh/{subdomain}")
@connect_hub_router.get("/api/v1/connect/ssh-proxy/{subdomain}")
async def get_zero_port_ssh_proxy_script(subdomain: str):
    """
    Returns a pure Python stdlib WebSocket-to-stdio SSH ProxyCommand script that tunnels native OpenSSH
    directly over Port 443 (WSS) through Nornia Connect Hub without needing Port 2222 open on any firewall.
    Usage on Mac/Linux:
    ssh -o ProxyCommand='python3 -c "import urllib.request; exec(urllib.request.urlopen(\"https://connect.nornia.com.tr/ssh/app\").read())"' aida@app.nornia.com.tr
    """
    sub = re.sub(r"[^a-z0-9-_]", "", str(subdomain or "app").strip().lower()) or "app"
    script = f"""import base64, json, os, select, socket, ssl, struct, sys

HOST = "connect.nornia.com.tr"
PORT = 443
PATH = "/api/v1/connect/tcp-relay/{sub}/22"

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
raw_sock = socket.create_connection((HOST, PORT), timeout=10)
sock = ctx.wrap_socket(raw_sock, server_hostname=HOST)

req = (
    f"GET {{PATH}} HTTP/1.1\\r\\n"
    f"Host: {{HOST}}\\r\\n"
    "Upgrade: websocket\\r\\n"
    "Connection: Upgrade\\r\\n"
    "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\\r\\n"
    "Sec-WebSocket-Version: 13\\r\\n\\r\\n"
)
sock.sendall(req.encode("ascii"))

buf = b""
while b"\\r\\n\\r\\n" not in buf:
    chunk = sock.recv(4096)
    if not chunk:
        sys.exit(1)
    buf += chunk

hdr_end = buf.index(b"\\r\\n\\r\\n") + 4
if b" 101 " not in buf[:hdr_end].split(b"\\r\\n")[0]:
    sys.stderr.write("Nornia Connect SSH Tuneli Aktif Degil (503).\\n")
    sys.exit(1)
leftover = buf[hdr_end:]

def recv_exact(n):
    global leftover
    while len(leftover) < n:
        c = sock.recv(16384)
        if not c:
            sys.exit(0)
        leftover += c
    res, leftover = leftover[:n], leftover[n:]
    return res

def send_ws_text(txt_bytes):
    L = len(txt_bytes)
    if L < 126:
        hdr = bytes([0x81, 0x80 | L]) + b"\\x00\\x00\\x00\\x00"
    elif L < 65536:
        hdr = bytes([0x81, 0x80 | 126]) + struct.pack("!H", L) + b"\\x00\\x00\\x00\\x00"
    else:
        hdr = bytes([0x81, 0x80 | 127]) + struct.pack("!Q", L) + b"\\x00\\x00\\x00\\x00"
    sock.sendall(hdr + txt_bytes)

stdin_fd = sys.stdin.fileno()
stdout_fd = sys.stdout.fileno()

while True:
    if leftover:
        rlist = [sock]
    else:
        rlist, _, _ = select.select([stdin_fd, sock], [], [], 30.0)
    if stdin_fd in rlist:
        data = os.read(stdin_fd, 16384)
        if not data:
            break
        payload = json.dumps({{"type": "TCP_DATA", "data_b64": base64.b64encode(data).decode("ascii")}}).encode("utf-8")
        send_ws_text(payload)
    if sock in rlist or leftover:
        b0, b1 = recv_exact(2)
        opcode = b0 & 0x0F
        masked = b1 & 0x80
        length = b1 & 0x7F
        if length == 126:
            length = struct.unpack("!H", recv_exact(2))[0]
        elif length == 127:
            length = struct.unpack("!Q", recv_exact(8))[0]
        mask_key = recv_exact(4) if masked else None
        raw_payload = recv_exact(length)
        if mask_key:
            raw_payload = bytes(b ^ mask_key[i % 4] for i, b in enumerate(raw_payload))
        if opcode == 0x8:
            break
        elif opcode == 0x9:
            sock.sendall(bytes([0x8A, 0x80]) + b"\\x00\\x00\\x00\\x00")
        elif opcode == 0x1:
            try:
                m = json.loads(raw_payload.decode("utf-8"))
                if m.get("type") == "TCP_DATA" and m.get("data_b64"):
                    os.write(stdout_fd, base64.b64decode(m["data_b64"]))
                elif m.get("type") == "TCP_CLOSE":
                    break
            except Exception:
                pass
"""
    return Response(content=script, media_type="text/plain")


@connect_hub_router.websocket("/api/v1/connect/tcp-relay/{subdomain}/{port}")
async def relay_tcp_stream_to_pbx(websocket: WebSocket, subdomain: str, port: int):
    """Relays TCP streams (e.g. port 22 SSH) over WebSocket for remote technical support."""
    session = resolve_target_pbx_session(subdomain=subdomain)
    if not session:
        await websocket.close(code=1013)
        return
    await websocket.accept()
    stream_id = f"tcp-{uuid.uuid4().hex[:12]}"
    session.tcp_streams[stream_id] = websocket
    try:
        await session.send_json({
            "type": "TCP_OPEN",
            "stream_id": stream_id,
            "port": int(port),
        })
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            if data.get("type") == "TCP_DATA":
                await session.send_json({
                    "type": "TCP_DATA",
                    "stream_id": stream_id,
                    "data_b64": data.get("data_b64") or "",
                })
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        session.tcp_streams.pop(stream_id, None)
        try:
            await session.send_json({"type": "TCP_CLOSE", "stream_id": stream_id})
        except Exception:
            pass


@connect_hub_router.api_route("/api/v1/connect/pbx-terminal/{subdomain}/{action}", methods=["GET", "POST"])
async def proxy_pbx_web_terminal_over_tunnel(request: Request, subdomain: str, action: str):
    """Forwards zero-port Web SSH Terminal HTTP requests from Central License Panel directly through the Nornia Connect tunnel to the PBX."""
    session = resolve_target_pbx_session(subdomain=subdomain)
    if not session:
        return Response(
            content=json.dumps({
                "status": "error",
                "detail": f"'{subdomain}.nornia.com.tr' için aktif Nornia Connect tüneli bulunamadı.",
            }),
            status_code=503,
            media_type="application/json",
        )
    if not session.remote_ssh_enabled:
        return Response(
            content=json.dumps({
                "status": "error",
                "detail": "Merkez Lisans Sunucusu tarafından bu santralin SSH erişimi kapatılmıştır. Önce kart üzerindeki SSH şalterini açınız.",
            }),
            status_code=403,
            media_type="application/json",
        )
    return await forward_http_request_to_pbx(request, f"connect/{subdomain}/api/settings/ras/web-ssh/{action}")


@connect_hub_router.websocket("/api/v1/connect/web-ssh/{subdomain}")
async def web_ssh_interactive_terminal(websocket: WebSocket, subdomain: str):
    """
    Zero-Port Browser-based interactive SSH terminal over Nornia Connect tunnel.
    Uses a temporary in-memory loopback socket (127.0.0.1:0) closed immediately when the session ends.
    """
    import pty
    import signal
    from license_center.backend.main import verify_master_session_token

    ws_token = websocket.query_params.get("token") or ""
    auth_hdr = str(websocket.headers.get("authorization") or "").strip()
    if not ws_token and auth_hdr.lower().startswith("bearer "):
        ws_token = auth_hdr[7:].strip()
    if not verify_master_session_token(ws_token):
        await websocket.close(code=4401, reason="Unauthorized")
        return

    await websocket.accept()
    session = resolve_target_pbx_session(subdomain=subdomain)
    if not session:
        await websocket.send_text(
            json.dumps({
                "type": "output",
                "data": f"\r\n❌ HATA: '{subdomain}.nornia.com.tr' için aktif Nornia Connect tüneli bulunamadı.\r\n",
            })
        )
        await websocket.close()
        return

    if not session.remote_ssh_enabled:
        await websocket.send_text(
            json.dumps({
                "type": "output",
                "data": "\r\n❌ HATA: Merkez Lisans Sunucusu tarafından bu santralin SSH erişimi kapatılmıştır.\r\n",
            })
        )
        await websocket.close()
        return

    ssh_user = re.sub(r"[^a-zA-Z0-9._-]", "", websocket.query_params.get("user") or "aida") or "aida"

    async def _handle_ephemeral_ssh_loopback(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        stream_id = f"tcp-{uuid.uuid4().hex[:12]}"
        loop = asyncio.get_running_loop()
        ack_fut = loop.create_future()
        session.tcp_raw_writers[stream_id] = writer
        session.tcp_open_waiters[stream_id] = ack_fut
        try:
            await session.send_json({"type": "TCP_OPEN", "stream_id": stream_id, "port": 22})
            ok = await asyncio.wait_for(ack_fut, timeout=8.0)
            if not ok:
                return
            while True:
                chunk = await reader.read(16384)
                if not chunk:
                    break
                await session.send_json({
                    "type": "TCP_DATA",
                    "stream_id": stream_id,
                    "data_b64": base64.b64encode(chunk).decode("ascii"),
                })
        except Exception:
            pass
        finally:
            session.tcp_raw_writers.pop(stream_id, None)
            session.tcp_open_waiters.pop(stream_id, None)
            try:
                await session.send_json({"type": "TCP_CLOSE", "stream_id": stream_id})
            except Exception:
                pass
            try:
                writer.close()
            except Exception:
                pass

    ephemeral_srv = await asyncio.start_server(_handle_ephemeral_ssh_loopback, host="127.0.0.1", port=0)
    ephemeral_port = ephemeral_srv.sockets[0].getsockname()[1]

    await websocket.send_text(
        json.dumps({
            "type": "output",
            "data": f"🔒 Nornia Connect Sıfır-Port Web SSH Tüneli ({session.subdomain}.nornia.com.tr | HW: {session.hardware_id})\r\n"
                    f"⚡ HTTPS/WSS Tüneli ➔ Santral Yerel SSH ({ssh_user}@{session.hostname or session.subdomain})\r\n"
                    f"--------------------------------------------------------------------------------\r\n",
        })
    )

    master_fd, slave_fd = pty.openpty()
    proc = None
    stop_flag = False

    try:
        env = dict(os.environ)
        env["TERM"] = "xterm-256color"
        proc = subprocess.Popen(
            [
                "ssh",
                "-tt",
                "-o", "StrictHostKeyChecking=no",
                "-o", "UserKnownHostsFile=/dev/null",
                "-o", "LogLevel=ERROR",
                "-o", "ConnectTimeout=10",
                "-p", str(ephemeral_port),
                f"{ssh_user}@127.0.0.1",
            ],
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            close_fds=True,
            env=env,
            preexec_fn=os.setsid,
        )
        os.close(slave_fd)
        slave_fd = -1

        async def _read_pty_loop():
            nonlocal stop_flag
            while not stop_flag:
                try:
                    data = await asyncio.to_thread(os.read, master_fd, 4096)
                    if not data:
                        break
                    text = data.decode("utf-8", errors="replace")
                    await websocket.send_text(json.dumps({"type": "output", "data": text}))
                except OSError:
                    break
                except Exception:
                    break
            stop_flag = True
            try:
                await websocket.send_text(json.dumps({"type": "output", "data": "\r\n[SSH Oturumu Sonlandı]\r\n"}))
                await websocket.close()
            except Exception:
                pass

        reader_task = asyncio.create_task(_read_pty_loop())

        while not stop_flag:
            raw_msg = await websocket.receive_text()
            try:
                m = json.loads(raw_msg)
            except Exception:
                m = {"type": "input", "data": raw_msg}

            if m.get("type") == "input":
                inp = str(m.get("data") or "")
                if inp:
                    await asyncio.to_thread(os.write, master_fd, inp.encode("utf-8"))
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        stop_flag = True
        try:
            ephemeral_srv.close()
        except Exception:
            pass
        if slave_fd >= 0:
            try:
                os.close(slave_fd)
            except Exception:
                pass
        if proc and proc.poll() is None:
            try:
                os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
            except Exception:
                try:
                    proc.terminate()
                except Exception:
                    pass
        try:
            os.close(master_fd)
        except Exception:
            pass


async def forward_http_request_to_pbx(request: Request, full_path: str) -> Response:
    """Forwards an incoming HTTP request through the Nornia Connect tunnel to the target PBX."""
    req_sub = request.query_params.get("connect_target")
    cookie_sub = request.cookies.get("nornia_connect_target")
    host_hdr = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
    host_sub = extract_customer_subdomain_from_host(host_hdr)

    # Support explicit /connect/<subdomain>/... prefix
    clean_path = f"/{full_path.lstrip('/')}"
    if clean_path.startswith("/connect/"):
        parts = clean_path.split("/", 3)
        if len(parts) >= 3 and parts[2]:
            req_sub = parts[2]
            clean_path = f"/{parts[3]}" if len(parts) >= 4 else "/"

    # Explicit /connect/<sub> (used by Central Panel Web SSH proxy) takes precedence over panel host;
    # otherwise customer FQDN Host (home.nornia.com.tr vs app.nornia.com.tr) is strictly authoritative.
    effective_host_hdr = "" if (req_sub and full_path.lstrip("/").startswith("connect/")) else host_hdr
    session = resolve_target_pbx_session(subdomain=req_sub, host_header=effective_host_hdr, cookie_target=cookie_sub)
    if not session:
        target_label = f"{host_sub}.nornia.com.tr" if host_sub else (f"{req_sub}.nornia.com.tr" if req_sub else (host_hdr.split(":")[0] or "Nornia Connect"))
        html_wait = f"""<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>{target_label} — Santral Tüneli Bekleniyor</title>
  <meta http-equiv="refresh" content="5" />
  <style>
    body {{ background: #090d16; color: #f8fafc; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }}
    .card {{ background: #111827; border: 1px solid #1e293b; border-radius: 20px; padding: 36px; max-width: 520px; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }}
    .badge {{ display: inline-block; padding: 6px 14px; border-radius: 99px; background: rgba(245, 158, 11, 0.15); color: #fbbf24; font-size: 12px; font-weight: 700; margin-bottom: 16px; }}
    h2 {{ margin: 0 0 10px; font-size: 20px; }}
    p {{ color: #94a3b8; font-size: 13px; line-height: 1.6; }}
    code {{ background: #1e293b; color: #e2e8f0; padding: 2px 7px; border-radius: 6px; font-size: 12px; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">● NORNIA CONNECT BULUT KÖPRÜSÜ</div>
    <h2>Santral Tüneli Çevrimdışı</h2>
    <p><code>{target_label}</code> adresine bağlı Nornia Santrali şu an bulut köprüsüne bağlı değil veya yeniden başlatılıyor. Santral bağlandığında bu sayfa otomatik olarak açılacaktır.</p>
  </div>
</body>
</html>"""
        return Response(content=html_wait, status_code=503, media_type="text/html", headers={"Cache-Control": "no-store"})

    req_id = f"req-{uuid.uuid4().hex[:12]}"
    body_bytes = await request.body()
    headers_dict = {k: v for k, v in request.headers.items()}
    public_proto = request.headers.get("x-forwarded-proto") or request.url.scheme or "http"

    loop = asyncio.get_running_loop()
    fut = loop.create_future()
    session.pending_http[req_id] = fut

    try:
        await session.send_json({
            "type": "HTTP_REQ",
            "req_id": req_id,
            "method": request.method,
            "path": clean_path,
            "query": str(request.url.query or ""),
            "headers": headers_dict,
            "public_host": host_hdr,
            "public_proto": public_proto,
            "body_b64": base64.b64encode(body_bytes).decode("ascii") if body_bytes else "",
        })
        res_msg = await asyncio.wait_for(fut, timeout=32.0)
    except asyncio.TimeoutError:
        session.pending_http.pop(req_id, None)
        return Response(
            content=json.dumps({"detail": "Nornia Connect tünel yanıt zaman aşımı (32s)."}),
            status_code=504,
            media_type="application/json",
        )
    except Exception as exc:
        session.pending_http.pop(req_id, None)
        return Response(
            content=json.dumps({"detail": f"Nornia Connect tünel hatası: {exc}"}),
            status_code=502,
            media_type="application/json",
        )

    resp_body = base64.b64decode(res_msg.get("body_b64") or "")
    resp_headers = dict(res_msg.get("headers") or {})
    response = Response(
        content=resp_body,
        status_code=int(res_msg.get("status_code") or 200),
        headers=resp_headers,
    )
    if req_sub and not host_sub:
        response.set_cookie("nornia_connect_target", req_sub, path="/", httponly=False)
    return response
