from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import CurrentUser, DbSession
from app.models.message import Message, SenderKind
from app.models.ticket import Ticket, TicketPriority, TicketStatus
from app.models.user import User, UserRole
from app.schemas.ticket import (
    MessageCreate,
    MessageOut,
    TicketCreate,
    TicketOut,
)
from app.services.bot_agent import GREETING, generate_reply
from app.services.chat_hub import hub
from app.services.matching import find_nearest_online_agent

router = APIRouter(prefix="/api/tickets", tags=["tickets"])


def _to_out(t: Ticket) -> TicketOut:
    return TicketOut.model_validate(t)


def _ensure_ticket_access(ticket: Ticket, user: User) -> None:
    if user.role == UserRole.ADMIN:
        return
    if user.role == UserRole.CITIZEN and ticket.citizen_id == user.id:
        return
    if user.role == UserRole.AGENT and (
        ticket.agent_id == user.id or ticket.status == TicketStatus.QUEUED
    ):
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")


async def _post_message(
    db: Session,
    ticket: Ticket,
    sender_kind: SenderKind,
    sender_name: str,
    body: str,
    sender_user_id: int | None = None,
) -> Message:
    msg = Message(
        ticket_id=ticket.id,
        sender_kind=sender_kind,
        sender_name=sender_name,
        body=body,
        sender_user_id=sender_user_id,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    await hub.broadcast(
        ticket.id,
        {
            "type": "message",
            "message": MessageOut.model_validate(msg).model_dump(mode="json"),
            "ticket_status": ticket.status.value,
        },
    )
    return msg


@router.post("", response_model=TicketOut, status_code=status.HTTP_201_CREATED)
async def create_ticket(
    payload: TicketCreate,
    user: CurrentUser,
    db: DbSession,
) -> TicketOut:
    if user.role != UserRole.CITIZEN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Only citizens can open tickets"
        )

    ticket = Ticket(
        citizen_id=user.id,
        subject=payload.subject,
        description=payload.description,
        priority=payload.priority,
        category_id=payload.category_id,
        lat=payload.lat if payload.lat is not None else user.lat,
        lng=payload.lng if payload.lng is not None else user.lng,
        status=TicketStatus.OPEN,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    # Seed the chat: citizen's initial message + bot greeting / first reply.
    await _post_message(
        db,
        ticket,
        SenderKind.CITIZEN,
        user.full_name,
        payload.description,
        sender_user_id=user.id,
    )

    # For SOS priority, skip the bot and go straight to the nearest agent.
    if payload.priority == TicketPriority.SOS:
        await _escalate_to_agent(db, ticket)
    else:
        first = await generate_reply(payload.description, turn=1)
        await _post_message(db, ticket, SenderKind.BOT, "City Bot", first.body)
        if first.escalate:
            await _escalate_to_agent(db, ticket)
        else:
            await _post_message(db, ticket, SenderKind.BOT, "City Bot", GREETING)

    db.refresh(ticket)
    return _to_out(ticket)


async def _escalate_to_agent(db: Session, ticket: Ticket) -> None:
    agent = find_nearest_online_agent(db, ticket.lat, ticket.lng)
    if agent is None:
        ticket.status = TicketStatus.QUEUED
        ticket.agent_id = None
        db.commit()
        await _post_message(
            db,
            ticket,
            SenderKind.SYSTEM,
            "System",
            "No agent is online right now. Your ticket is queued and will be picked up shortly.",
        )
        return

    ticket.agent_id = agent.id
    ticket.status = TicketStatus.IN_PROGRESS
    db.commit()
    await _post_message(
        db,
        ticket,
        SenderKind.SYSTEM,
        "System",
        f"Connected to agent {agent.full_name}.",
    )


@router.get("", response_model=list[TicketOut])
def list_tickets(user: CurrentUser, db: DbSession) -> list[TicketOut]:
    stmt = select(Ticket).order_by(Ticket.created_at.desc())
    if user.role == UserRole.CITIZEN:
        stmt = stmt.where(Ticket.citizen_id == user.id)
    elif user.role == UserRole.AGENT:
        stmt = stmt.where(
            (Ticket.agent_id == user.id) | (Ticket.status == TicketStatus.QUEUED)
        )
    # admin: all
    return [_to_out(t) for t in db.scalars(stmt).all()]


@router.get("/{ticket_id}", response_model=TicketOut)
def get_ticket(ticket_id: int, user: CurrentUser, db: DbSession) -> TicketOut:
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    _ensure_ticket_access(ticket, user)
    return _to_out(ticket)


@router.get("/{ticket_id}/messages", response_model=list[MessageOut])
def list_messages(ticket_id: int, user: CurrentUser, db: DbSession) -> list[MessageOut]:
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    _ensure_ticket_access(ticket, user)
    msgs = db.scalars(
        select(Message).where(Message.ticket_id == ticket_id).order_by(Message.created_at)
    ).all()
    return [MessageOut.model_validate(m) for m in msgs]


@router.post("/{ticket_id}/messages", response_model=MessageOut)
async def post_message(
    ticket_id: int,
    payload: MessageCreate,
    user: CurrentUser,
    db: DbSession,
) -> MessageOut:
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    _ensure_ticket_access(ticket, user)
    if ticket.status in (TicketStatus.RESOLVED, TicketStatus.CANCELLED):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Ticket is closed"
        )

    sender_kind = (
        SenderKind.CITIZEN if user.role == UserRole.CITIZEN else SenderKind.AGENT
    )
    msg = await _post_message(
        db, ticket, sender_kind, user.full_name, payload.body, sender_user_id=user.id
    )

    # Bot replies only while it's handling the ticket and sender is a citizen.
    if ticket.status == TicketStatus.OPEN and sender_kind == SenderKind.CITIZEN:
        turn = (
            db.query(Message)
            .filter(Message.ticket_id == ticket.id, Message.sender_kind == SenderKind.BOT)
            .count()
            + 1
        )
        reply = await generate_reply(payload.body, turn=turn)
        await _post_message(db, ticket, SenderKind.BOT, "City Bot", reply.body)
        if reply.escalate:
            await _escalate_to_agent(db, ticket)

    return MessageOut.model_validate(msg)


