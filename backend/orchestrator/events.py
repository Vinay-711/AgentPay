"""Event broadcaster for WebSocket activity feed."""

import asyncio
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Set
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages active WebSocket connections per agent_id."""

    def __init__(self):
        # agent_id -> set of active WebSockets
        self.active_connections: Dict[int, Set[WebSocket]] = {}
        # agent_id -> recent event history
        self.event_history: Dict[int, List[Dict[str, Any]]] = {}

    async def connect(self, agent_id: int, websocket: WebSocket):
        await websocket.accept()
        if agent_id not in self.active_connections:
            self.active_connections[agent_id] = set()
            self.event_history[agent_id] = []
        self.active_connections[agent_id].add(websocket)
        logger.info(f"WebSocket client connected for agent #{agent_id}")

        # Send recent history upon connection
        for event in self.event_history.get(agent_id, [])[-20:]:
            try:
                await websocket.send_text(json.dumps(event))
            except Exception:
                pass

    def disconnect(self, agent_id: int, websocket: WebSocket):
        if agent_id in self.active_connections:
            self.active_connections[agent_id].discard(websocket)
            if not self.active_connections[agent_id]:
                del self.active_connections[agent_id]
        logger.info(f"WebSocket client disconnected for agent #{agent_id}")

    async def broadcast(self, agent_id: int, event_type: str, data: Dict[str, Any]):
        """Broadcast an event to all connected listeners for this agent."""
        payload = {
            "agent_id": agent_id,
            "event_type": event_type,
            "data": data,
            "timestamp": datetime.utcnow().isoformat(),
        }

        # Store in history
        if agent_id not in self.event_history:
            self.event_history[agent_id] = []
        self.event_history[agent_id].append(payload)

        # Broadcast to active sockets
        if agent_id in self.active_connections:
            disconnected = []
            for connection in list(self.active_connections[agent_id]):
                try:
                    await connection.send_text(json.dumps(payload))
                except Exception as e:
                    logger.warning(f"Error sending to websocket: {e}")
                    disconnected.append(connection)
            for d in disconnected:
                self.active_connections[agent_id].discard(d)


# Singleton
event_manager = ConnectionManager()
