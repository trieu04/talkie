from __future__ import annotations

import uuid

import sqlalchemy as sa
from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import Base
from src.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class SegmentTranslation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__: str = "segment_translations"
    __table_args__: tuple[Index, ...] = (
        Index("ix_segment_translations_segment_lang", "segment_id", "target_language", unique=True),
        Index(
            "ix_segment_translations_search",
            sa.func.to_tsvector("simple", sa.text("translated_text")),
            postgresql_using="gin",
        ),
    )

    segment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("transcript_segments.id", ondelete="CASCADE"),
        nullable=False,
    )
    target_language: Mapped[str] = mapped_column(String(10), nullable=False)
    translated_text: Mapped[str] = mapped_column(Text, nullable=False)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)

    segment: Mapped[object] = relationship(
        "TranscriptSegment",
        back_populates="translations",
    )
