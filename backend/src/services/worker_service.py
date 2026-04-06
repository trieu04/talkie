from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import TypedDict, cast
from uuid import UUID

from fastapi import status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.exceptions import AppError, ConflictError, NotFoundError
from src.core.redis import redis_manager
from src.core.storage import MinIOStorage, StorageError
from src.models import AudioChunk, AudioChunkStatus, Meeting
from src.services.transcript_service import TranscriptService

StorageClient = MinIOStorage


class PendingJob(TypedDict):
    chunk_id: UUID
    meeting_id: UUID
    sequence: int
    audio_url: str
    source_language: str
    timeout_seconds: int


class WorkerSegmentPayload(TypedDict):
    text: str
    start_offset_ms: int
    end_offset_ms: int
    confidence: float | None


class WorkerService:
    def __init__(self, db: AsyncSession, storage: StorageClient):
        self.db: AsyncSession = db
        self.storage: StorageClient = storage

    async def get_pending_jobs(self, worker_id: str, limit: int = 1) -> list[PendingJob]:
        _ = worker_id
        stmt = (
            select(AudioChunk, Meeting.source_language)
            .join(Meeting, Meeting.id == AudioChunk.meeting_id)
            .where(AudioChunk.status == AudioChunkStatus.PENDING)
            .order_by(AudioChunk.created_at.asc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)

        jobs: list[PendingJob] = []
        for row in result.all():
            chunk = cast(AudioChunk, row[0])
            source_language = cast(str, row[1])
            try:
                audio_url = await self.storage.get_presigned_url(
                    chunk.storage_key,
                    expires=timedelta(minutes=5),
                )
            except StorageError as exc:
                raise AppError(
                    message="Failed to generate audio download URL",
                    code="STORAGE_ERROR",
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                ) from exc

            jobs.append(
                {
                    "chunk_id": chunk.id,
                    "meeting_id": chunk.meeting_id,
                    "sequence": chunk.sequence,
                    "audio_url": audio_url,
                    "source_language": source_language,
                    "timeout_seconds": settings.worker_timeout_seconds,
                }
            )

        return jobs

    async def claim_job(self, chunk_id: UUID, worker_id: str) -> AudioChunk:
        chunk = await self._get_claimable_chunk(chunk_id)
        chunk.status = AudioChunkStatus.ASSIGNED
        chunk.worker_id = worker_id
        chunk.assigned_at = self._next_timeout_at()
        chunk.completed_at = None
        chunk.error_message = None

        await self.db.commit()
        await self.db.refresh(chunk)
        return chunk

    async def submit_result(
        self,
        chunk_id: UUID,
        worker_id: str,
        segments: list[WorkerSegmentPayload],
    ) -> int:
        chunk = await self._get_chunk_for_update(chunk_id)
        self._ensure_worker_owns_chunk(chunk, worker_id)
        self._ensure_status_transition(
            chunk,
            {AudioChunkStatus.ASSIGNED, AudioChunkStatus.PROCESSING},
            AudioChunkStatus.COMPLETED,
        )

        chunk.status = AudioChunkStatus.PROCESSING
        base_time_ms = await self._get_chunk_base_time_ms(chunk)
        transcript_service = TranscriptService(self.db, redis_manager.client)

        created_count = 0
        for segment in segments:
            _ = await transcript_service.create_segment(
                meeting_id=chunk.meeting_id,
                audio_chunk_id=chunk.id,
                text=segment["text"],
                start_time_ms=base_time_ms + segment["start_offset_ms"],
                end_time_ms=base_time_ms + segment["end_offset_ms"],
                confidence=segment["confidence"],
                is_partial=False,
            )
            created_count += 1

        chunk.status = AudioChunkStatus.COMPLETED
        chunk.completed_at = datetime.now(UTC)
        chunk.assigned_at = None
        chunk.error_message = None

        await self.db.commit()
        await self.db.refresh(chunk)
        return created_count

    async def heartbeat(
        self,
        chunk_id: UUID,
        worker_id: str,
        progress_percent: int,
    ) -> datetime:
        _ = progress_percent
        chunk = await self._get_chunk_for_update(chunk_id)
        self._ensure_worker_owns_chunk(chunk, worker_id)
        self._ensure_status_transition(
            chunk,
            {AudioChunkStatus.ASSIGNED, AudioChunkStatus.PROCESSING},
            AudioChunkStatus.PROCESSING,
        )

        chunk.status = AudioChunkStatus.PROCESSING
        chunk.assigned_at = self._extend_timeout(chunk.assigned_at)
        await self.db.commit()
        await self.db.refresh(chunk)

        if chunk.assigned_at is None:
            raise AppError(
                message="Worker timeout could not be extended",
                code="WORKER_HEARTBEAT_FAILED",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        timeout_at = chunk.assigned_at
        assert timeout_at is not None
        return timeout_at

    async def reassign_timed_out_chunks(self, timeout_seconds: int = 30) -> int:
        _ = timeout_seconds
        now = datetime.now(UTC)
        stmt = (
            select(AudioChunk)
            .where(AudioChunk.status.in_([AudioChunkStatus.ASSIGNED, AudioChunkStatus.PROCESSING]))
            .where(AudioChunk.assigned_at.is_not(None))
            .where(AudioChunk.assigned_at < now)
            .with_for_update(skip_locked=True)
        )
        result = await self.db.execute(stmt)
        chunks = list(result.scalars().all())

        reassigned_count = 0
        for chunk in chunks:
            chunk.retry_count += 1
            chunk.worker_id = None
            chunk.assigned_at = None

            if chunk.retry_count < settings.worker_max_retries:
                chunk.status = AudioChunkStatus.PENDING
                chunk.completed_at = None
                chunk.error_message = "Worker heartbeat timed out"
                reassigned_count += 1
                continue

            chunk.status = AudioChunkStatus.FAILED
            chunk.completed_at = now
            chunk.error_message = "Worker heartbeat timed out"

        if chunks:
            await self.db.commit()

        return reassigned_count

    async def _get_claimable_chunk(self, chunk_id: UUID) -> AudioChunk:
        stmt = (
            select(AudioChunk)
            .where(
                AudioChunk.id == chunk_id,
                AudioChunk.status == AudioChunkStatus.PENDING,
            )
            .with_for_update(skip_locked=True)
        )
        result = await self.db.execute(stmt)
        chunk = result.scalar_one_or_none()
        if chunk is not None:
            return chunk

        existing = await self.db.get(AudioChunk, chunk_id)
        if existing is None:
            raise NotFoundError(f"Audio chunk {chunk_id} not found")
        raise ConflictError("Audio chunk is no longer available for claiming")

    async def _get_chunk_for_update(self, chunk_id: UUID) -> AudioChunk:
        result = await self.db.execute(
            select(AudioChunk).where(AudioChunk.id == chunk_id).with_for_update()
        )
        chunk = result.scalar_one_or_none()
        if chunk is None:
            raise NotFoundError(f"Audio chunk {chunk_id} not found")
        return chunk

    async def _get_chunk_base_time_ms(self, chunk: AudioChunk) -> int:
        stmt = select(func.coalesce(func.sum(AudioChunk.duration_ms), 0)).where(
            AudioChunk.meeting_id == chunk.meeting_id,
            AudioChunk.sequence < chunk.sequence,
        )
        result = await self.db.execute(stmt)
        return int(result.scalar_one())

    def _ensure_worker_owns_chunk(self, chunk: AudioChunk, worker_id: str) -> None:
        if chunk.worker_id == worker_id:
            return

        raise AppError(
            message="Worker does not own this audio chunk",
            code="WORKER_OWNERSHIP_ERROR",
            status_code=status.HTTP_409_CONFLICT,
        )

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

    def _next_timeout_at(self) -> datetime:
        return datetime.now(UTC) + timedelta(seconds=settings.worker_timeout_seconds)

    def _extend_timeout(self, timeout_at: datetime | None) -> datetime:
        baseline = timeout_at or datetime.now(UTC)
        if baseline < datetime.now(UTC):
            baseline = datetime.now(UTC)
        return baseline + timedelta(seconds=settings.worker_timeout_seconds)
