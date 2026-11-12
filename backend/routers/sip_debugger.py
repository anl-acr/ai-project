import os
import sys
import re
import json
import time
import shutil
import asyncio
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import Response, FileResponse

from backend.services.sip_trapper import sip_trapper

router = APIRouter(prefix="/api/sip-debugger", tags=["Sorun İnceleme & SIP Debugger"])

HOST_VALID_RE = re.compile(r"^[a-zA-Z0-9.\-:]{1,253}$")


def _clean_and_validate_host(raw_host: str) -> str:
    """
    Sanitizes and strictly validates a target IP or hostname to prevent CLI flag/command injection.
    Accepts pasted SIP URIs or URLs like 'sip:trunk.provider.com:5060' and extracts the clean host.
    """
    h = (raw_host or "").strip()
    for prefix in ("sip:", "sips:", "http://", "https://", "wss://", "ws://"):
        if h.lower().startswith(prefix):
            h = h[len(prefix):]
    if "@" in h:
        h = h.split("@", 1)[1]
    if "/" in h:
        h = h.split("/", 1)[0]
    # Strip :port for IPv4 / domain targets (leave IPv6 colons intact)
    if h.count(":") == 1:
        host_part, port_part = h.rsplit(":", 1)
        if port_part.isdigit():
            h = host_part
    h = h.strip()
    if not h or h.startswith("-") or not HOST_VALID_RE.match(h):
        raise HTTPException(
            status_code=400,
            detail="Geçersiz hedef IP veya alan adı formatı.",
        )
    return h


class PingRequest(BaseModel):
    host: str
    count: int = 4
    packet_size: int = 56


class TracerouteRequest(BaseModel):
    host: str
    max_hops: int = 15
    resolve_dns: bool = False


class SaveSnapshotRequest(BaseModel):
    label: str = "sip_capture"
    ip: str = ""
    port: str = ""
    method: str = ""
    q: str = ""


class SipFrameIngestRequest(BaseModel):
    raw: str
    direction: str = "inbound"
    pbx_host: str = ""
    pbx_port: int = 8089
    ext: str = ""


@router.post("/ingest")
async def ingest_live_sip_frame(payload: SipFrameIngestRequest, request: Request):
    """Ingests real-time WebRTC SIP.js or external SIP proxy frames into SipTrapper."""
    sip_trapper.bind_event_loop()
    if not sip_trapper.is_running:
        return {"status": "ignored", "reason": "stopped"}

    xff = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    xreal = (request.headers.get("x-real-ip") or "").strip()
    client_ip = xff or xreal or (request.client.host if request.client else "127.0.0.1")
    pbx_ip = (payload.pbx_host or "").strip() or sip_trapper.local_ip
    if ":" in pbx_ip and pbx_ip.count(":") == 1:
        pbx_ip = pbx_ip.split(":", 1)[0]
    pbx_port = int(payload.pbx_port or 8089)

    if (payload.direction or "").lower() == "outbound":
        src_ip, src_port = client_ip, 5062
        dst_ip, dst_port = pbx_ip, pbx_port
    else:
        src_ip, src_port = pbx_ip, pbx_port
        dst_ip, dst_port = client_ip, 5062

    pkt = sip_trapper.parse_raw_sip(
        payload.raw,
        src_ip=src_ip,
        src_port=src_port,
        dst_ip=dst_ip,
        dst_port=dst_port,
        protocol="WSS",
        source="webrtc",
    )
    return {"status": "success", "ingested": bool(pkt), "viewer_active": sip_trapper.is_viewer_active()}


@router.get("/diagnostics/targets")
async def get_diagnostic_targets():
    """Returns helpful preset network targets (configured SIP Trunks, PBX IP, NAT IP, public DNS)."""
    targets: List[Dict[str, str]] = []
    seen = set()

    def _add(label: str, host: str, category: str):
        if not host:
            return
        try:
            clean = _clean_and_validate_host(host)
        except Exception:
            return
        if clean in seen:
            return
        seen.add(clean)
        targets.append({"label": label, "host": clean, "category": category})

    settings_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "settings.json",
    )
    if os.path.isfile(settings_path):
        try:
            with open(settings_path, "r", encoding="utf-8") as f:
                sdata = json.load(f)
            pbx_host = sdata.get("pbx", {}).get("host")
            if pbx_host:
                _add("Asterisk Santral", pbx_host, "pbx")
            nat_ip = sdata.get("nat", {}).get("extern_ip")
            if nat_ip:
                _add("Dış WAN / NAT IP", nat_ip, "nat")
            for tr in sdata.get("trunks", []) or []:
                thost = tr.get("host") or tr.get("server")
                tname = tr.get("name") or "SIP Trunk"
                if thost:
                    _add(f"Trunk: {tname}", thost, "trunk")
        except Exception:
            pass

    _add("Google DNS", "8.8.8.8", "dns")
    _add("Cloudflare DNS", "1.1.1.1", "dns")
    _add("Localhost", "127.0.0.1", "local")

    return {"status": "success", "targets": targets}


