from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select

from app.deps import DbSession, require_role
from app.models.business import Business
from app.models.category import Category
from app.models.ticket import Ticket, TicketStatus
from app.models.user import User, UserRole

router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)


@router.get("/stats")
def stats(db: DbSession) -> dict[str, int | dict[str, int]]:
    total_users = db.scalar(select(func.count(User.id))) or 0
    total_citizens = (
        db.scalar(select(func.count(User.id)).where(User.role == UserRole.CITIZEN)) or 0
    )
    total_agents = (
        db.scalar(select(func.count(User.id)).where(User.role == UserRole.AGENT)) or 0
    )
    online_agents = (
        db.scalar(
            select(func.count(User.id)).where(
                User.role == UserRole.AGENT, User.is_online.is_(True)
            )
        )
        or 0
    )
    total_businesses = db.scalar(select(func.count(Business.id))) or 0
    total_categories = db.scalar(select(func.count(Category.id))) or 0

    by_status: dict[str, int] = {}
    for status_value in TicketStatus:
        n = (
            db.scalar(select(func.count(Ticket.id)).where(Ticket.status == status_value))
            or 0
        )
        by_status[status_value.value] = n

    total_tickets = sum(by_status.values())

    return {
        "users": {
            "total": total_users,
            "citizens": total_citizens,
            "agents": total_agents,
            "agents_online": online_agents,
        },
        "directory": {
            "categories": total_categories,
            "businesses": total_businesses,
        },
        "tickets": {"total": total_tickets, **by_status},
    }
