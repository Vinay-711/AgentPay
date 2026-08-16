"""WebSocket streaming endpoint for real-time AgentPay activity."""

import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.orchestrator.events import event_manager

logger = logging.getLogger(__name__)
ws_router = APIRouter()


@ws_router.websocket("/ws/activity/{agent_id}")
async def websocket_activity_feed(websocket: WebSocket, agent_id: int):
    """
    WebSocket endpoint streaming live orchestrator + AgentGuard + chain events
    (discovery, hire, AgentGuard check result, payment + tx hash, job result).
    """
    await event_manager.connect(agent_id, websocket)
    try:
        while True:
            # Keep connection alive and accept client pings/messages
            data = await websocket.receive_text()
            # Optional: handle client-sent commands
    except WebSocketDisconnect:
        event_manager.disconnect(agent_id, websocket)
    except Exception as e:
        logger.warning(f"WebSocket error for agent #{agent_id}: {e}")
        event_manager.disconnect(agent_id, websocket)
