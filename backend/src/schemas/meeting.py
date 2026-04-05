from __future__ import annotations

from datetime import datetime
from typing import ClassVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class MeetingCreate(BaseModel):
    title: str | None = None
    source_language: str = Field(default="vi", max_length=10)


class MeetingResponse(BaseModel):
    model_config: ClassVar[ConfigDict] = ConfigDict(from_attributes=True)

    id: UUID
    room_code: str
    title: str | None
    source_language: str
    status: str
    created_at: datetime
    started_at: datetime | None
    ended_at: datetime | None
    join_url: str


class MeetingListResponse(BaseModel):
    meetings: list[MeetingResponse]
    total: int
    limit: int
    offset: int


class StartRecordingResponse(BaseModel):
    status: str
    started_at: datetime
    websocket_url: str


class StopRecordingResponse(BaseModel):
    status: str
    ended_at: datetime
    duration_seconds: int
    pending_chunks: int


class AudioChunkUpload(BaseModel):
    sequence: int = Field(ge=0)
    duration_ms: int = Field(ge=1000, le=10000)


class AudioChunkResponse(BaseModel):
    chunk_id: UUID
    sequence: int
    status: str
    storage_key: str
