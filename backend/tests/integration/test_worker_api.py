from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import AudioChunk, AudioChunkStatus, Host, Meeting, MeetingStatus


MOCK_PASSWORD_HASH = "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW"


@pytest.fixture
async def meeting_with_chunks(
    integration_db_session: AsyncSession,
) -> tuple[Meeting, list[AudioChunk]]:
    host = Host(
        id=uuid.uuid4(),
        email="worker-host@example.com",
        password_hash=MOCK_PASSWORD_HASH,
        display_name="Worker Host",
    )
    integration_db_session.add(host)

    meeting = Meeting(
        id=uuid.uuid4(),
        host_id=host.id,
        title="Worker Meeting",
        room_code="WRK123",
        status=MeetingStatus.RECORDING,
        source_language="vi",
        started_at=datetime.now(UTC),
    )
    integration_db_session.add(meeting)

    chunks = []
    for i in range(3):
        chunk = AudioChunk(
            id=uuid.uuid4(),
            meeting_id=meeting.id,
            sequence=i,
            storage_key=f"meetings/{meeting.id}/audio/{i}.opus",
            duration_ms=5000,
            status=AudioChunkStatus.PENDING,
        )
        integration_db_session.add(chunk)
        chunks.append(chunk)
    await integration_db_session.commit()
    return meeting, chunks


async def test_get_pending_jobs(
    integration_client: AsyncClient,
    meeting_with_chunks: tuple[Meeting, list[AudioChunk]],
):
    response = await integration_client.get(
        "/api/v1/worker/jobs",
        params={"worker_id": "test-worker-1", "limit": 2},
    )
    assert response.status_code == 200
    body = response.json()
    assert "jobs" in body
    assert len(body["jobs"]) <= 2
    for job in body["jobs"]:
        assert "chunk_id" in job
        assert "meeting_id" in job
        assert "audio_url" in job
        assert "source_language" in job
        assert "timeout_seconds" in job


async def test_get_pending_jobs_empty(integration_client: AsyncClient):
    response = await integration_client.get(
        "/api/v1/worker/jobs",
        params={"worker_id": "test-worker-1"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["jobs"] == []


async def test_claim_job_success(
    integration_client: AsyncClient,
    meeting_with_chunks: tuple[Meeting, list[AudioChunk]],
):
    _, chunks = meeting_with_chunks
    chunk = chunks[0]

    response = await integration_client.post(
        f"/api/v1/worker/jobs/{chunk.id}/claim",
        json={"worker_id": "test-worker-1"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "assigned"
    assert body["chunk_id"] == str(chunk.id)
    assert body["worker_id"] == "test-worker-1"


async def test_claim_job_not_found(integration_client: AsyncClient):
    fake_id = uuid.uuid4()
    response = await integration_client.post(
        f"/api/v1/worker/jobs/{fake_id}/claim",
        json={"worker_id": "test-worker-1"},
    )
    assert response.status_code == 404


async def test_submit_result_success(
    integration_client: AsyncClient,
    meeting_with_chunks: tuple[Meeting, list[AudioChunk]],
    integration_db_session: AsyncSession,
):
    _, chunks = meeting_with_chunks
    chunk = chunks[0]

    chunk.status = AudioChunkStatus.ASSIGNED
    chunk.worker_id = "test-worker-1"
    chunk.assigned_at = datetime.now(UTC) + timedelta(seconds=30)
    await integration_db_session.commit()

    response = await integration_client.post(
        f"/api/v1/worker/jobs/{chunk.id}/result",
        json={
            "worker_id": "test-worker-1",
            "segments": [
                {
                    "text": "Xin chào mọi người",
                    "start_offset_ms": 0,
                    "end_offset_ms": 2500,
                    "confidence": 0.95,
                },
                {
                    "text": "Hôm nay chúng ta họp",
                    "start_offset_ms": 2500,
                    "end_offset_ms": 5000,
                    "confidence": 0.88,
                },
            ],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "accepted"
    assert body["segments_created"] == 2


async def test_heartbeat_success(
    integration_client: AsyncClient,
    meeting_with_chunks: tuple[Meeting, list[AudioChunk]],
    integration_db_session: AsyncSession,
):
    _, chunks = meeting_with_chunks
    chunk = chunks[0]

    chunk.status = AudioChunkStatus.ASSIGNED
    chunk.worker_id = "test-worker-1"
    chunk.assigned_at = datetime.now(UTC) + timedelta(seconds=30)
    await integration_db_session.commit()

    response = await integration_client.post(
        f"/api/v1/worker/jobs/{chunk.id}/heartbeat",
        json={"worker_id": "test-worker-1", "progress_percent": 50},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "acknowledged"
    assert "timeout_extended_to" in body


async def test_heartbeat_wrong_worker(
    integration_client: AsyncClient,
    meeting_with_chunks: tuple[Meeting, list[AudioChunk]],
    integration_db_session: AsyncSession,
):
    _, chunks = meeting_with_chunks
    chunk = chunks[0]

    chunk.status = AudioChunkStatus.ASSIGNED
    chunk.worker_id = "test-worker-1"
    chunk.assigned_at = datetime.now(UTC) + timedelta(seconds=30)
    await integration_db_session.commit()

    response = await integration_client.post(
        f"/api/v1/worker/jobs/{chunk.id}/heartbeat",
        json={"worker_id": "wrong-worker", "progress_percent": 50},
    )
    assert response.status_code == 409


async def test_submit_empty_segments_for_silence(
    integration_client: AsyncClient,
    meeting_with_chunks: tuple[Meeting, list[AudioChunk]],
    integration_db_session: AsyncSession,
):
    from sqlalchemy import select
    from src.models import TranscriptSegment

    _, chunks = meeting_with_chunks
    chunk = chunks[0]

    chunk.status = AudioChunkStatus.ASSIGNED
    chunk.worker_id = "test-worker-1"
    chunk.assigned_at = datetime.now(UTC) + timedelta(seconds=30)
    await integration_db_session.commit()

    response = await integration_client.post(
        f"/api/v1/worker/jobs/{chunk.id}/result",
        json={
            "worker_id": "test-worker-1",
            "segments": [],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "accepted"
    assert body["segments_created"] == 0

    await integration_db_session.refresh(chunk)
    assert chunk.status == AudioChunkStatus.COMPLETED

    result = await integration_db_session.execute(
        select(TranscriptSegment).where(TranscriptSegment.audio_chunk_id == chunk.id)
    )
    segments = result.scalars().all()
    assert len(segments) == 0
