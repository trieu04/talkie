from __future__ import annotations

from collections.abc import Callable
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.core.exceptions import AppError
from src.models import SegmentTranslation, TranscriptSegment
from src.services.translation_service import (
    MockGoogleTranslateClient,
    TranslationService,
)


def make_scalar_result(value: object) -> MagicMock:
    result = MagicMock()
    result.scalar_one_or_none = MagicMock(return_value=value)
    return result


class TestTranslationService:
    @pytest.mark.parametrize(
        ("language", "expected"),
        [("en", "en"), ("vi", "vi"), ("ja", "ja"), ("zh-CN", "zh-cn")],
    )
    def test_validate_language_code_accepts_supported_values(self, language: str, expected: str):
        assert TranslationService.validate_language_code(language) == expected

    @pytest.mark.parametrize("language", ["123", "toolong-language", ""])
    def test_validate_language_code_rejects_invalid_values(self, language: str):
        with pytest.raises(AppError, match="Invalid language code"):
            _ = TranslationService.validate_language_code(language)

    def test_mock_google_translate_client_returns_formatted_text(self):
        client = MockGoogleTranslateClient()

        translated = client.translate("Hello", source_language="en", target_language="vi")

        assert translated == {"translatedText": "[vi] Hello"}

    @patch("src.services.translation_service.settings")
    async def test_translate_text_returns_translated_text(
        self,
        mock_settings: MagicMock,
        mock_db_session: AsyncMock,
        mock_redis: AsyncMock,
    ):
        mock_settings.google_translate_api_key = None
        service = TranslationService(mock_db_session, mock_redis)

        translated = await service.translate_text(
            "Hello",
            source_language="en",
            target_language="vi",
        )

        assert translated == "[vi] Hello"

    @patch("src.services.translation_service.settings")
    async def test_translate_segment_creates_and_returns_segment_translation(
        self,
        mock_settings: MagicMock,
        mock_db_session: AsyncMock,
        mock_redis: AsyncMock,
        transcript_segment_factory: Callable[..., TranscriptSegment],
    ):
        mock_settings.google_translate_api_key = None
        mock_db_session.execute = AsyncMock(return_value=make_scalar_result(None))
        service = TranslationService(mock_db_session, mock_redis)
        segment = transcript_segment_factory(text="Hello")

        translation = await service.translate_segment(
            segment,
            source_language="en",
            target_language="vi",
            publish=False,
        )

        assert translation.segment_id == segment.id
        assert translation.target_language == "vi"
        assert translation.translated_text == "[vi] Hello"
        assert translation.provider == "mock-google-translate"

    @patch("src.services.translation_service.settings")
    async def test_translate_segment_returns_cached_translation_if_exists(
        self,
        mock_settings: MagicMock,
        mock_db_session: AsyncMock,
        mock_redis: AsyncMock,
        transcript_segment_factory: Callable[..., TranscriptSegment],
        segment_translation_factory: Callable[..., SegmentTranslation],
    ):
        mock_settings.google_translate_api_key = None
        segment = transcript_segment_factory(text="Hello")
        cached_translation = segment_translation_factory(
            segment_id=segment.id, target_language="vi"
        )
        mock_db_session.execute = AsyncMock(return_value=make_scalar_result(cached_translation))
        service = TranslationService(mock_db_session, mock_redis)

        translation = await service.translate_segment(
            segment,
            source_language="en",
            target_language="vi",
            publish=False,
        )

        assert translation is cached_translation
