from __future__ import annotations

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.core.db import SessionLocal
from app.core.security import decode_access_token
from app.models.ticket import Ticket
from app.models.user import User, UserRole
from app.services.chat_hub import hub

router = APIRouter()


@router.websocket("/ws/tickets/{ticket_id}")
async def ticket_chat(
    websocket: WebSocket,
    ticket_id: int,
    token: str = Query(...),
) -> None:
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        await websocket.close(code=4401)
        return

    user_id = int(payload["sub"])
    db = SessionLocal()
    try:
        user = db.get(User, user_id)
        ticket = db.get(Ticket, ticket_id)
        if user is None or ticket is None:
            await websocket.close(code=4404)
            return

        allowed = (
            user.role == UserRole.ADMIN
            or (user.role == UserRole.CITIZEN and ticket.citizen_id == user.id)
            or (
                user.role == UserRole.AGENT
                and (ticket.agent_id == user.id or ticket.status.value == "queued")
            )
        )
        if not allowed:
            await websocket.close(code=4403)
            return
    finally:
        db.close()

    await hub.connect(ticket_id, websocket)
    try:
        while True:
            # We only broadcast server-originated events; client sends go through REST.
            # Keep the connection alive by reading and ignoring any incoming text.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await hub.disconnect(ticket_id, websocket)
