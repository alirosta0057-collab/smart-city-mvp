from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select

from app.core.security import create_access_token, hash_password, verify_password
from app.deps import CurrentUser, DbSession
from app.models.user import User
from app.schemas.user import LocationUpdate, Token, UserCreate, UserLogin, UserOut
from app.services.geo import extract_client_ip, locate_by_ip

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _token_for(user: User) -> Token:
    return Token(
        access_token=create_access_token(str(user.id), {"role": user.role.value}),
        user=UserOut.model_validate(user),
    )


@router.post("/register", response_model=Token)
async def register(payload: UserCreate, request: Request, db: DbSession) -> Token:
    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in use")

    user = User(
        email=payload.email,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )

    # Best-effort IP-based location snapshot on sign-up
    ip = extract_client_ip(dict(request.headers), request.client.host if request.client else "")
    loc = await locate_by_ip(ip)
    user.lat, user.lng, user.city, user.country = loc.lat, loc.lng, loc.city, loc.country

    db.add(user)
    db.commit()
    db.refresh(user)
    return _token_for(user)


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: DbSession) -> Token:
    user = db.scalar(select(User).where(User.email == payload.email))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )
    return _token_for(user)


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)


@router.post("/locate", response_model=UserOut)
async def locate_me(
    request: Request,
    user: CurrentUser,
    db: DbSession,
    payload: LocationUpdate | None = None,
) -> UserOut:
    """Accept explicit browser coordinates, or fall back to IP lookup."""
    if payload is not None:
        user.lat = payload.lat
        user.lng = payload.lng
        if payload.city is not None:
            user.city = payload.city
        if payload.country is not None:
            user.country = payload.country
    else:
        ip = extract_client_ip(
            dict(request.headers), request.client.host if request.client else ""
        )
        loc = await locate_by_ip(ip)
        user.lat, user.lng, user.city, user.country = (
            loc.lat,
            loc.lng,
            loc.city,
            loc.country,
        )
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


# expose a lightweight dependency alias so OAuth2PasswordBearer does not require
# an unrelated router
_ = Depends
