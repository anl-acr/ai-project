import os
import json
import asyncio
from fastapi import APIRouter, HTTPException, Depends, Request, WebSocket, WebSocketDisconnect, Response
from fastapi.responses import Response, StreamingResponse
from typing import Optional

from backend.services.sip_trapper import sip_trapper

router = APIRouter(prefix="/api/sip-debugger", tags=["SIP Debugger & sngrep"])

@router.get("/calls")
async def get_captured_calls(q: Optional[str] = ""):
    """Returns list of all captured SIP call sessions."""
    calls = sip_trapper.get_calls(query=q)
    return {
        "status": "success",
        "is_running": sip_trapper.is_running,
        "count": len(calls),
        "calls": calls
    }

@router.get("/calls/{call_id}")
async def get_call_details(call_id: str):
    """Returns chronological SIP message flow for a given Call-ID."""
    details = sip_trapper.get_call_messages(call_id)
    if not details:
        raise HTTPException(status_code=404, detail="SIP Call-ID bulunamadı.")
    return {
        "status": "success",
        "call": details
    }

@router.get("/calls/{call_id}/pcap")
async def download_call_pcap(call_id: str):
    """
    Generates and downloads the binary .pcap file for the specified SIP Call-ID.
    Compatible with Wireshark and sngrep.
    """
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
            "Content-Length": str(len(pcap_bytes))
        }
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
    """Clears all captured SIP call sessions."""
    sip_trapper.clear_traces()
    return {"status": "success", "message": "Tüm SIP izleri temizlendi."}

@router.websocket("/ws")
async def sip_debugger_websocket(websocket: WebSocket):
    """WebSocket endpoint streaming live captured SIP messages."""
    await websocket.accept()
    sip_trapper.subscribers.add(websocket)
    try:
        # Send initial status
        await websocket.send_json({
            "type": "status",
            "is_running": sip_trapper.is_running,
            "call_count": len(sip_trapper.calls)
        })
        while True:
            data = await websocket.receive_text()
            # Keep alive ping/pong
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[SIP Debugger WS Exception]: {e}")
    finally:
        sip_trapper.subscribers.discard(websocket)
