from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from src.core.exceptions import AppError
from src.models import AudioChunkStatus
from src.services.worker_service import WorkerService


@pytest.mark.asyncio
async def test_claim_job_assigns_worker(mock_db_session: AsyncMock, audio_chunk_factory):
    chunk = audio_chunk_factory(status=AudioChunkStatus.PENDING)
    service = WorkerService(mock_db_session, AsyncMock())
    service._get_claimable_chunk = AsyncMock(return_value=chunk)  # type: ignore[method-assign]

    result = await service.claim_job(chunk.id, "worker-1")

    assert result.worker_id == "worker-1"
    assert result.status == AudioChunkStatus.ASSIGNED


def test_ensure_worker_owns_chunk_rejects_other_worker(
    mock_db_session: AsyncMock, audio_chunk_factory
):
    chunk = audio_chunk_factory(status=AudioChunkStatus.ASSIGNED, worker_id="worker-1")
    service = WorkerService(mock_db_session, AsyncMock())

    with pytest.raises(AppError, match="Worker does not own this audio chunk"):
        service._ensure_worker_owns_chunk(chunk, "worker-2")


def test_extend_timeout_moves_deadline_forward(mock_db_session: AsyncMock):
    service = WorkerService(mock_db_session, AsyncMock())
    timeout_at = datetime.now(UTC)
    extended = service._extend_timeout(timeout_at)
    assert extended > timeout_at
