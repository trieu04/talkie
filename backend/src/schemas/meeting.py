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
    duration_seconds: int | None = None
    has_transcript: bool = False
    has_summary: bool = False
    available_translations: list[str] = Field(default_factory=list)


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


class MeetingSummaryRequest(BaseModel):
    regenerate: bool = False


class MeetingSummaryDecision(BaseModel):
    decision: str
    context: str


class MeetingSummaryActionItem(BaseModel):
    task: str
    assignee: str | None
    deadline: str | None


class MeetingSummaryResponse(BaseModel):
    id: UUID
    content: str
    key_points: list[str]
    decisions: list[MeetingSummaryDecision]
    action_items: list[MeetingSummaryActionItem]
    created_at: datetime


class MeetingSummaryProcessingResponse(BaseModel):
    status: str
    estimated_seconds: int


class JoinMeetingResponse(BaseModel):
    meeting_id: UUID
    title: str | None
    source_language: str
    status: str
    started_at: datetime | None
    websocket_url: str
    duration_seconds: int | None = None
    has_transcript: bool = False
    has_summary: bool = False
    available_translations: list[str] = Field(default_factory=list)


class AudioChunkUpload(BaseModel):
    sequence: int = Field(ge=0)
    duration_ms: int = Field(ge=1000, le=10000)


class AudioChunkResponse(BaseModel):
    chunk_id: UUID
    sequence: int
    status: str
    storage_key: str


class MeetingTranslateRequest(BaseModel):
    target_language: str = Field(min_length=2, max_length=10)


class MeetingTranslateResponse(BaseModel):
    meeting_id: UUID
    target_language: str
    status: str
    segments_translated: int
    total_segments: int


class TranscriptTranslationResponse(BaseModel):
    target_language: str
    translated_text: str


class TranscriptSegmentResponse(BaseModel):
    id: UUID
    sequence: int
    text: str
    start_time_ms: int
    end_time_ms: int
    confidence: float | None
    is_partial: bool
    translations: list[TranscriptTranslationResponse] = Field(default_factory=list)


class TranscriptResponse(BaseModel):
    meeting_id: UUID
    source_language: str
    segments: list[TranscriptSegmentResponse]
    total_segments: int
    limit: int
    offset: int


class TranscriptSearchMatchResponse(TranscriptSegmentResponse):
    highlight: str
    matched_language: str


class TranscriptSearchResponse(BaseModel):
    meeting_id: UUID
    query: str
    language: str | None = None
    matches: list[TranscriptSearchMatchResponse]
    total_matches: int
    limit: int
