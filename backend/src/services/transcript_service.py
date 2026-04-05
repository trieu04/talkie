from __future__ import annotations

import json
import re
import uuid
from datetime import UTC, datetime
from typing import cast
from uuid import UUID

from redis.asyncio import Redis
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import NotFoundError
from src.models import Meeting, TranscriptSegment


class TranscriptService:
    def __init__(self, db: AsyncSession, redis: Redis):
        self.db: AsyncSession = db
        self.redis: Redis = redis

    async def create_segment(
        self,
        meeting_id: UUID,
        audio_chunk_id: UUID | None,
        text: str,
        start_time_ms: int,
        end_time_ms: int,
        confidence: float | None = None,
        is_partial: bool = False,
    ) -> TranscriptSegment:
        await self._lock_meeting(meeting_id)
        sequence = await self._get_next_sequence(meeting_id)

        segment = TranscriptSegment(
            meeting_id=meeting_id,
            audio_chunk_id=audio_chunk_id,
            sequence=sequence,
            text=text,
            start_time_ms=start_time_ms,
            end_time_ms=end_time_ms,
            confidence=confidence,
            is_partial=is_partial,
        )
        self.db.add(segment)
        await self.db.commit()
        await self.db.refresh(segment)

        await self.publish_segment(meeting_id, segment, event_type="transcript_segment")
        return segment

    async def update_segment(
        self,
        segment_id: UUID,
        text: str,
        is_partial: bool = True,
    ) -> TranscriptSegment:
        segment = await self._get_segment_or_raise(segment_id)
        segment.text = text
        segment.is_partial = is_partial

        await self.db.commit()
        await self.db.refresh(segment)

        await self.publish_segment(
            segment.meeting_id,
            segment,
            event_type="transcript_update",
        )
        return segment

    async def finalize_segment(
        self,
        segment_id: UUID,
        text: str | None = None,
        confidence: float | None = None,
    ) -> TranscriptSegment:
        segment = await self._get_segment_or_raise(segment_id)
        if text is not None:
            segment.text = text
        if confidence is not None:
            segment.confidence = confidence
        segment.is_partial = False

        await self.db.commit()
        await self.db.refresh(segment)

        await self.publish_segment(
            segment.meeting_id,
            segment,
            event_type="transcript_finalized",
        )
        return segment

    async def get_segment(self, segment_id: UUID) -> TranscriptSegment | None:
        return await self.db.get(TranscriptSegment, segment_id)

    async def get_segments_by_meeting(
        self,
        meeting_id: UUID,
        limit: int = 100,
        offset: int = 0,
    ) -> list[TranscriptSegment]:
        stmt = (
            select(TranscriptSegment)
            .where(TranscriptSegment.meeting_id == meeting_id)
            .order_by(TranscriptSegment.sequence.asc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_segments_since(
        self,
        meeting_id: UUID,
        last_sequence: int,
    ) -> list[TranscriptSegment]:
        stmt = (
            select(TranscriptSegment)
            .where(
                TranscriptSegment.meeting_id == meeting_id,
                TranscriptSegment.sequence > last_sequence,
            )
            .order_by(TranscriptSegment.sequence.asc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def publish_segment(
        self,
        meeting_id: UUID,
        segment: TranscriptSegment,
        event_type: str = "transcript_segment",
    ) -> None:
        channel = self._channel_name(meeting_id)
        payload = {
            "type": event_type,
            "payload": {
                "id": str(segment.id),
                "sequence": segment.sequence,
                "text": segment.text,
                "start_time_ms": segment.start_time_ms,
                "end_time_ms": segment.end_time_ms,
                "is_partial": segment.is_partial,
                "confidence": segment.confidence,
            },
            "timestamp": datetime.now(UTC)
            .isoformat(timespec="milliseconds")
            .replace("+00:00", "Z"),
            "message_id": str(uuid.uuid4()),
        }
        subscriber_count = cast(
            int,
            await self.redis.publish(  # pyright: ignore[reportUnknownMemberType]
                channel,
                json.dumps(payload),
            ),
        )
        _ = subscriber_count

    async def search_segments(
        self,
        meeting_id: UUID,
        query: str,
        limit: int = 20,
    ) -> list[TranscriptSegment]:
        normalized_query = self._normalize_tsquery(query)
        if normalized_query is None:
            return []

        search_vector = func.to_tsvector("simple", TranscriptSegment.text)
        ts_query = func.to_tsquery("simple", normalized_query)
        rank = func.ts_rank(search_vector, ts_query)

        stmt = (
            select(TranscriptSegment)
            .where(
                TranscriptSegment.meeting_id == meeting_id,
                search_vector.op("@@")(ts_query),
            )
            .order_by(rank.desc(), TranscriptSegment.sequence.asc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def _get_segment_or_raise(self, segment_id: UUID) -> TranscriptSegment:
        segment = await self.get_segment(segment_id)
        if segment is None:
            raise NotFoundError("Transcript segment not found")
        return segment

    async def _lock_meeting(self, meeting_id: UUID) -> None:
        stmt = select(Meeting.id).where(Meeting.id == meeting_id).with_for_update()
        result = await self.db.execute(stmt)
        if result.scalar_one_or_none() is None:
            raise NotFoundError("Meeting not found")

    async def _get_next_sequence(self, meeting_id: UUID) -> int:
        stmt = select(func.max(TranscriptSegment.sequence)).where(
            TranscriptSegment.meeting_id == meeting_id
        )
        result = await self.db.execute(stmt)
        last_sequence = result.scalar_one()
        return (last_sequence or 0) + 1

    def _channel_name(self, meeting_id: UUID) -> str:
        return f"meeting:{meeting_id}:transcript"

    def _normalize_tsquery(self, query: str) -> str | None:
        terms = [match.group(0) for match in re.finditer(r"[A-Za-z0-9_]+", query.lower())]
        if not terms:
            return None
        return " & ".join(f"{term}:*" for term in terms)
