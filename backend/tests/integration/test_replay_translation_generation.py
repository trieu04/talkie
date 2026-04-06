from __future__ import annotations

import uuid
from datetime import UTC, datetime

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Host, Meeting, MeetingStatus, TranscriptSegment


MOCK_PASSWORD_HASH = "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW"


async def test_public_translation_generation_is_cached(
    integration_client: AsyncClient,
    integration_db_session: AsyncSession,
):
    host = Host(
        id=uuid.uuid4(),
        email="translate@example.com",
        password_hash=MOCK_PASSWORD_HASH,
        display_name="Translate",
    )
    meeting = Meeting(
        id=uuid.uuid4(),
        host_id=host.id,
        title="Replay Translation",
        room_code="TRANS1",
        status=MeetingStatus.ENDED,
        source_language="vi",
        started_at=datetime.now(UTC),
        ended_at=datetime.now(UTC),
    )
    segment = TranscriptSegment(
        id=uuid.uuid4(),
        meeting_id=meeting.id,
        audio_chunk_id=None,
        sequence=1,
        text="Xin chào",
        start_time_ms=0,
        end_time_ms=1000,
        confidence=0.95,
        is_partial=False,
    )
    integration_db_session.add_all([host, meeting, segment])
    await integration_db_session.commit()

    first = await integration_client.post(
        "/api/v1/meetings/join/TRANS1/translate", json={"target_language": "en"}
    )
    second = await integration_client.post(
        "/api/v1/meetings/join/TRANS1/translate", json={"target_language": "en"}
    )

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["segments_translated"] == second.json()["total_segments"]
