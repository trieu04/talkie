from __future__ import annotations

import enum
import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import DateTime, Enum, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import Base
from src.models.base import TimestampMixin, UpdatedAtMixin, UUIDPrimaryKeyMixin


class MeetingStatus(enum.StrEnum):
    CREATED = "created"
    RECORDING = "recording"
    PAUSED = "paused"
    ENDED = "ended"
    ENDED_ABNORMAL = "ended_abnormal"


class Meeting(UUIDPrimaryKeyMixin, TimestampMixin, UpdatedAtMixin, Base):
    __tablename__: str = "meetings"
    __table_args__: tuple[Index, ...] = (
        Index("ix_meetings_host_id", "host_id"),
        Index("ix_meetings_status", "status"),
        Index("ix_meetings_created_at", sa.text("created_at DESC")),
        Index(
            "uq_meetings_host_recording",
            "host_id",
            unique=True,
            postgresql_where=sa.text("status = 'recording'"),
        ),
    )

    host_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("hosts.id", ondelete="CASCADE"),
        nullable=False,
    )
    room_code: Mapped[str] = mapped_column(String(10), unique=True, index=True, nullable=False)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_language: Mapped[str] = mapped_column(String(10), nullable=False, server_default="vi")
    status: Mapped[MeetingStatus] = mapped_column(
        Enum(
            MeetingStatus,
            name="meeting_status",
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
        server_default=MeetingStatus.CREATED.value,
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    host: Mapped[object] = relationship("Host", back_populates="meetings")
    audio_chunks: Mapped[list[object]] = relationship(
        "AudioChunk", back_populates="meeting", cascade="all, delete-orphan"
    )
    transcript_segments: Mapped[list[object]] = relationship(
        "TranscriptSegment",
        back_populates="meeting",
        cascade="all, delete-orphan",
    )
    summary: Mapped[object | None] = relationship(
        "MeetingSummary",
        back_populates="meeting",
        uselist=False,
        cascade="all, delete-orphan",
    )
