import asyncio
import base64
import datetime
import json
import os
import socket
import subprocess
import time
import urllib.parse
from typing import Any, Dict, List, Optional

import httpx
import websockets
from fastapi import APIRouter, Body, HTTPException, Request

from backend.services.hardware_info import get_hardware_fingerprint
from backend.scripts.network_recovery import get_live_interfaces

ras_client_router = APIRouter()

DEFAULT_RAS_CONFIG: Dict[str, Any] = {
    "enabled": False,
    "hub_url": "",
    "subdomain": "merkez",
    "secret_token": "",
    "remote_ssh_enabled": True,
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
}

_ras_worker_task: Optional[asyncio.Task] = None
_ras_reconnect_event: Optional[asyncio.Event] = None
_active_ws_streams: Dict[str, asyncio.Task] = {}
_active_ws_conns: Dict[str, Any] = {}
_active_tcp_writers: Dict[str, asyncio.StreamWriter] = {}


def get_ras_config() -> Dict[str, Any]:
    from backend.main import settings_db
    saved = settings_db.get("ras_config")
    if not isinstance(saved, dict):
        saved = {}
    merged = {**DEFAULT_RAS_CONFIG, **saved}
    if not merged.get("secret_token"):
        lic = settings_db.get("license") or {}
        if isinstance(lic, dict) and lic.get("license_key"):
            merged["secret_token"] = str(lic.get("license_key")).strip()
    return merged


