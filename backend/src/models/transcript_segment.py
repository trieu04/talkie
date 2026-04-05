from __future__ import annotations

import uuid

import sqlalchemy as sa
from sqlalchemy import Boolean, Float, ForeignKey, Index, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import Base
from src.models.base import TimestampMixin, UpdatedAtMixin, UUIDPrimaryKeyMixin


class TranscriptSegment(UUIDPrimaryKeyMixin, TimestampMixin, UpdatedAtMixin, Base):
    __tablename__: str = "transcript_segments"
    __table_args__: tuple[Index, ...] = (
        Index("ix_transcript_segments_meeting_sequence", "meeting_id", "sequence"),
        Index("ix_transcript_segments_meeting_time", "meeting_id", "start_time_ms"),
        Index(
            "ix_transcript_segments_search",
            sa.func.to_tsvector("simple", sa.text("text")),
            postgresql_using="gin",
        ),
    )

    meeting_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("meetings.id", ondelete="CASCADE"),
        nullable=False,
    )
    audio_chunk_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("audio_chunks.id", ondelete="SET NULL"),
        nullable=True,
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    start_time_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    end_time_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_partial: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=sa.text("false"),
    )

    meeting: Mapped[object] = relationship("Meeting", back_populates="transcript_segments")
    audio_chunk: Mapped[object | None] = relationship(
        "AudioChunk",
        back_populates="transcript_segments",
    )
    translations: Mapped[list[object]] = relationship(
        "SegmentTranslation",
        back_populates="segment",
        cascade="all, delete-orphan",
    )
