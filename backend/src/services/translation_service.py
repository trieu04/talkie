from __future__ import annotations

import json
import re
import uuid
from collections.abc import Iterable
from datetime import UTC, datetime
from importlib import import_module
from typing import Protocol, cast
from uuid import UUID

from fastapi import status
from redis.asyncio import Redis
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.exceptions import AppError, NotFoundError
from src.models import SegmentTranslation, TranscriptSegment
from src.services.transcript_service import TranscriptService

LANGUAGE_PATTERN = re.compile(r"^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$")


class TranslationClient(Protocol):
    def translate(
        self,
        text: str,
        *,
        source_language: str,
        target_language: str,
    ) -> dict[str, str]: ...


class MockGoogleTranslateClient:
    def translate(self, text: str, *, source_language: str, target_language: str) -> dict[str, str]:
        _ = source_language
        return {"translatedText": f"[{target_language}] {text}"}


class TranslationService:
    def __init__(self, db: AsyncSession, redis: Redis):
        self.db: AsyncSession = db
        self.redis: Redis = redis
        self.transcript_service: TranscriptService = TranscriptService(db, redis)
        self._client: TranslationClient = self._build_client()
        self._provider: str = (
            "mock-google-translate"
            if isinstance(self._client, MockGoogleTranslateClient)
            else "google-cloud-translate"
        )

    async def translate_text(
        self,
        text: str,
        *,
        source_language: str,
        target_language: str,
    ) -> str:
        _ = self.validate_language_code(source_language)
        _ = self.validate_language_code(target_language)
        if not text:
            return text

        translated = await self._translate_via_client(
            text,
            source_language=source_language,
            target_language=target_language,
        )
        return translated

    async def translate_segment(
        self,
        segment: TranscriptSegment,
        *,
        source_language: str,
        target_language: str,
        publish: bool = True,
    ) -> SegmentTranslation:
        _ = self.validate_language_code(source_language)
        _ = self.validate_language_code(target_language)

        cached = await self.get_cached_translation(segment.id, target_language)
        if cached is not None:
            return cached

        translated_text = await self.translate_text(
            segment.text,
            source_language=source_language,
            target_language=target_language,
        )
        translation = SegmentTranslation(
            segment_id=segment.id,
            target_language=target_language,
            translated_text=translated_text,
            provider=self._provider,
        )
        self.db.add(translation)
        await self.db.commit()
        await self.db.refresh(translation)

        if publish:
            await self.publish_translation(segment, translation)
        return translation

    async def translate_segments(
        self,
        segments: Iterable[TranscriptSegment],
        *,
        source_language: str,
        target_language: str,
        publish: bool = True,
    ) -> list[SegmentTranslation]:
        translations: list[SegmentTranslation] = []
        for segment in segments:
            translation = await self.translate_segment(
                segment,
                source_language=source_language,
                target_language=target_language,
                publish=publish,
            )
            translations.append(translation)
        return translations

    async def backfill_meeting_translations(
        self,
        meeting_id: UUID,
        *,
        source_language: str,
        target_language: str,
    ) -> tuple[int, int]:
        _ = self.validate_language_code(source_language)
        _ = self.validate_language_code(target_language)

        segments = await self.transcript_service.get_segments_by_meeting(
            meeting_id,
            limit=10_000,
            offset=0,
        )
        translated_count = 0
        for segment in segments:
            existing = await self.get_cached_translation(segment.id, target_language)
            if existing is not None:
                continue

            _ = await self.translate_segment(
                segment,
                source_language=source_language,
                target_language=target_language,
                publish=True,
            )
            translated_count += 1

        return translated_count, len(segments)

    async def count_cached_translations(self, meeting_id: UUID, target_language: str) -> int:
        _ = self.validate_language_code(target_language)
        stmt = (
            select(func.count())
            .join(TranscriptSegment, TranscriptSegment.id == SegmentTranslation.segment_id)
            .where(
                TranscriptSegment.meeting_id == meeting_id,
                SegmentTranslation.target_language == target_language,
            )
        )
        result = await self.db.execute(stmt)
        return int(result.scalar_one())

    async def get_segment_or_raise(self, segment_id: UUID) -> TranscriptSegment:
        segment = await self.db.get(TranscriptSegment, segment_id)
        if segment is None:
            raise NotFoundError("Transcript segment not found")
        return segment

    async def get_cached_translation(
        self,
        segment_id: UUID,
        target_language: str,
    ) -> SegmentTranslation | None:
        stmt = select(SegmentTranslation).where(
            SegmentTranslation.segment_id == segment_id,
            SegmentTranslation.target_language == target_language,
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def publish_translation(
        self,
        segment: TranscriptSegment,
        translation: SegmentTranslation,
    ) -> None:
        payload = {
            "type": "translation_segment",
            "payload": {
                "segment_id": str(segment.id),
                "sequence": segment.sequence,
                "target_language": translation.target_language,
                "translated_text": translation.translated_text,
            },
            "timestamp": datetime.now(UTC)
            .isoformat(timespec="milliseconds")
            .replace("+00:00", "Z"),
            "message_id": str(uuid.uuid4()),
        }
        subscriber_count = cast(
            int,
            await self.redis.publish(  # pyright: ignore[reportUnknownMemberType]
                self._channel_name(segment.meeting_id),
                json.dumps(payload),
            ),
        )
        _ = subscriber_count

    @staticmethod
    def validate_language_code(language: str) -> str:
        normalized = language.strip().lower()
        if LANGUAGE_PATTERN.fullmatch(normalized):
            return normalized

        raise AppError(
            message="Invalid language code",
            code="INVALID_LANGUAGE",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    def _build_client(self) -> TranslationClient:
        if not settings.google_translate_api_key:
            return MockGoogleTranslateClient()

        try:
            module = import_module("google.cloud.translate_v2")
            client_factory = getattr(module, "Client", None)
            if client_factory is None:
                return MockGoogleTranslateClient()
            return cast(TranslationClient, client_factory())
        except Exception:
            return MockGoogleTranslateClient()

    async def _translate_via_client(
        self,
        text: str,
        *,
        source_language: str,
        target_language: str,
    ) -> str:
        result = self._client.translate(
            text,
            source_language=source_language,
            target_language=target_language,
        )
        translated_text = result.get("translatedText")
        if not isinstance(translated_text, str):
            raise AppError(
                message="Translation provider returned an invalid response",
                code="TRANSLATION_FAILED",
                status_code=status.HTTP_502_BAD_GATEWAY,
            )
        return translated_text

    @staticmethod
    def _channel_name(meeting_id: UUID) -> str:
        return f"meeting:{meeting_id}:translation"
