from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import UserRole


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=200)
    password: str = Field(min_length=6, max_length=200)
    role: UserRole = UserRole.CITIZEN


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str
    role: UserRole
    lat: float | None = None
    lng: float | None = None
    city: str | None = None
    country: str | None = None
    is_online: bool = False
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class LocationUpdate(BaseModel):
    lat: float
    lng: float
    city: str | None = None
    country: str | None = None


class AgentStatusUpdate(BaseModel):
    is_online: bool
