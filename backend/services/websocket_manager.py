import asyncio
from typing import Dict, List, Optional
from fastapi import WebSocket


def _norm_ws_tid(tid: Optional[str]) -> str:
    s = str(tid or "tenant-default").strip().lower()
    if s in ("", "default", "tenant-default"):
        return "tenant-default"
    return s


class ConnectionManager:
    def __init__(self):
        # Maps call_id -> list of WebSockets (agents viewing the call)
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # Maps WebSocket -> tenant_id ("tenant-default", "tenant-acme", or "all" for provider-root global monitor)
        self.omnichannel_connections: Dict[WebSocket, str] = {}

    async def connect(self, call_id: str, websocket: WebSocket):
        await websocket.accept()
        if call_id not in self.active_connections:
            self.active_connections[call_id] = []
        self.active_connections[call_id].append(websocket)

    def disconnect(self, call_id: str, websocket: WebSocket):
        if call_id in self.active_connections:
            if websocket in self.active_connections[call_id]:
                self.active_connections[call_id].remove(websocket)
            if not self.active_connections[call_id]:
                del self.active_connections[call_id]

    async def broadcast_transcript(self, call_id: str, speaker: str, text: str):
        """Sends new transcript turn to all subscribed agent panels."""
        if call_id in self.active_connections:
            message = {
                "type": "transcript",
                "call_id": call_id,
                "speaker": speaker,
                "text": text,
            }
            for connection in list(self.active_connections[call_id]):
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

    async def connect_omnichannel(self, websocket: WebSocket, tenant_id: str = "tenant-default"):
        await websocket.accept()
        self.omnichannel_connections[websocket] = _norm_ws_tid(tenant_id)

    def disconnect_omnichannel(self, websocket: WebSocket):
        self.omnichannel_connections.pop(websocket, None)

    async def broadcast_omnichannel_event(self, event: dict, tenant_id: Optional[str] = None):
        """Sends a JSON event ONLY to connected omnichannel clients belonging to the same tenant."""
        ev_tid = _norm_ws_tid(
            tenant_id
            or (event.get("tenant_id") if isinstance(event, dict) else None)
            or ((event.get("session") or {}).get("tenant_id") if isinstance(event, dict) and isinstance(event.get("session"), dict) else None)
        )
        to_remove = []
        for connection, sock_tid in list(self.omnichannel_connections.items()):
            if sock_tid not in ("all", "global") and sock_tid != ev_tid:
                continue
            try:
                await connection.send_json(event)
            except Exception:
                to_remove.append(connection)
        for dead in to_remove:
            self.omnichannel_connections.pop(dead, None)


# Singleton manager
ws_manager = ConnectionManager()
