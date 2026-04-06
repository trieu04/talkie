from __future__ import annotations

import pytest

from src.services.transcript_service import TranscriptService


@pytest.mark.asyncio
async def test_sync_returns_segments_after_last_sequence(
    mock_db_session, mock_redis, transcript_segment_factory
):
    service = TranscriptService(mock_db_session, mock_redis)
    expected = [transcript_segment_factory(sequence=2), transcript_segment_factory(sequence=3)]
    mock_result = type(
        "Result",
        (),
        {"scalars": lambda self: type("Scalars", (), {"all": lambda self: expected})()},
    )()
    mock_db_session.execute.return_value = mock_result

    segments = await service.get_segments_since(expected[0].meeting_id, 1)

    assert [segment.sequence for segment in segments] == [2, 3]
