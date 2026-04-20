from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.ticket import TicketPriority, TicketStatus
from app.schemas.category import CategoryOut
from app.schemas.user import UserOut


class TicketCreate(BaseModel):
    subject: str = Field(min_length=2, max_length=200)
    description: str = Field(min_length=2)
    priority: TicketPriority = TicketPriority.NORMAL
    category_id: int | None = None
    lat: float | None = None
    lng: float | None = None


class TicketOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    subject: str
    description: str
    status: TicketStatus
    priority: TicketPriority
    lat: float | None = None
    lng: float | None = None
    citizen: UserOut
    agent: UserOut | None = None
    category: CategoryOut | None = None
    created_at: datetime
    updated_at: datetime


class MessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_id: int
    sender_kind: str
    sender_name: str
    sender_user_id: int | None = None
    body: str
    created_at: datetime