@router.post("/diagnostics/ping")
async def run_ping_diagnostic(payload: PingRequest):
    """Executes safe non-shell ICMP ping and parses RTT, jitter (stddev/mdev), and packet loss."""
    clean_host = _clean_and_validate_host(payload.host)
    count = max(1, min(int(payload.count or 4), 10))
    packet_size = max(16, min(int(payload.packet_size or 56), 1400))

    ping_bin = shutil.which("ping") or "/sbin/ping"
    if not os.path.exists(ping_bin):
        raise HTTPException(status_code=500, detail="Sunucuda 'ping' aracı bulunamadı.")

    # macOS (-W milliseconds) vs Linux (-W seconds)
    if sys.platform == "darwin":
        cmd = [ping_bin, "-c", str(count), "-s", str(packet_size), "-W", "2000", clean_host]
    else:
        cmd = [ping_bin, "-c", str(count), "-s", str(packet_size), "-W", "2", clean_host]

    started = time.perf_counter()
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        stdout_bytes, _ = await asyncio.wait_for(proc.communicate(), timeout=count * 3 + 5)
        raw_out = stdout_bytes.decode("utf-8", errors="replace")
        return_code = proc.returncode
    except asyncio.TimeoutError:
        try:
            proc.kill()
        except Exception:
            pass
        raise HTTPException(status_code=504, detail="Ping işlemi zaman aşımına uğradı.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ping çalıştırılamadı: {str(e)}")

    elapsed_ms = round((time.perf_counter() - started) * 1000, 1)

    replies = []
    reply_re = re.compile(
        r"(\d+)\s+bytes\s+from\s+([^\s:]+).*?(?:icmp_seq|seq)=(\d+).*?ttl=(\d+).*?time[=<]\s*([\d.]+)\s*ms",
        re.IGNORECASE,
    )
    for line in raw_out.splitlines():
        m = reply_re.search(line)
        if m:
            replies.append(
                {
                    "bytes": int(m.group(1)),
                    "from": m.group(2),
                    "seq": int(m.group(3)),
                    "ttl": int(m.group(4)),
                    "time_ms": float(m.group(5)),
                }
            )

    transmitted = count
    received = len(replies)
    loss_percent = 100.0 if received == 0 else round(((transmitted - received) / transmitted) * 100, 1)

    tx_rx_re = re.search(
        r"(\d+)\s+packets\s+transmitted,\s+(\d+)\s+(?:packets\s+)?received.*?([\d.]+)%\s+packet\s+loss",
        raw_out,
        re.IGNORECASE,
    )
    if tx_rx_re:
        transmitted = int(tx_rx_re.group(1))
        received = int(tx_rx_re.group(2))
        loss_percent = float(tx_rx_re.group(3))

    min_ms = avg_ms = max_ms = jitter_ms = None
    rtt_re = re.search(
        r"(?:min/avg/max/(?:stddev|mdev))\s*=\s*([\d.]+)/([\d.]+)/([\d.]+)/([\d.]+)",
        raw_out,
        re.IGNORECASE,
    )
    if rtt_re:
        min_ms = float(rtt_re.group(1))
        avg_ms = float(rtt_re.group(2))
        max_ms = float(rtt_re.group(3))
        jitter_ms = float(rtt_re.group(4))
    elif replies:
        times = [r["time_ms"] for r in replies]
        min_ms = round(min(times), 2)
        max_ms = round(max(times), 2)
        avg_ms = round(sum(times) / len(times), 2)
        jitter_ms = round(max_ms - min_ms, 2)

    return {
        "status": "success" if received > 0 else "unreachable",
        "host": clean_host,
        "return_code": return_code,
        "duration_ms": elapsed_ms,
        "summary": {
            "transmitted": transmitted,
            "received": received,
            "loss_percent": loss_percent,
            "min_ms": min_ms,
            "avg_ms": avg_ms,
            "max_ms": max_ms,
            "jitter_ms": jitter_ms,
        },
        "replies": replies,
        "raw_output": raw_out,
    }