def build_ras_ice_servers(ras_cfg: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    cfg = ras_cfg or get_ras_config()
    ice_servers: List[Dict[str, Any]] = [
        {"urls": ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"]}
    ]
    if not cfg.get("enabled") or not cfg.get("turn_enabled"):
        return ice_servers

    turn_srv = str(cfg.get("turn_server") or "").strip()
    if not turn_srv and cfg.get("hub_url"):
        try:
            parsed = urllib.parse.urlparse(str(cfg.get("hub_url")).strip())
            if parsed.hostname:
                turn_srv = f"{parsed.hostname}:3478"
        except Exception:
            pass

    if turn_srv:
        if not turn_srv.startswith(("turn:", "turns:")):
            turn_srv = f"turn:{turn_srv}"
        turn_entry: Dict[str, Any] = {"urls": [turn_srv, f"{turn_srv}?transport=tcp"]}
        t_user = str(cfg.get("turn_username") or "").strip()
        t_pass = str(cfg.get("turn_password") or "").strip()
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
    if cfg.get("enabled") and cfg.get("turn_enabled"):
        turn_srv = str(cfg.get("turn_server") or "").strip()
        if not turn_srv and cfg.get("hub_url"):
            try:
                parsed = urllib.parse.urlparse(str(cfg.get("hub_url")).strip())
                if parsed.hostname:
                    turn_srv = f"{parsed.hostname}:3478"
            except Exception:
                pass
        if turn_srv:
            clean_turn = turn_srv.replace("turn:", "").replace("turns:", "").split("?")[0].strip()
            turn_host, _, turn_port = clean_turn.partition(":")
            turn_port = turn_port or "3478"
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


def _compute_hub_ws_url(hub_url: str, subdomain: str, hw_id: str) -> str:
    raw = str(hub_url or "").strip().rstrip("/")
    if not raw:
        return ""
    if not raw.startswith(("http://", "https://", "ws://", "wss://")):
        raw = f"http://{raw}"
    parsed = urllib.parse.urlparse(raw)
    ws_scheme = "wss" if parsed.scheme in ("https", "wss") else "ws"
    netloc = parsed.netloc or parsed.path
    if ":" not in netloc and ws_scheme == "ws":
        netloc = f"{netloc}:8050"
    query = urllib.parse.urlencode({
        "subdomain": subdomain or "merkez",
        "hardware_id": hw_id,
    })
    return f"{ws_scheme}://{netloc}/api/v1/ras/tunnel?{query}"


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

    # Route /api/*, /uploads/*, /docs, /openapi.json directly to FastAPI Backend (127.0.0.1:8000)
    # Route everything else to Next.js Frontend (127.0.0.1:3000)
    if path.startswith(("/api/", "/uploads/", "/settings/", "/calls/", "/webhooks/", "/webhook/", "/docs", "/openapi.json")):
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
    if msg.get("public_host"):
        clean_headers["X-Forwarded-Host"] = str(msg.get("public_host"))
        clean_headers["Host"] = str(msg.get("public_host"))
    if msg.get("public_proto"):
        clean_headers["X-Forwarded-Proto"] = str(msg.get("public_proto"))

    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=False) as client:
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

    if target_port == 22 and not cfg.get("remote_ssh_enabled", True):
        await tunnel_ws.send(
            json.dumps({
                "type": "TCP_CLOSE",
                "stream_id": stream_id,
                "reason": "Santral yöneticisi tarafından Uzak SSH (Teknik Destek) erişimi kapatılmış.",
            })
        )
        return

    allowed_ports = {22, 8000, 3000, 5060, 8088, 8089}
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
        ws_url = _compute_hub_ws_url(str(cfg.get("hub_url")), subdomain, hw_id)
        urls_info = _compute_public_ras_urls(str(cfg.get("hub_url")), subdomain)
        RAS_RUNTIME_STATE.update(urls_info)
        RAS_RUNTIME_STATE["status"] = "connecting"

        try:
            ifaces = get_live_interfaces()
            local_ips = [i.get("primary_cidr") for i in ifaces if i.get("primary_cidr")]
            async with websockets.connect(
                ws_url,
                ping_interval=None,
                max_size=32 * 1024 * 1024,
                extra_headers={
                    "X-Hardware-ID": hw_id,
                    "X-RAS-Subdomain": subdomain,
                    "X-RAS-Token": str(cfg.get("secret_token") or ""),
                },
            ) as tunnel_ws:
                # Send initial registration handshake
                hello_payload = {
                    "type": "RAS_REGISTER",
                    "hardware_id": hw_id,
                    "hostname": socket.gethostname(),
                    "subdomain": subdomain,
                    "secret_token": str(cfg.get("secret_token") or ""),
                    "remote_ssh_enabled": bool(cfg.get("remote_ssh_enabled", True)),
                    "local_ips": local_ips,
                    "version": "v2.4.8",
                }
                t0 = time.monotonic()
                await tunnel_ws.send(json.dumps(hello_payload))

                RAS_RUNTIME_STATE["status"] = "connected"
                RAS_RUNTIME_STATE["connected"] = True
                RAS_RUNTIME_STATE["last_connected_at"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                RAS_RUNTIME_STATE["last_error"] = ""
                RAS_RUNTIME_STATE["latency_ms"] = round((time.monotonic() - t0) * 1000, 1)

                async def _ping_keepalive():
                    while True:
                        await asyncio.sleep(15)
                        p_start = time.monotonic()
                        await tunnel_ws.send(
                            json.dumps({
                                "type": "PING",
                                "ts": p_start,
                                "remote_ssh_enabled": bool(get_ras_config().get("remote_ssh_enabled", True)),
                            })
                        )

                ping_task = asyncio.create_task(_ping_keepalive())
                try:
                    async for raw_msg in tunnel_ws:
                        if _ras_reconnect_event.is_set():
                            _ras_reconnect_event.clear()
                            break
                        try:
                            msg = json.loads(raw_msg)
                        except Exception:
                            continue

                        mtype = msg.get("type")
                        if mtype == "PONG":
                            sent_ts = float(msg.get("ts") or 0)
                            if sent_ts > 0:
                                RAS_RUNTIME_STATE["latency_ms"] = max(1, round((time.monotonic() - sent_ts) * 1000, 1))
                            RAS_RUNTIME_STATE["last_ping_at"] = datetime.datetime.now().strftime("%H:%M:%S")
                        elif mtype == "RAS_WELCOME":
                            if msg.get("public_ras_url"):
                                RAS_RUNTIME_STATE["public_ras_url"] = msg["public_ras_url"]
                                RAS_RUNTIME_STATE["mobile_ras_url"] = msg["public_ras_url"]
                            if msg.get("wss_sip_url"):
                                RAS_RUNTIME_STATE["wss_sip_url"] = msg["wss_sip_url"]
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
        except Exception as exc:
            RAS_RUNTIME_STATE["status"] = "error"
            RAS_RUNTIME_STATE["connected"] = False
            RAS_RUNTIME_STATE["last_error"] = str(exc)
            RAS_RUNTIME_STATE["reconnect_count"] = int(RAS_RUNTIME_STATE.get("reconnect_count") or 0) + 1

        _ras_reconnect_event.clear()
        try:
            await asyncio.wait_for(_ras_reconnect_event.wait(), timeout=5.0)
        except asyncio.TimeoutError:
            pass


def start_ras_tunnel_worker():
    global _ras_worker_task
    if _ras_worker_task is None or _ras_worker_task.done():
        sync_asterisk_rtp_turn_config()
        _ras_worker_task = asyncio.create_task(_ras_tunnel_loop())


def trigger_ras_reconnect():
    global _ras_reconnect_event
    if _ras_reconnect_event is not None:
        _ras_reconnect_event.set()
    start_ras_tunnel_worker()


@ras_client_router.get("/api/settings/ras/status")
async def get_ras_status_endpoint(request: Request):
    cfg = get_ras_config()
    hw_info = get_hardware_fingerprint()
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
        "hardware_id": hw_info.get("hardware_id", "HW-UNKNOWN"),
        "hostname": socket.gethostname(),
        "local_interfaces": ifaces,
        "ice_servers": build_ras_ice_servers(cfg),
    }


@ras_client_router.post("/api/settings/ras/config")
async def save_ras_config_endpoint(request: Request, payload: Dict[str, Any] = Body(...)):
    from backend.main import get_user_info, log_event, save_settings, settings_db

    u_info = await get_user_info(request)
    current = get_ras_config()

    updated = {
        "enabled": bool(payload.get("enabled", current.get("enabled", False))),
        "hub_url": str(payload.get("hub_url", current.get("hub_url", ""))).strip(),
        "subdomain": str(payload.get("subdomain", current.get("subdomain", "merkez"))).strip().lower() or "merkez",
        "secret_token": str(payload.get("secret_token", current.get("secret_token", ""))).strip(),
        "remote_ssh_enabled": bool(payload.get("remote_ssh_enabled", current.get("remote_ssh_enabled", True))),
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
