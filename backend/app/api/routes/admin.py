from __future__ import annotations

from datetime import UTC, datetime, timedelta

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


@router.get("/analytics")
def analytics(db: DbSession) -> dict[str, object]:
    """Aggregated time-series + category breakdown for the admin charts."""
    now = datetime.now(UTC)
    start = (now - timedelta(days=13)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    rows = db.execute(
        select(Ticket.created_at, Ticket.status, Ticket.priority, Ticket.category_id)
        .where(Ticket.created_at >= start)
    ).all()

    buckets: dict[str, dict[str, int]] = {}
    for i in range(14):
        day = (start + timedelta(days=i)).strftime("%Y-%m-%d")
        buckets[day] = {"total": 0, "sos": 0, "resolved": 0}

    for created_at, status_value, priority, _cat in rows:
        if created_at is None:
            continue
        key = created_at.strftime("%Y-%m-%d")
        if key not in buckets:
            continue
        buckets[key]["total"] += 1
        if priority and priority.value == "sos":
            buckets[key]["sos"] += 1
        if status_value == TicketStatus.RESOLVED:
            buckets[key]["resolved"] += 1

    daily = [{"date": d, **counts} for d, counts in buckets.items()]

    by_status: dict[str, int] = {}
    for s in TicketStatus:
        n = (
            db.scalar(select(func.count(Ticket.id)).where(Ticket.status == s))
            or 0
        )
        by_status[s.value] = n

    cat_rows = db.execute(
        select(
            Category.id,
            Category.name,
            Category.icon,
            func.count(Ticket.id),
        )
        .select_from(Category)
        .outerjoin(Ticket, Ticket.category_id == Category.id)
        .group_by(Category.id)
        .order_by(func.count(Ticket.id).desc())
    ).all()
    by_category = [
        {
            "id": cid,
            "name": name,
            "icon": icon,
            "count": int(count or 0),
        }
        for cid, name, icon, count in cat_rows
    ]

    top_agents_rows = db.execute(
        select(
            User.id,
            User.full_name,
            User.is_online,
            func.count(Ticket.id),
        )
        .select_from(User)
        .outerjoin(Ticket, Ticket.agent_id == User.id)
        .where(User.role == UserRole.AGENT)
        .group_by(User.id)
        .order_by(func.count(Ticket.id).desc())
        .limit(10)
    ).all()
    top_agents = [
        {
            "id": uid,
            "name": name,
            "is_online": bool(online),
            "count": int(count or 0),
        }
        for uid, name, online, count in top_agents_rows
    ]

    return {
        "daily": daily,
        "by_status": by_status,
        "by_category": by_category,
        "top_agents": top_agents,
    }
