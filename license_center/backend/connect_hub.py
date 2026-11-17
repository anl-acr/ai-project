import asyncio
import base64
import datetime
import json
import time
import uuid
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Request, Response, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

connect_hub_router = APIRouter()


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


@connect_hub_router.websocket("/api/v1/ras/tunnel")
async def pbx_ras_tunnel_endpoint(websocket: WebSocket):
    await websocket.accept()
    subdomain = (websocket.query_params.get("subdomain") or websocket.headers.get("x-ras-subdomain") or "merkez").strip().lower()
    hw_id = (websocket.query_params.get("hardware_id") or websocket.headers.get("x-hardware-id") or "HW-UNKNOWN").strip()

    session = ConnectedPBXSession(websocket=websocket, subdomain=subdomain, hardware_id=hw_id)
    xff = websocket.headers.get("x-forwarded-for") or websocket.headers.get("x-real-ip")
    session.client_ip = xff.split(",")[0].strip() if xff else (websocket.client.host if websocket.client else "unknown")

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
                if msg.get("subdomain"):
                    new_sub = str(msg.get("subdomain")).strip().lower()
                    if new_sub and new_sub != session.subdomain:
                        ACTIVE_TUNNELS_BY_SUBDOMAIN.pop(session.subdomain, None)
                        session.subdomain = new_sub
                        ACTIVE_TUNNELS_BY_SUBDOMAIN[session.subdomain] = session
                if msg.get("hardware_id"):
                    session.hardware_id = str(msg.get("hardware_id")).strip()
                    ACTIVE_TUNNELS_BY_HWID[session.hardware_id] = session
                await session.send_json({
                    "type": "RAS_WELCOME",
                    "subdomain": session.subdomain,
                    "status": "connected",
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
