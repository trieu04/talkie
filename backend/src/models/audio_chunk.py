from __future__ import annotations

import enum
import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import Base
from src.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class AudioChunkStatus(enum.StrEnum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class AudioChunk(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__: str = "audio_chunks"
    __table_args__: tuple[Index, ...] = (
        Index("ix_audio_chunks_meeting_sequence", "meeting_id", "sequence", unique=True),
        Index("ix_audio_chunks_status", "status"),
        Index(
            "ix_audio_chunks_pending",
            "status",
            "created_at",
            postgresql_where=sa.text("status = 'pending'"),
        ),
    )

    meeting_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("meetings.id", ondelete="CASCADE"),
        nullable=False,
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[AudioChunkStatus] = mapped_column(
        Enum(AudioChunkStatus, name="audio_chunk_status"),
        nullable=False,
        server_default=AudioChunkStatus.PENDING.value,
    )
    worker_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    meeting: Mapped[object] = relationship("Meeting", back_populates="audio_chunks")
    transcript_segments: Mapped[list[object]] = relationship(
        "TranscriptSegment",
        back_populates="audio_chunk",
    )
