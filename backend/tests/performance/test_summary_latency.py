from __future__ import annotations

import time
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from src.services.summary_service import SummaryService


@pytest.mark.asyncio
async def test_summary_generation_with_mocked_segments_is_fast(mock_db_session):
    service = SummaryService(mock_db_session)
    segments = [
        type("Segment", (), {"text": "Decided to ship", "is_partial": False})(),
        type("Segment", (), {"text": "Alex will prepare notes by Friday", "is_partial": False})(),
    ]
    service._get_meeting_or_raise = AsyncMock(return_value=object())  # type: ignore[method-assign]
    service._get_all_segments = AsyncMock(return_value=segments)  # type: ignore[method-assign]
    started_at = time.perf_counter()
    payload = await service.generate_summary(uuid4())
    elapsed_ms = (time.perf_counter() - started_at) * 1000
    assert payload.content
    assert elapsed_ms < 60000
