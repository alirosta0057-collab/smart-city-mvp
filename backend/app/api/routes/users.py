from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.deps import CurrentUser, DbSession, require_role
from app.models.user import User, UserRole
from app.schemas.user import AgentStatusUpdate, LocationUpdate, UserOut

router = APIRouter(prefix="/api/users", tags=["users"])


@router.patch("/me/location", response_model=UserOut)
def update_location(payload: LocationUpdate, user: CurrentUser, db: DbSession) -> UserOut:
    user.lat = payload.lat
    user.lng = payload.lng
    if payload.city is not None:
        user.city = payload.city
    if payload.country is not None:
        user.country = payload.country
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.patch("/me/status", response_model=UserOut)
def update_agent_status(
    payload: AgentStatusUpdate,
    user: CurrentUser,
    db: DbSession,
) -> UserOut:
    if user.role != UserRole.AGENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Only agents can update online status"
        )
    user.is_online = payload.is_online
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.get("", response_model=list[UserOut])
def list_users(
    db: DbSession,
    _admin: User = Depends(require_role(UserRole.ADMIN)),
) -> list[UserOut]:
    return [UserOut.model_validate(u) for u in db.scalars(select(User)).all()]
