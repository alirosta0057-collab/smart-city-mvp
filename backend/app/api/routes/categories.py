from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.deps import DbSession, require_role
from app.models.category import Category
from app.models.user import User, UserRole
from app.schemas.category import CategoryCreate, CategoryOut, CategoryUpdate

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
def list_categories(db: DbSession) -> list[CategoryOut]:
    return [CategoryOut.model_validate(c) for c in db.scalars(select(Category)).all()]


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: CategoryCreate,
    db: DbSession,
    _admin: User = Depends(require_role(UserRole.ADMIN)),
) -> CategoryOut:
    if db.scalar(select(Category).where(Category.slug == payload.slug)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="slug already exists")
    c = Category(**payload.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return CategoryOut.model_validate(c)


@router.patch("/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: int,
    payload: CategoryUpdate,
    db: DbSession,
    _admin: User = Depends(require_role(UserRole.ADMIN)),
) -> CategoryOut:
    c = db.get(Category, category_id)
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(c, field, value)
    db.commit()
    db.refresh(c)
    return CategoryOut.model_validate(c)


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: int,
    db: DbSession,
    _admin: User = Depends(require_role(UserRole.ADMIN)),
) -> None:
    c = db.get(Category, category_id)
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    db.delete(c)
    db.commit()
