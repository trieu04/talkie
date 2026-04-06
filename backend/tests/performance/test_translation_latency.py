from __future__ import annotations

import time

import pytest

from src.services.translation_service import MockGoogleTranslateClient, TranslationService


@pytest.mark.asyncio
async def test_mock_translation_path_is_fast(mock_db_session, mock_redis):
    service = TranslationService(mock_db_session, mock_redis)
    service._client = MockGoogleTranslateClient()
    started_at = time.perf_counter()
    translated = await service.translate_text(
        "Xin chào", source_language="vi", target_language="en"
    )
    elapsed_ms = (time.perf_counter() - started_at) * 1000
    assert translated.startswith("[en]")
    assert elapsed_ms < 5000
