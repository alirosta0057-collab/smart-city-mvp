from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.category import CategoryOut


class BusinessCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    description: str | None = None
    phone: str | None = None
    address: str | None = None
    lat: float
    lng: float
    category_id: int


class BusinessUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    phone: str | None = None
    address: str | None = None
    lat: float | None = None
    lng: float | None = None
    category_id: int | None = None


class BusinessOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None
    phone: str | None = None
    address: str | None = None
    lat: float
    lng: float
    category: CategoryOut


class BusinessWithDistance(BusinessOut):
    distance_km: float
