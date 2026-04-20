from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class CategoryCreate(BaseModel):
    slug: str = Field(min_length=2, max_length=80)
    name: str = Field(min_length=2, max_length=120)
    icon: str | None = None
    description: str | None = None


class CategoryUpdate(BaseModel):
    name: str | None = None
    icon: str | None = None
    description: str | None = None


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    name: str
    icon: str | None = None
    description: str | None = None