@router.post("/diagnostics/traceroute")
async def run_traceroute_diagnostic(payload: TracerouteRequest):
    """Executes safe non-shell traceroute (or tracepath fallback) and parses hop-by-hop latency."""
    clean_host = _clean_and_validate_host(payload.host)
    max_hops = max(3, min(int(payload.max_hops or 15), 30))

    tr_bin = shutil.which("traceroute")
    use_tracepath = False
    if not tr_bin:
        tr_bin = shutil.which("tracepath")
        use_tracepath = bool(tr_bin)

    if not tr_bin:
        raise HTTPException(
            status_code=500,
            detail="Sunucuda 'traceroute' veya 'tracepath' aracı bulunamadı.",
        )

    if use_tracepath:
        cmd = [tr_bin, "-m", str(max_hops)]
        if not payload.resolve_dns:
            cmd.append("-n")
        cmd.append(clean_host)
    else:
        cmd = [tr_bin, "-m", str(max_hops), "-q", "2", "-w", "1"]
        if not payload.resolve_dns:
            cmd.append("-n")
        cmd.append(clean_host)

    started = time.perf_counter()
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        stdout_bytes, _ = await asyncio.wait_for(proc.communicate(), timeout=max_hops * 2 + 8)
        raw_out = stdout_bytes.decode("utf-8", errors="replace")
    except asyncio.TimeoutError:
        try:
            proc.kill()
        except Exception:
            pass
        raise HTTPException(status_code=504, detail="Traceroute işlemi zaman aşımına uğradı.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Traceroute çalıştırılamadı: {str(e)}")

    elapsed_ms = round((time.perf_counter() - started) * 1000, 1)

    hops = []
    hop_line_re = re.compile(r"^\s*(\d+)[:\s]+(.*)$")
    rtt_val_re = re.compile(r"([\d.]+)\s*ms", re.IGNORECASE)
    ip_paren_re = re.compile(r"\(([\d.:a-fA-F]+)\)")
    bare_ip_re = re.compile(r"\b(\d{1,3}(?:\.\d{1,3}){3})\b")

    for line in raw_out.splitlines():
        hm = hop_line_re.match(line)
        if not hm:
            continue
        hop_num = int(hm.group(1))
        rest = hm.group(2).strip()

        rtts = [float(x) for x in rtt_val_re.findall(rest)]
        is_timeout = len(rtts) == 0 and ("*" in rest or "no reply" in rest.lower())

        ip_addr = None
        host_name = None

        pm = ip_paren_re.search(rest)
        if pm:
            ip_addr = pm.group(1)
            before_paren = rest[: pm.start()].strip().split()
            host_name = before_paren[0] if before_paren else ip_addr
        else:
            bm = bare_ip_re.search(rest)
            if bm:
                ip_addr = bm.group(1)
                tokens = rest.split()
                host_name = tokens[0] if tokens else ip_addr

        avg_rtt = round(sum(rtts) / len(rtts), 2) if rtts else None

        hops.append(
            {
                "hop": hop_num,
                "host": host_name or ("*" if is_timeout else rest.split()[0] if rest.split() else "*"),
                "ip": ip_addr,
                "rtts_ms": rtts,
                "avg_ms": avg_rtt,
                "is_timeout": is_timeout,
                "raw_line": line.strip(),
            }
        )

    return {
        "status": "success",
        "host": clean_host,
        "duration_ms": elapsed_ms,
        "max_hops": max_hops,
        "hops": hops,
        "raw_output": raw_out,
    }


@router.get("/capture/packets")
async def get_captured_sip_packets(
    ip: Optional[str] = "",
    port: Optional[str] = "",
    method: Optional[str] = "",
    q: Optional[str] = "",
    limit: int = 300,
):
    """Returns chronological SIP packet stream and saved PCAP snapshots for the SIP Capture tab."""
    sip_trapper.bind_event_loop()
    sip_trapper.mark_viewer_active()
    packets = sip_trapper.get_packets(ip=ip or "", port=port or "", method=method or "", query=q or "", limit=limit)
    return {
        "status": "success",
        "is_running": sip_trapper.is_running,
        "active_sources": sorted(list(sip_trapper.active_sources)),
        "total_buffered": len(sip_trapper.packets),
        "count": len(packets),
        "packets": packets,
        "snapshots": sip_trapper.list_pcap_snapshots(),
    }


@router.get("/capture/pcap")
async def download_filtered_capture_pcap(
    ip: Optional[str] = "",
    port: Optional[str] = "",
    method: Optional[str] = "",
    q: Optional[str] = "",
):
    """Downloads a multi-packet Wireshark-compatible .pcap file of all matching captured SIP frames."""
    packets = sip_trapper.get_packets(ip=ip or "", port=port or "", method=method or "", query=q or "", limit=1000)
    if not packets:
        raise HTTPException(status_code=404, detail="İndirilecek eşleşen SIP paketi bulunamadı.")
    # Chronological order (oldest -> newest) inside PCAP
    ordered = list(reversed(packets))
    pcap_bytes = sip_trapper.generate_multi_packet_pcap_bytes(ordered)
    stamp = time.strftime("%Y%m%d_%H%M%S")
    filename = f"sip_capture_{stamp}.pcap"
    return Response(
        content=pcap_bytes,
        media_type="application/vnd.tcpdump.pcap",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(pcap_bytes)),
        },
    )


