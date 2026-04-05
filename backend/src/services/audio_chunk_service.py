from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import AppError, ConflictError, NotFoundError
from src.core.storage import MinIOStorage, StorageError
from src.models import AudioChunk, AudioChunkStatus

StorageClient = MinIOStorage


class AudioChunkService:
    def __init__(self, db: AsyncSession, storage: StorageClient):
        self.db: AsyncSession = db
        self.storage: StorageClient = storage

    async def create_chunk(
        self,
        meeting_id: UUID,
        sequence: int,
        audio_data: bytes,
        duration_ms: int,
    ) -> AudioChunk:
        existing = await self.db.execute(
            select(AudioChunk.id).where(
                AudioChunk.meeting_id == meeting_id,
                AudioChunk.sequence == sequence,
            )
        )
        if existing.scalar_one_or_none() is not None:
            raise ConflictError(
                f"Audio chunk sequence {sequence} already exists for meeting {meeting_id}"
            )

        chunk = AudioChunk(
            meeting_id=meeting_id,
            sequence=sequence,
            storage_key=self.generate_storage_key(meeting_id, sequence),
            duration_ms=duration_ms,
            status=AudioChunkStatus.PENDING,
        )
        self.db.add(chunk)

        try:
            await self.db.flush()
        except IntegrityError as exc:
            await self.db.rollback()
            raise ConflictError(
                f"Audio chunk sequence {sequence} already exists for meeting {meeting_id}"
            ) from exc

        try:
            await self.storage.upload_bytes(
                chunk.storage_key, audio_data, content_type="audio/opus"
            )
        except StorageError as exc:
            await self.db.rollback()
            raise AppError(
                message="Failed to upload audio chunk",
                code="STORAGE_ERROR",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            ) from exc

        await self.db.commit()
        await self.db.refresh(chunk)
        return chunk

    async def get_chunk(self, chunk_id: UUID) -> AudioChunk | None:
        return await self.db.get(AudioChunk, chunk_id)

    async def get_chunks_by_meeting(
        self,
        meeting_id: UUID,
        status: str | None = None,
    ) -> list[AudioChunk]:
        query = select(AudioChunk).where(AudioChunk.meeting_id == meeting_id)
        if status is not None:
            query = query.where(AudioChunk.status == self._parse_status(status))

        result = await self.db.execute(query.order_by(AudioChunk.sequence.asc()))
        return list(result.scalars().all())

    async def get_pending_chunks(self, limit: int = 5) -> list[AudioChunk]:
        result = await self.db.execute(
            select(AudioChunk)
            .where(AudioChunk.status == AudioChunkStatus.PENDING)
            .order_by(AudioChunk.created_at.asc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def assign_chunk_to_worker(
        self,
        chunk_id: UUID,
        worker_id: str,
    ) -> AudioChunk:
        chunk = await self._get_chunk_for_update(chunk_id)
        self._ensure_status_transition(chunk, {AudioChunkStatus.PENDING}, AudioChunkStatus.ASSIGNED)

        chunk.status = AudioChunkStatus.ASSIGNED
        chunk.worker_id = worker_id
        chunk.assigned_at = datetime.now(UTC)
        chunk.error_message = None

        await self.db.commit()
        await self.db.refresh(chunk)
        return chunk

    async def complete_chunk(self, chunk_id: UUID) -> AudioChunk:
        chunk = await self._get_chunk_for_update(chunk_id)
        self._ensure_status_transition(
            chunk,
            {AudioChunkStatus.ASSIGNED, AudioChunkStatus.PROCESSING},
            AudioChunkStatus.COMPLETED,
        )

        chunk.status = AudioChunkStatus.COMPLETED
        chunk.completed_at = datetime.now(UTC)
        chunk.error_message = None

        await self.db.commit()
        await self.db.refresh(chunk)
        return chunk

    async def fail_chunk(self, chunk_id: UUID, error_message: str) -> AudioChunk:
        chunk = await self._get_chunk_for_update(chunk_id)
        self._ensure_status_transition(
            chunk,
            {AudioChunkStatus.ASSIGNED, AudioChunkStatus.PROCESSING},
            AudioChunkStatus.FAILED,
        )

        chunk.retry_count += 1
        chunk.error_message = error_message

        if chunk.retry_count < 3:
            chunk.status = AudioChunkStatus.PENDING
            chunk.worker_id = None
            chunk.assigned_at = None
            chunk.completed_at = None
        else:
            chunk.status = AudioChunkStatus.FAILED
            chunk.completed_at = datetime.now(UTC)

        await self.db.commit()
        await self.db.refresh(chunk)
        return chunk

    async def reassign_timed_out_chunks(self, timeout_seconds: int = 30) -> int:
        timed_out_before = datetime.now(UTC) - timedelta(seconds=timeout_seconds)
        result = await self.db.execute(
            select(AudioChunk)
            .where(AudioChunk.status == AudioChunkStatus.ASSIGNED)
            .where(AudioChunk.assigned_at.is_not(None))
            .where(AudioChunk.assigned_at < timed_out_before)
            .with_for_update(skip_locked=True)
        )
        chunks = list(result.scalars().all())

        for chunk in chunks:
            chunk.status = AudioChunkStatus.PENDING
            chunk.worker_id = None
            chunk.assigned_at = None

        if chunks:
            await self.db.commit()

        return len(chunks)

    @staticmethod
    def generate_storage_key(meeting_id: UUID, sequence: int) -> str:
        return f"meetings/{meeting_id}/audio/{sequence}.opus"

    async def _get_chunk_for_update(self, chunk_id: UUID) -> AudioChunk:
        result = await self.db.execute(
            select(AudioChunk).where(AudioChunk.id == chunk_id).with_for_update()
        )
        chunk = result.scalar_one_or_none()
        if chunk is None:
            raise NotFoundError(f"Audio chunk {chunk_id} not found")
        return chunk

    def _ensure_status_transition(
        self,
        chunk: AudioChunk,
        allowed_current_statuses: set[AudioChunkStatus],
        target_status: AudioChunkStatus,
    ) -> None:
        if chunk.status in allowed_current_statuses:
            return

        allowed = ", ".join(sorted(status.value for status in allowed_current_statuses))
        raise AppError(
            message=(
                f"Invalid audio chunk status transition from {chunk.status.value} "
                f"to {target_status.value}; expected one of: {allowed}"
            ),
            code="INVALID_STATUS_TRANSITION",
            status_code=status.HTTP_409_CONFLICT,
        )

    def _parse_status(self, raw_status: str) -> AudioChunkStatus:
        try:
            return AudioChunkStatus(raw_status)
        except ValueError as exc:
            raise AppError(
                message=f"Invalid audio chunk status: {raw_status}",
                code="INVALID_AUDIO_CHUNK_STATUS",
                status_code=status.HTTP_400_BAD_REQUEST,
            ) from exc
