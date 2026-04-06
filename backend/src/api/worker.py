from __future__ import annotations

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Query
from pydantic import BaseModel, Field, field_validator, model_validator

from src.core.dependencies import DBSession
from src.core.storage import storage
from src.services.worker_service import WorkerSegmentPayload, WorkerService

router = APIRouter(prefix="/worker", tags=["worker"])
WorkerIdQuery = Annotated[str, Query(min_length=1, max_length=100)]
LimitQuery = Annotated[int, Query(ge=1, le=5)]


class WorkerJobResponse(BaseModel):
    chunk_id: UUID
    meeting_id: UUID
    sequence: int
    audio_url: str
    source_language: str
    timeout_seconds: int


class WorkerJobsListResponse(BaseModel):
    jobs: list[WorkerJobResponse]


class WorkerClaimRequest(BaseModel):
    worker_id: str = Field(min_length=1, max_length=100)


class WorkerClaimResponse(BaseModel):
    status: str
    chunk_id: UUID
    worker_id: str


class WorkerResultSegment(BaseModel):
    text: str = Field(min_length=1)
    start_offset_ms: int = Field(ge=0)
    end_offset_ms: int = Field(ge=0)
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)

    @field_validator("text")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Segment text cannot be empty")
        return stripped

    @model_validator(mode="after")
    def validate_offsets(self) -> WorkerResultSegment:
        if self.end_offset_ms < self.start_offset_ms:
            raise ValueError("end_offset_ms must be greater than or equal to start_offset_ms")
        return self


class WorkerResultRequest(BaseModel):
    worker_id: str = Field(min_length=1, max_length=100)
    segments: list[WorkerResultSegment]


class WorkerResultResponse(BaseModel):
    status: str
    segments_created: int


class WorkerHeartbeatRequest(BaseModel):
    worker_id: str = Field(min_length=1, max_length=100)
    progress_percent: int = Field(ge=0, le=100)


class WorkerHeartbeatResponse(BaseModel):
    status: str
    timeout_extended_to: datetime


@router.get("/jobs", response_model=WorkerJobsListResponse)
async def get_worker_jobs(
    worker_id: WorkerIdQuery,
    db: DBSession,
    limit: LimitQuery = 1,
) -> WorkerJobsListResponse:
    jobs = await WorkerService(db, storage).get_pending_jobs(worker_id=worker_id, limit=limit)
    return WorkerJobsListResponse(jobs=[WorkerJobResponse.model_validate(job) for job in jobs])


@router.post("/jobs/{chunk_id}/claim", response_model=WorkerClaimResponse)
async def claim_worker_job(
    chunk_id: UUID,
    payload: Annotated[WorkerClaimRequest, Body()],
    db: DBSession,
) -> WorkerClaimResponse:
    chunk = await WorkerService(db, storage).claim_job(
        chunk_id=chunk_id, worker_id=payload.worker_id
    )
    return WorkerClaimResponse(
        status=chunk.status.value,
        chunk_id=chunk.id,
        worker_id=payload.worker_id,
    )


@router.post("/jobs/{chunk_id}/result", response_model=WorkerResultResponse)
async def submit_worker_result(
    chunk_id: UUID,
    payload: Annotated[WorkerResultRequest, Body()],
    db: DBSession,
) -> WorkerResultResponse:
    segments: list[WorkerSegmentPayload] = [
        {
            "text": segment.text,
            "start_offset_ms": segment.start_offset_ms,
            "end_offset_ms": segment.end_offset_ms,
            "confidence": segment.confidence,
        }
        for segment in payload.segments
    ]
    segments_created = await WorkerService(db, storage).submit_result(
        chunk_id=chunk_id,
        worker_id=payload.worker_id,
        segments=segments,
    )
    return WorkerResultResponse(status="accepted", segments_created=segments_created)


@router.post("/jobs/{chunk_id}/heartbeat", response_model=WorkerHeartbeatResponse)
async def heartbeat_worker_job(
    chunk_id: UUID,
    payload: Annotated[WorkerHeartbeatRequest, Body()],
    db: DBSession,
) -> WorkerHeartbeatResponse:
    timeout_extended_to = await WorkerService(db, storage).heartbeat(
        chunk_id=chunk_id,
        worker_id=payload.worker_id,
        progress_percent=payload.progress_percent,
    )
    return WorkerHeartbeatResponse(
        status="acknowledged",
        timeout_extended_to=timeout_extended_to,
    )
