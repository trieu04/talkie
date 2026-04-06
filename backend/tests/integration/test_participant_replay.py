from __future__ import annotations

import uuid
from datetime import UTC, datetime

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Host, Meeting, MeetingStatus, MeetingSummary, TranscriptSegment


MOCK_PASSWORD_HASH = "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW"


async def test_participant_replay_requires_ended_meeting(
    integration_client: AsyncClient,
    integration_db_session: AsyncSession,
):
    host = Host(
        id=uuid.uuid4(),
        email="active@example.com",
        password_hash=MOCK_PASSWORD_HASH,
        display_name="Active",
    )
    meeting = Meeting(
        id=uuid.uuid4(),
        host_id=host.id,
        title="Active Meeting",
        room_code="LIVE01",
        status=MeetingStatus.RECORDING,
        source_language="vi",
        started_at=datetime.now(UTC),
    )
    integration_db_session.add_all([host, meeting])
    await integration_db_session.commit()

    response = await integration_client.get("/api/v1/meetings/join/LIVE01/transcript")
    assert response.status_code == 404


async def test_participant_replay_returns_transcript_and_summary(
    integration_client: AsyncClient,
    integration_db_session: AsyncSession,
):
    host = Host(
        id=uuid.uuid4(),
        email="ended@example.com",
        password_hash=MOCK_PASSWORD_HASH,
        display_name="Ended",
    )
    meeting = Meeting(
        id=uuid.uuid4(),
        host_id=host.id,
        title="Ended Meeting",
        room_code="DONE01",
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
    summary = MeetingSummary(
        id=uuid.uuid4(),
        meeting_id=meeting.id,
        content="Summary",
        key_points=["Key"],
        decisions=[],
        action_items=[],
        transcript_snapshot_at=datetime.now(UTC),
        provider="mock-openai",
    )
    integration_db_session.add_all([host, meeting, segment, summary])
    await integration_db_session.commit()

    transcript_response = await integration_client.get("/api/v1/meetings/join/DONE01/transcript")
    summary_response = await integration_client.get("/api/v1/meetings/join/DONE01/summary")

    assert transcript_response.status_code == 200
    assert transcript_response.json()["total_segments"] == 1
    assert summary_response.status_code == 200
    assert summary_response.json()["content"] == "Summary"
