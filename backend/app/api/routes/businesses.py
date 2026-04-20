from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select

from app.deps import CurrentUser, DbSession, require_role
from app.models.business import Business
from app.models.category import Category
from app.models.user import User, UserRole
from app.schemas.business import (
    BusinessCreate,
    BusinessOut,
    BusinessUpdate,
    BusinessWithDistance,
)
from app.services.geo import haversine_km

router = APIRouter(prefix="/api/businesses", tags=["businesses"])


@router.get("", response_model=list[BusinessWithDistance])
def list_businesses(
    db: DbSession,
    user: CurrentUser,
    category_slug: str | None = Query(default=None),
    max_km: float | None = Query(default=None, ge=0),
    q: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
) -> list[BusinessWithDistance]:
    stmt = select(Business)
    if category_slug:
        stmt = stmt.join(Category).where(Category.slug == category_slug)
    if q:
        stmt = stmt.where(Business.name.ilike(f"%{q}%"))
    rows = db.scalars(stmt).all()

    lat = user.lat
    lng = user.lng

    results: list[BusinessWithDistance] = []
    for b in rows:
        distance = (
            haversine_km(lat, lng, b.lat, b.lng) if lat is not None and lng is not None else 0.0
        )
        if max_km is not None and lat is not None and distance > max_km:
            continue
        results.append(
            BusinessWithDistance(
                id=b.id,
                name=b.name,
                description=b.description,
                phone=b.phone,
                address=b.address,
                lat=b.lat,
                lng=b.lng,
                category=b.category,  # type: ignore[arg-type]
                distance_km=round(distance, 2),
            )
        )
    results.sort(key=lambda r: r.distance_km)
    return results[:limit]


@router.post("", response_model=BusinessOut, status_code=status.HTTP_201_CREATED)
def create_business(
    payload: BusinessCreate,
    db: DbSession,
    _admin: User = Depends(require_role(UserRole.ADMIN)),
) -> BusinessOut:
    if not db.get(Category, payload.category_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown category_id"
        )
    b = Business(**payload.model_dump())
    db.add(b)
    db.commit()
    db.refresh(b)
    return BusinessOut.model_validate(b)


@router.patch("/{business_id}", response_model=BusinessOut)
def update_business(
    business_id: int,
    payload: BusinessUpdate,
    db: DbSession,
    _admin: User = Depends(require_role(UserRole.ADMIN)),
) -> BusinessOut:
    b = db.get(Business, business_id)
    if not b:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(b, field, value)
    db.commit()
    db.refresh(b)
    return BusinessOut.model_validate(b)


@router.delete("/{business_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_business(
    business_id: int,
    db: DbSession,
    _admin: User = Depends(require_role(UserRole.ADMIN)),
) -> None:
    b = db.get(Business, business_id)
    if not b:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    db.delete(b)
    db.commit()
