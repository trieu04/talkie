from __future__ import annotations

import json
import re
import uuid
from datetime import UTC, datetime
from typing import cast
from uuid import UUID

from redis.asyncio import Redis
from sqlalchemy import func, select, union_all
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, with_loader_criteria

from src.core.exceptions import NotFoundError
from src.models import Meeting, SegmentTranslation, TranscriptSegment


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
        include_translations: set[str] | None = None,
    ) -> list[TranscriptSegment]:
        stmt = (
            select(TranscriptSegment)
            .where(TranscriptSegment.meeting_id == meeting_id)
            .order_by(TranscriptSegment.sequence.asc())
            .limit(limit)
            .offset(offset)
        )
        if include_translations is not None:
            stmt = stmt.options(selectinload(TranscriptSegment.translations))
            if include_translations:
                stmt = stmt.options(
                    with_loader_criteria(
                        SegmentTranslation,
                        SegmentTranslation.target_language.in_(include_translations),
                        include_aliases=True,
                    )
                )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def count_segments_by_meeting(self, meeting_id: UUID) -> int:
        stmt = (
            select(func.count())
            .select_from(TranscriptSegment)
            .where(TranscriptSegment.meeting_id == meeting_id)
        )
        result = await self.db.execute(stmt)
        return int(result.scalar_one())

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
        language: str | None = None,
        include_translations: set[str] | None = None,
    ) -> list[TranscriptSegment]:
        normalized_query = self._normalize_tsquery(query)
        if normalized_query is None:
            return []

        ts_query = func.to_tsquery("simple", normalized_query)
        source_vector = func.to_tsvector("simple", TranscriptSegment.text)
        source_rank = func.ts_rank(source_vector, ts_query)

        source_matches = select(
            TranscriptSegment.id.label("segment_id"),
            TranscriptSegment.sequence.label("sequence"),
            source_rank.label("rank"),
        ).where(
            TranscriptSegment.meeting_id == meeting_id,
            source_vector.op("@@")(ts_query),
        )

        rank_queries = [source_matches]
        if language is not None:
            translation_query = self._translation_rank_query(meeting_id, ts_query, language)
            rank_queries = [translation_query]
        else:
            rank_queries.append(self._translation_rank_query(meeting_id, ts_query))

        combined_select = rank_queries[0] if len(rank_queries) == 1 else union_all(*rank_queries)
        combined_matches = combined_select.subquery()
        ranking_stmt = (
            select(
                combined_matches.c.segment_id,
                func.max(combined_matches.c.rank).label("rank"),
                func.min(combined_matches.c.sequence).label("sequence"),
            )
            .group_by(combined_matches.c.segment_id)
            .order_by(
                func.max(combined_matches.c.rank).desc(),
                func.min(combined_matches.c.sequence).asc(),
            )
            .limit(limit)
        )
        ranking_result = await self.db.execute(ranking_stmt)
        ranked_rows = ranking_result.all()
        if not ranked_rows:
            return []

        segment_ids = [cast(UUID, row.segment_id) for row in ranked_rows]
        segments_stmt = select(TranscriptSegment).where(TranscriptSegment.id.in_(segment_ids))
        if include_translations is not None:
            segments_stmt = segments_stmt.options(selectinload(TranscriptSegment.translations))
            if include_translations:
                segments_stmt = segments_stmt.options(
                    with_loader_criteria(
                        SegmentTranslation,
                        SegmentTranslation.target_language.in_(include_translations),
                        include_aliases=True,
                    )
                )
        segments_result = await self.db.execute(segments_stmt)
        segment_map = {segment.id: segment for segment in segments_result.scalars().all()}
        return [segment_map[segment_id] for segment_id in segment_ids if segment_id in segment_map]

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

    def _translation_rank_query(
        self, meeting_id: UUID, ts_query: object, language: str | None = None
    ):
        translation_vector = func.to_tsvector("simple", SegmentTranslation.translated_text)
        translation_rank = func.ts_rank(translation_vector, ts_query)
        stmt = (
            select(
                TranscriptSegment.id.label("segment_id"),
                TranscriptSegment.sequence.label("sequence"),
                translation_rank.label("rank"),
            )
            .join(SegmentTranslation, SegmentTranslation.segment_id == TranscriptSegment.id)
            .where(
                TranscriptSegment.meeting_id == meeting_id,
                translation_vector.op("@@")(ts_query),
            )
        )
        if language is not None:
            stmt = stmt.where(SegmentTranslation.target_language == language)
        return stmt