@router.post("/{ticket_id}/claim", response_model=TicketOut)
async def claim_ticket(ticket_id: int, user: CurrentUser, db: DbSession) -> TicketOut:
    if user.role != UserRole.AGENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Only agents can claim tickets"
        )
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if ticket.status != TicketStatus.QUEUED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Ticket is not in queue"
        )
    ticket.agent_id = user.id
    ticket.status = TicketStatus.IN_PROGRESS
    db.commit()
    db.refresh(ticket)
    await hub.broadcast(
        ticket.id,
        {"type": "status", "ticket_status": ticket.status.value, "agent_id": user.id},
    )
    return _to_out(ticket)


@router.post("/{ticket_id}/resolve", response_model=TicketOut)
async def resolve_ticket(ticket_id: int, user: CurrentUser, db: DbSession) -> TicketOut:
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    _ensure_ticket_access(ticket, user)
    ticket.status = TicketStatus.RESOLVED
    db.commit()
    db.refresh(ticket)
    await hub.broadcast(
        ticket.id, {"type": "status", "ticket_status": ticket.status.value}
    )
    return _to_out(ticket)


@router.post("/{ticket_id}/cancel", response_model=TicketOut)
async def cancel_ticket(ticket_id: int, user: CurrentUser, db: DbSession) -> TicketOut:
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if user.role == UserRole.CITIZEN and ticket.citizen_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not yours")
    ticket.status = TicketStatus.CANCELLED
    db.commit()
    db.refresh(ticket)
    await hub.broadcast(
        ticket.id, {"type": "status", "ticket_status": ticket.status.value}
    )
    return _to_out(ticket)
