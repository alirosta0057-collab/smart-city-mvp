from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class TicketStatus(str, enum.Enum):
    OPEN = "open"          # bot is handling
    QUEUED = "queued"      # escalated, waiting for human agent
    IN_PROGRESS = "in_progress"  # human agent handling
    RESOLVED = "resolved"
    CANCELLED = "cancelled"


class TicketPriority(str, enum.Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    SOS = "sos"


class Ticket(Base):
    __tablename__ = "tickets"

    id: Mapped[int] = mapped_column(primary_key=True)

    citizen_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    agent_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"), nullable=True)

    subject: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    status: Mapped[TicketStatus] = mapped_column(
        Enum(TicketStatus, native_enum=False), nullable=False, default=TicketStatus.OPEN
    )
    priority: Mapped[TicketPriority] = mapped_column(
        Enum(TicketPriority, native_enum=False), nullable=False, default=TicketPriority.NORMAL
    )

    # snapshot of citizen location at creation time
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    citizen = relationship("User", foreign_keys=[citizen_id])
    agent = relationship("User", foreign_keys=[agent_id])
    category = relationship("Category")
