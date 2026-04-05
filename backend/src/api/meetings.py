from __future__ import annotations
# pyright: reportMissingImports=false, reportAttributeAccessIssue=false, reportUnknownVariableType=false, reportUnknownMemberType=false, reportUnknownParameterType=false, reportUnknownArgumentType=false

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from sqlalchemy import func, select

from src.core.config import settings
from src.core.dependencies import DBSession, get_current_user
from src.core.exceptions import AppError, AuthorizationError, NotFoundError
from src.core.storage import storage
from src.models import AudioChunk, AudioChunkStatus, Host, Meeting, MeetingStatus
from src.schemas.meeting import (
    AudioChunkResponse,
    AudioChunkUpload,
    MeetingCreate,
    MeetingListResponse,
    MeetingResponse,
    StartRecordingResponse,
    StopRecordingResponse,
)
from src.services.audio_chunk_service import AudioChunkService
from src.services.meeting_service import MeetingService

router = APIRouter(prefix="/meetings", tags=["meetings"])
CurrentUser = Annotated[Host, Depends(get_current_user)]
LimitQuery = Annotated[int, Query(ge=1, le=100)]
OffsetQuery = Annotated[int, Query(ge=0)]
SequenceForm = Annotated[int, Form()]
DurationMsForm = Annotated[int, Form()]
AudioFile = Annotated[UploadFile, File()]

ALLOWED_AUDIO_CONTENT_TYPES = {
    "audio/webm",
    "audio/ogg",
    "audio/opus",
    "application/octet-stream",
}
ALLOWED_AUDIO_EXTENSIONS = {".webm", ".ogg", ".opus"}


def _base_url() -> str:
    return getattr(settings, "base_url", "https://talkie.app").rstrip("/")


def _websocket_base_url() -> str:
    base_url = _base_url()
    if base_url.startswith("https://"):
        return f"wss://{base_url.removeprefix('https://')}"
    if base_url.startswith("http://"):
        return f"ws://{base_url.removeprefix('http://')}"
    return f"wss://{base_url}"


def _meeting_response(meeting: Meeting) -> MeetingResponse:
    return MeetingResponse(
        id=meeting.id,
        room_code=meeting.room_code,
        title=meeting.title,
        source_language=meeting.source_language,
        status=meeting.status.value,
        created_at=meeting.created_at,
        started_at=meeting.started_at,
        ended_at=meeting.ended_at,
        join_url=f"{_base_url()}/join/{meeting.room_code}",
    )


async def _get_owned_meeting(
    meeting_id: UUID,
    current_user: Host,
    db: DBSession,
) -> Meeting:
    service = MeetingService(db)
    meeting = await service.get_meeting(meeting_id)
    if meeting is None:
        raise NotFoundError("Meeting not found")
    if meeting.host_id != current_user.id:
        raise AuthorizationError("Only the meeting host can access this meeting")
    return meeting


def _validate_audio_upload(audio: UploadFile) -> None:
    filename = (audio.filename or "").lower()
    has_valid_extension = any(
        filename.endswith(extension) for extension in ALLOWED_AUDIO_EXTENSIONS
    )
    if audio.content_type in ALLOWED_AUDIO_CONTENT_TYPES or has_valid_extension:
        return

    raise AppError(
        message="Unsupported audio format. Use WebM/Opus-compatible audio",
        code="INVALID_AUDIO_FORMAT",
        status_code=status.HTTP_400_BAD_REQUEST,
    )


@router.post("", response_model=MeetingResponse, status_code=status.HTTP_201_CREATED)
async def create_meeting(
    data: MeetingCreate,
    current_user: CurrentUser,
    db: DBSession,
) -> MeetingResponse:
    meeting = await MeetingService(db).create_meeting(
        host_id=current_user.id,
        title=data.title,
        source_language=data.source_language,
    )
    return _meeting_response(meeting)


@router.get("", response_model=MeetingListResponse)
async def list_meetings(
    current_user: CurrentUser,
    db: DBSession,
    status: str | None = None,
    limit: LimitQuery = 20,
    offset: OffsetQuery = 0,
) -> MeetingListResponse:
    meetings, total = await MeetingService(db).list_meetings(
        host_id=current_user.id,
        status=status,
        limit=limit,
        offset=offset,
    )
    return MeetingListResponse(
        meetings=[_meeting_response(meeting) for meeting in meetings],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(
    meeting_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> MeetingResponse:
    meeting = await _get_owned_meeting(meeting_id, current_user, db)
    return _meeting_response(meeting)


@router.post("/{meeting_id}/start", response_model=StartRecordingResponse)
async def start_recording(
    meeting_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> StartRecordingResponse:
    meeting = await MeetingService(db).start_meeting(meeting_id, current_user.id)
    if meeting.started_at is None:
        raise AppError(
            message="Meeting start time was not recorded",
            code="MEETING_START_FAILED",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return StartRecordingResponse(
        status=meeting.status.value,
        started_at=meeting.started_at,
        websocket_url=f"{_websocket_base_url()}/ws/meeting/{meeting.id}/host",
    )


@router.post("/{meeting_id}/stop", response_model=StopRecordingResponse)
async def stop_recording(
    meeting_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> StopRecordingResponse:
    meeting = await MeetingService(db).stop_meeting(meeting_id, current_user.id)
    if meeting.ended_at is None:
        raise AppError(
            message="Meeting end time was not recorded",
            code="MEETING_STOP_FAILED",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    pending_chunks_result = await db.execute(
        select(func.count())
        .select_from(AudioChunk)
        .where(
            AudioChunk.meeting_id == meeting.id,
            AudioChunk.status == AudioChunkStatus.PENDING,
        )
    )
    pending_chunks = pending_chunks_result.scalar_one()
    started_at = meeting.started_at or meeting.created_at
    duration_seconds = max(0, int((meeting.ended_at - started_at).total_seconds()))

    return StopRecordingResponse(
        status=meeting.status.value,
        ended_at=meeting.ended_at,
        duration_seconds=duration_seconds,
        pending_chunks=pending_chunks,
    )


@router.post(
    "/{meeting_id}/audio",
    response_model=AudioChunkResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_audio_chunk(
    meeting_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
    sequence: SequenceForm,
    duration_ms: DurationMsForm,
    audio: AudioFile,
) -> AudioChunkResponse:
    payload = AudioChunkUpload(sequence=sequence, duration_ms=duration_ms)
    meeting = await _get_owned_meeting(meeting_id, current_user, db)
    if meeting.status != MeetingStatus.RECORDING:
        raise AppError(
            message="Audio chunks can only be uploaded while the meeting is recording",
            code="INVALID_MEETING_STATUS",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    _validate_audio_upload(audio)
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise AppError(
            message="Audio upload is empty",
            code="EMPTY_AUDIO_UPLOAD",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    chunk = await AudioChunkService(db, storage).create_chunk(
        meeting_id=meeting.id,
        sequence=payload.sequence,
        duration_ms=payload.duration_ms,
        audio_data=audio_bytes,
    )
    return AudioChunkResponse(
        chunk_id=chunk.id,
        sequence=chunk.sequence,
        status=chunk.status.value,
        storage_key=chunk.storage_key,
    )
