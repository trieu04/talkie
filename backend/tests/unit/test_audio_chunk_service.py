from __future__ import annotations

from collections.abc import Callable
from datetime import datetime
from typing import cast
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.core.exceptions import ConflictError
from src.models import AudioChunk, AudioChunkStatus
from src.services.audio_chunk_service import AudioChunkService


def make_scalar_result(value: object) -> MagicMock:
    result = MagicMock()
    result.scalar_one_or_none = MagicMock(return_value=value)
    return result


def make_scalars_result(values: list[AudioChunk]) -> MagicMock:
    result = MagicMock()
    scalars = MagicMock()
    scalars.all = MagicMock(return_value=values)
    result.scalars = MagicMock(return_value=scalars)
    return result


class TestAudioChunkService:
    async def test_create_chunk_creates_chunk_and_uploads_to_storage(
        self,
        mock_db_session: AsyncMock,
        mock_storage: AsyncMock,
    ):
        meeting_id = uuid.uuid4()
        service = AudioChunkService(mock_db_session, mock_storage)
        upload_calls: list[tuple[str, bytes, str]] = []

        async def capture_upload(storage_key: str, data: bytes, *, content_type: str) -> None:
            upload_calls.append((storage_key, data, content_type))

        mock_db_session.execute = AsyncMock(return_value=make_scalar_result(None))
        mock_storage.upload_bytes = AsyncMock(side_effect=capture_upload)

        chunk = await service.create_chunk(meeting_id, 3, b"audio-bytes", 5000)

        assert chunk.meeting_id == meeting_id
        assert chunk.sequence == 3
        assert chunk.status == AudioChunkStatus.PENDING
        assert chunk.storage_key == f"meetings/{meeting_id}/audio/3.opus"
        assert upload_calls == [(chunk.storage_key, b"audio-bytes", "audio/opus")]

    async def test_create_chunk_raises_conflict_error_on_duplicate_sequence(
        self,
        mock_db_session: AsyncMock,
        mock_storage: AsyncMock,
    ):
        service = AudioChunkService(mock_db_session, mock_storage)
        mock_db_session.execute = AsyncMock(return_value=make_scalar_result(uuid.uuid4()))

        with pytest.raises(ConflictError, match="Audio chunk sequence 3 already exists"):
            _ = await service.create_chunk(uuid.uuid4(), 3, b"audio-bytes", 5000)

    @patch("src.services.audio_chunk_service.datetime")
    async def test_assign_chunk_to_worker_sets_assigned_status(
        self,
        mock_datetime: MagicMock,
        mock_db_session: AsyncMock,
        audio_chunk_factory: Callable[..., AudioChunk],
        frozen_time: datetime,
    ):
        chunk = audio_chunk_factory(status=AudioChunkStatus.PENDING)
        cast(MagicMock, mock_datetime.now).return_value = frozen_time
        mock_db_session.execute = AsyncMock(return_value=make_scalar_result(chunk))
        service = AudioChunkService(mock_db_session, AsyncMock())

        result = await service.assign_chunk_to_worker(chunk.id, "worker-1")

        assert result is chunk
        assert chunk.status == AudioChunkStatus.ASSIGNED
        assert chunk.worker_id == "worker-1"
        assert chunk.assigned_at == frozen_time

    @patch("src.services.audio_chunk_service.datetime")
    async def test_complete_chunk_sets_completed_status(
        self,
        mock_datetime: MagicMock,
        mock_db_session: AsyncMock,
        audio_chunk_factory: Callable[..., AudioChunk],
        frozen_time: datetime,
    ):
        chunk = audio_chunk_factory(status=AudioChunkStatus.ASSIGNED)
        cast(MagicMock, mock_datetime.now).return_value = frozen_time
        mock_db_session.execute = AsyncMock(return_value=make_scalar_result(chunk))
        service = AudioChunkService(mock_db_session, AsyncMock())

        result = await service.complete_chunk(chunk.id)

        assert result is chunk
        assert chunk.status == AudioChunkStatus.COMPLETED
        assert chunk.completed_at == frozen_time

    async def test_fail_chunk_retries_when_retry_count_is_below_three(
        self,
        mock_db_session: AsyncMock,
        audio_chunk_factory: Callable[..., AudioChunk],
        frozen_time: datetime,
    ):
        chunk = audio_chunk_factory(
            status=AudioChunkStatus.ASSIGNED,
            worker_id="worker-1",
            assigned_at=frozen_time,
            retry_count=0,
        )
        mock_db_session.execute = AsyncMock(return_value=make_scalar_result(chunk))
        service = AudioChunkService(mock_db_session, AsyncMock())

        result = await service.fail_chunk(chunk.id, "network error")

        assert result is chunk
        assert chunk.status == AudioChunkStatus.PENDING
        assert chunk.retry_count == 1
        assert chunk.worker_id is None
        assert chunk.assigned_at is None
        assert chunk.completed_at is None
        assert chunk.error_message == "network error"

    @patch("src.services.audio_chunk_service.datetime")
    async def test_fail_chunk_fails_permanently_when_retry_count_reaches_three(
        self,
        mock_datetime: MagicMock,
        mock_db_session: AsyncMock,
        audio_chunk_factory: Callable[..., AudioChunk],
        frozen_time: datetime,
    ):
        chunk = audio_chunk_factory(
            status=AudioChunkStatus.ASSIGNED,
            worker_id="worker-1",
            assigned_at=frozen_time,
            retry_count=2,
        )
        cast(MagicMock, mock_datetime.now).return_value = frozen_time
        mock_db_session.execute = AsyncMock(return_value=make_scalar_result(chunk))
        service = AudioChunkService(mock_db_session, AsyncMock())

        result = await service.fail_chunk(chunk.id, "network error")

        assert result is chunk
        assert chunk.status == AudioChunkStatus.FAILED
        assert chunk.retry_count == 3
        assert chunk.completed_at == frozen_time
        assert chunk.error_message == "network error"

    async def test_reassign_timed_out_chunks_resets_chunks_to_pending(
        self,
        mock_db_session: AsyncMock,
        audio_chunk_factory: Callable[..., AudioChunk],
        frozen_time: datetime,
    ):
        chunk_one = audio_chunk_factory(
            status=AudioChunkStatus.ASSIGNED,
            worker_id="worker-1",
            assigned_at=frozen_time,
        )
        chunk_two = audio_chunk_factory(
            status=AudioChunkStatus.ASSIGNED,
            worker_id="worker-2",
            assigned_at=frozen_time,
        )
        mock_db_session.execute = AsyncMock(
            return_value=make_scalars_result([chunk_one, chunk_two])
        )
        service = AudioChunkService(mock_db_session, AsyncMock())

        reassigned_count = await service.reassign_timed_out_chunks(timeout_seconds=30)

        assert reassigned_count == 2
        assert chunk_one.status == AudioChunkStatus.PENDING
        assert chunk_two.status == AudioChunkStatus.PENDING
        assert chunk_one.worker_id is None
        assert chunk_two.worker_id is None
        assert chunk_one.assigned_at is None
        assert chunk_two.assigned_at is None

    def test_generate_storage_key_returns_expected_format(self):
        meeting_id = uuid.uuid4()

        storage_key = AudioChunkService.generate_storage_key(meeting_id, 7)

        assert storage_key == f"meetings/{meeting_id}/audio/7.opus"
