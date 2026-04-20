from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User, UserRole
from app.services.geo import haversine_km


def find_nearest_online_agent(
    db: Session, lat: float | None, lng: float | None
) -> User | None:
    """Return the nearest online agent to (lat, lng).

    If location is missing for either side, falls back to any online agent.
    """
    agents = db.scalars(
        select(User).where(User.role == UserRole.AGENT, User.is_online.is_(True))
    ).all()
    if not agents:
        return None
    if lat is None or lng is None:
        return agents[0]

    located = [a for a in agents if a.lat is not None and a.lng is not None]
    if not located:
        return agents[0]

    return min(located, key=lambda a: haversine_km(lat, lng, a.lat, a.lng))
