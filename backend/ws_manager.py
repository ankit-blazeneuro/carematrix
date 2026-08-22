from fastapi import WebSocket
from typing import Dict, List
import json
import logging

logger = logging.getLogger("carematrix.websockets")

class ConnectionManager:
    def __init__(self):
        # Channels: channel_name -> list of WebSocket connections
        self.active_connections: Dict[str, List[WebSocket]] = {
            "transfers": [],
            "resources": [],
            "heatmap": []
        }

    async def connect(self, channel: str, websocket: WebSocket):
        await websocket.accept()
        if channel not in self.active_connections:
            self.active_connections[channel] = []
        self.active_connections[channel].append(websocket)
        logger.info(f"Client connected to WebSocket channel: {channel}")

    def disconnect(self, channel: str, websocket: WebSocket):
        if channel in self.active_connections:
            if websocket in self.active_connections[channel]:
                self.active_connections[channel].remove(websocket)
                logger.info(f"Client disconnected from WebSocket channel: {channel}")

    async def broadcast(self, channel: str, event_type: str, data: dict):
        if channel not in self.active_connections:
            return
        message = json.dumps({"event": event_type, "data": data})
        disconnected = []
        for connection in self.active_connections[channel]:
            try:
                await connection.send_text(message)
            except Exception as e:
                disconnected.append(connection)
        for conn in disconnected:
            self.active_connections[channel].remove(conn)

ws_manager = ConnectionManager()