@router.post("/capture/snapshots")
async def create_capture_snapshot(payload: SaveSnapshotRequest):
    """Saves current filtered SIP packets to disk as a named .pcap snapshot."""
    packets = sip_trapper.get_packets(
        ip=payload.ip,
        port=payload.port,
        method=payload.method,
        query=payload.q,
        limit=1000,
    )
    if not packets:
        raise HTTPException(status_code=400, detail="Kaydedilecek yakalanmış SIP paketi yok.")
    meta = sip_trapper.save_pcap_snapshot(payload.label, list(reversed(packets)))
    return {
        "status": "success",
        "snapshot": meta,
        "snapshots": sip_trapper.list_pcap_snapshots(),
    }


@router.get("/capture/snapshots/{filename}")
async def download_capture_snapshot(filename: str):
    fpath = sip_trapper.get_pcap_snapshot_path(filename)
    if not fpath:
        raise HTTPException(status_code=404, detail="PCAP kaydı bulunamadı.")
    return FileResponse(
        fpath,
        media_type="application/vnd.tcpdump.pcap",
        filename=os.path.basename(fpath),
    )


@router.delete("/capture/snapshots/{filename}")
async def delete_capture_snapshot(filename: str):
    deleted = sip_trapper.delete_pcap_snapshot(filename)
    if not deleted:
        raise HTTPException(status_code=404, detail="Silinecek PCAP kaydı bulunamadı.")
    return {"status": "success", "snapshots": sip_trapper.list_pcap_snapshots()}


@router.get("/calls")
async def get_captured_calls(q: Optional[str] = "", method: Optional[str] = ""):
    """Returns list of all captured SIP call sessions."""
    sip_trapper.bind_event_loop()
    sip_trapper.mark_viewer_active()
    calls = sip_trapper.get_calls(query=q or "", method_filter=method or "")
    return {
        "status": "success",
        "is_running": sip_trapper.is_running,
        "active_sources": sorted(list(sip_trapper.active_sources)),
        "count": len(calls),
        "calls": calls,
    }


@router.get("/calls/{call_id}")
async def get_call_details(call_id: str):
    """Returns chronological SIP message flow for a given Call-ID."""
    details = sip_trapper.get_call_messages(call_id)
    if not details:
        raise HTTPException(status_code=404, detail="SIP Call-ID bulunamadı.")
    return {"status": "success", "call": details}


@router.get("/calls/{call_id}/pcap")
async def download_call_pcap(call_id: str):
    """Generates and downloads the binary .pcap file for the specified SIP Call-ID."""
    details = sip_trapper.get_call_messages(call_id)
    if not details:
        raise HTTPException(status_code=404, detail="PCAP oluşturulamadı: SIP Call-ID bulunamadı.")

    pcap_bytes = sip_trapper.generate_pcap_bytes(call_id)
    safe_id = "".join([c if c.isalnum() else "_" for c in call_id])[:40]
    filename = f"sip_call_{safe_id}.pcap"

    return Response(
        content=pcap_bytes,
        media_type="application/vnd.tcpdump.pcap",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(pcap_bytes)),
        },
    )


@router.post("/start")
async def start_sip_capture():
    """Starts live SIP packet trapping engine."""
    sip_trapper.start_capture()
    return {"status": "success", "message": "SIP paket yakalama başlatıldı.", "is_running": True}


@router.post("/stop")
async def stop_sip_capture():
    """Stops live SIP packet trapping engine."""
    sip_trapper.stop_capture()
    return {"status": "success", "message": "SIP paket yakalama durduruldu.", "is_running": False}


@router.delete("/clear")
async def clear_sip_traces():
    """Clears all captured SIP call sessions and raw packet buffers."""
    sip_trapper.clear_traces()
    return {"status": "success", "message": "Tüm SIP izleri temizlendi."}


@router.websocket("/ws")
async def sip_debugger_websocket(websocket: WebSocket):
    """WebSocket endpoint streaming live captured SIP messages."""
    await websocket.accept()
    sip_trapper.bind_event_loop()
    sip_trapper.subscribers.add(websocket)
    try:
        await websocket.send_json(
            {
                "type": "status",
                "is_running": sip_trapper.is_running,
                "active_sources": sorted(list(sip_trapper.active_sources)),
                "call_count": len(sip_trapper.calls),
                "total_buffered": len(sip_trapper.packets),
            }
        )
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[SIP Debugger WS Exception]: {e}")
    finally:
        sip_trapper.subscribers.discard(websocket)
