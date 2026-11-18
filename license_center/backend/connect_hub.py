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
        self.local_ips = []
        self.client_ip = ""
        self.connected_at = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        self.last_seen_at = time.time()
        self.pending_http: Dict[str, asyncio.Future] = {}
        self.ws_streams: Dict[str, WebSocket] = {}
        self.ws_open_waiters: Dict[str, asyncio.Future] = {}
        self.tcp_streams: Dict[str, WebSocket] = {}
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


def resolve_target_pbx_session(
    subdomain: Optional[str] = None,
    host_header: Optional[str] = None,
    cookie_target: Optional[str] = None,
) -> Optional[ConnectedPBXSession]:
    if subdomain:
        s_clean = subdomain.strip().lower()
        if s_clean in ACTIVE_TUNNELS_BY_SUBDOMAIN:
            return ACTIVE_TUNNELS_BY_SUBDOMAIN[s_clean]
        if s_clean in ACTIVE_TUNNELS_BY_HWID:
            return ACTIVE_TUNNELS_BY_HWID[s_clean]

    if cookie_target:
        c_clean = cookie_target.strip().lower()
        if c_clean in ACTIVE_TUNNELS_BY_SUBDOMAIN:
            return ACTIVE_TUNNELS_BY_SUBDOMAIN[c_clean]

    if host_header:
        h_clean = host_header.split(":")[0].strip().lower()
        parts = h_clean.split(".")
        if len(parts) >= 3 and not all(p.isdigit() for p in parts):
            sub_cand = parts[0]
            if sub_cand in ACTIVE_TUNNELS_BY_SUBDOMAIN:
                return ACTIVE_TUNNELS_BY_SUBDOMAIN[sub_cand]

    if "merkez" in ACTIVE_TUNNELS_BY_SUBDOMAIN:
        return ACTIVE_TUNNELS_BY_SUBDOMAIN["merkez"]

    for sess in ACTIVE_TUNNELS_BY_SUBDOMAIN.values():
        return sess
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
            cert_dir = "/etc/letsencrypt/live/nornia.com.tr"
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

    location /.well-known/acme-challenge/ {{
        root /var/www/html;
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
                if f"DNS:{fqdn}" not in (chk_proc.stdout or ""):
                    # Collect all active subdomains from DB + base domains
                    domains = [
                        "nornia.com.tr",
                        "www.nornia.com.tr",
                        "panel.nornia.com.tr",
                        "connect.nornia.com.tr",
                        "merkez.nornia.com.tr",
                        fqdn,
                    ]
                    try:
                        async with AsyncSessionLocal() as db:
                            res_all = await db.execute(select(ClientServer.connect_subdomain))
                            for (s_val,) in res_all.all():
                                s_c = re.sub(r"[^a-z0-9-_]", "", str(s_val or "").strip().lower())
                                if s_c and f"{s_c}.nornia.com.tr" not in domains:
                                    domains.append(f"{s_c}.nornia.com.tr")
                    except Exception:
                        pass

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
                        "nornia.com.tr",
                    ]
                    for d in domains:
                        cmd.extend(["-d", d])

                    print(f"[Nornia Connect Hub] Yeni alt alan adı için SSL sertifikası genişletiliyor: {fqdn}")
                    await asyncio.to_thread(
                        subprocess.run,
                        cmd,
                        capture_output=True,
                        text=True,
                        timeout=45.0,
                        check=False,
                    )
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
    version: str = "v2.4.8",
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
                domain_name=f"{sub}.nornia.com.tr",
                ip_address=client_ip,
                status="active",
                current_license_key=gen_key,
                license_expires_at=exp_date,
                software_version=version or "v2.4.8",
                last_heartbeat_at=datetime.datetime.utcnow(),
            )
            db.add(client)
        else:
            for client in clients:
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
    return {"ok": True, "subdomain": sub, "locked": True}


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
                session.remote_ssh_enabled = bool(msg.get("remote_ssh_enabled", True))
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

                await session.send_json({
                    "type": "RAS_WELCOME",
                    "subdomain": session.subdomain,
                    "status": "connected",
                    "subdomain_locked": True,
                    "public_ras_url": f"https://{session.subdomain}.nornia.com.tr",
                    "wss_sip_url": f"wss://{session.subdomain}.nornia.com.tr/ras-sip-ws",
                })

            elif mtype == "PING":
                session.remote_ssh_enabled = bool(msg.get("remote_ssh_enabled", session.remote_ssh_enabled))
                await session.send_json({
                    "type": "PONG",
                    "ts": msg.get("ts"),
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
    req_sub = websocket.query_params.get("connect_target") or websocket.cookies.get("nornia_connect_target")
    host_hdr = websocket.headers.get("host") or ""

    session = resolve_target_pbx_session(subdomain=req_sub, host_header=host_hdr)
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


async def forward_http_request_to_pbx(request: Request, full_path: str) -> Response:
    """Forwards an incoming HTTP request through the Nornia Connect tunnel to the target PBX."""
    req_sub = request.query_params.get("connect_target") or request.cookies.get("nornia_connect_target")
    host_hdr = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""

    # Support explicit /connect/<subdomain>/... prefix
    clean_path = f"/{full_path.lstrip('/')}"
    if clean_path.startswith("/connect/"):
        parts = clean_path.split("/", 3)
        if len(parts) >= 3 and parts[2]:
            req_sub = parts[2]
            clean_path = f"/{parts[3]}" if len(parts) >= 4 else "/"

    session = resolve_target_pbx_session(subdomain=req_sub, host_header=host_hdr)
    if not session:
        html_wait = """<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>Nornia Connect — Bulut Köprüsü Bekleniyor</title>
  <meta http-equiv="refresh" content="5" />
  <style>
    body { background: #090d16; color: #f8fafc; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #111827; border: 1px solid #1e293b; border-radius: 20px; padding: 36px; max-width: 520px; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
    .badge { display: inline-block; padding: 6px 14px; border-radius: 99px; background: rgba(245, 158, 11, 0.15); color: #fbbf24; font-size: 12px; font-weight: 700; margin-bottom: 16px; }
    h2 { margin: 0 0 10px; font-size: 20px; }
    p { color: #94a3b8; font-size: 13px; line-height: 1.6; }
    .btn { display: inline-block; margin-top: 18px; padding: 10px 20px; border-radius: 10px; background: #4f46e5; color: #fff; text-decoration: none; font-size: 13px; font-weight: 700; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">● NORNIA CONNECT BULUT KÖPRÜSÜ</div>
    <h2>Bağlı Santral Tüneli Bekleniyor...</h2>
    <p>Nornia Connect Merkez Sunucusu aktif ve çalışıyor; ancak henüz içeriden dışarıya tünel açmış bir Nornia Santrali algılanmadı. Santral bağlandığında bu sayfa otomatik olarak açılacaktır.</p>
    <a class="btn" href="http://" onclick="this.href=window.location.protocol+'//'+window.location.hostname+':3050'">Merkezi Lisans & Yönetim Paneline Git (:3050)</a>
  </div>
</body>
</html>"""
        return Response(content=html_wait, status_code=503, media_type="text/html")

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
    if req_sub:
        response.set_cookie("nornia_connect_target", req_sub, path="/", httponly=False)
    return response
