import asyncio
from typing import Dict, List
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # Maps call_id -> list of WebSockets (agents viewing the call)
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # List of WebSockets connected to global omnichannel updates
        self.omnichannel_connections: List[WebSocket] = []

    async def connect(self, call_id: str, websocket: WebSocket):
        await websocket.accept()
        if call_id not in self.active_connections:
            self.active_connections[call_id] = []
        self.active_connections[call_id].append(websocket)

    def disconnect(self, call_id: str, websocket: WebSocket):
        if call_id in self.active_connections:
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
                "text": text
            }
            for connection in self.active_connections[call_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    # Connection closed or dead
                    pass

    async def connect_omnichannel(self, websocket: WebSocket):
        await websocket.accept()
        self.omnichannel_connections.append(websocket)

    def disconnect_omnichannel(self, websocket: WebSocket):
        if websocket in self.omnichannel_connections:
            self.omnichannel_connections.remove(websocket)

    async def broadcast_omnichannel_event(self, event: dict):
        """Sends a JSON event to all connected omnichannel workspace clients."""
        for connection in self.omnichannel_connections:
            try:
                await connection.send_json(event)
            except Exception:
                pass

# Singleton manager
ws_manager = ConnectionManager()
