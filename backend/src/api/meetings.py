from __future__ import annotations

# pyright: reportMissingImports=false, reportAttributeAccessIssue=false, reportUnknownVariableType=false, reportUnknownMemberType=false, reportUnknownParameterType=false, reportUnknownArgumentType=false
import re
from typing import Annotated, cast
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Query, Response, UploadFile, status
from sqlalchemy import func, select

from src.core.config import settings
from src.core.dependencies import DBSession, get_current_user
from src.core.exceptions import AppError, AuthorizationError, NotFoundError
from src.core.redis import redis_manager
from src.core.storage import storage
from src.models import (
    AudioChunk,
    AudioChunkStatus,
    Host,
    Meeting,
    MeetingStatus,
    MeetingSummary,
    SegmentTranslation,
    TranscriptSegment,
)
from src.schemas.meeting import (
    AudioChunkResponse,
    AudioChunkUpload,
    JoinMeetingResponse,
    MeetingCreate,
    MeetingListResponse,
    MeetingResponse,
    MeetingSummaryProcessingResponse,
    MeetingSummaryRequest,
    MeetingSummaryResponse,
    MeetingTranslateRequest,
    MeetingTranslateResponse,
    StartRecordingResponse,
    StopRecordingResponse,
    TranscriptResponse,
    TranscriptSearchMatchResponse,
    TranscriptSearchResponse,
    TranscriptSegmentResponse,
    TranscriptTranslationResponse,
)
from src.services.audio_chunk_service import AudioChunkService
from src.services.meeting_service import MeetingService
from src.services.summary_service import SummaryService
from src.services.transcript_service import TranscriptService
from src.services.translation_service import TranslationService


def _new_translation_service(db: DBSession) -> TranslationService:
    return TranslationService(db, redis_manager.client)


router = APIRouter(prefix="/meetings", tags=["meetings"])
public_router = APIRouter(tags=["meetings"])
CurrentUser = Annotated[Host, Depends(get_current_user)]
LimitQuery = Annotated[int, Query(ge=1, le=100)]
TranscriptLimitQuery = Annotated[int, Query(ge=1, le=500)]
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


def _meeting_response(
    meeting: Meeting,
    has_transcript: bool = False,
    has_summary: bool = False,
) -> MeetingResponse:
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
        has_transcript=has_transcript,
        has_summary=has_summary,
    )


def _join_meeting_response(meeting: Meeting) -> JoinMeetingResponse:
    return JoinMeetingResponse(
        meeting_id=meeting.id,
        title=meeting.title,
        source_language=meeting.source_language,
        status=meeting.status.value,
        started_at=meeting.started_at,
        websocket_url=(
            f"{_websocket_base_url()}/ws/meeting/{meeting.id}/participant?room_code={meeting.room_code}"
        ),
    )


def _meeting_summary_response(summary: MeetingSummary) -> MeetingSummaryResponse:
    return MeetingSummaryResponse.model_validate(summary, from_attributes=True)


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


def _parse_translation_languages(value: str | None) -> set[str] | None:
    if value is None:
        return None
    return {item.strip().lower() for item in value.split(",") if item.strip()}


def _segment_response(segment: TranscriptSegment) -> TranscriptSegmentResponse:
    translations = sorted(
        cast(list[SegmentTranslation], segment.translations),
        key=lambda item: item.target_language,
    )
    return TranscriptSegmentResponse(
        id=segment.id,
        sequence=segment.sequence,
        text=segment.text,
        start_time_ms=segment.start_time_ms,
        end_time_ms=segment.end_time_ms,
        confidence=segment.confidence,
        is_partial=segment.is_partial,
        translations=[
            TranscriptTranslationResponse(
                target_language=translation.target_language,
                translated_text=translation.translated_text,
            )
            for translation in translations
        ],
    )


def _build_highlight(text: str, query: str) -> str:
    match = re.search(re.escape(query.strip()), text, flags=re.IGNORECASE)
    if match is None:
        return text
    return (
        f"{text[: match.start()]}<mark>{text[match.start() : match.end()]}</mark>"
        f"{text[match.end() :]}"
    )


def _search_match_response(
    segment: TranscriptSegment,
    query: str,
    language: str | None,
) -> TranscriptSearchMatchResponse:
    matched_language = "source"
    highlight_text = segment.text

    if language is not None:
        for translation in cast(list[SegmentTranslation], segment.translations):
            if translation.target_language == language:
                matched_language = language
                highlight_text = translation.translated_text
                break
    elif query.casefold() not in segment.text.casefold():
        for translation in cast(list[SegmentTranslation], segment.translations):
            if query.casefold() in translation.translated_text.casefold():
                matched_language = translation.target_language
                highlight_text = translation.translated_text
                break

    segment_response = _segment_response(segment)
    return TranscriptSearchMatchResponse(
        id=segment_response.id,
        sequence=segment_response.sequence,
        text=segment_response.text,
        start_time_ms=segment_response.start_time_ms,
        end_time_ms=segment_response.end_time_ms,
        confidence=segment_response.confidence,
        is_partial=segment_response.is_partial,
        translations=segment_response.translations,
        highlight=_build_highlight(highlight_text, query),
        matched_language=matched_language,
    )


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
        meetings=[
            _meeting_response(
                item.meeting,
                has_transcript=item.has_transcript,
                has_summary=item.has_summary,
            )
            for item in meetings
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/join/{room_code}", response_model=JoinMeetingResponse)
@public_router.get("/join/{room_code}", response_model=JoinMeetingResponse)
async def join_meeting(room_code: str, db: DBSession) -> JoinMeetingResponse:
    meeting = await MeetingService(db).get_meeting_by_room_code(room_code)
    if meeting is None:
        raise NotFoundError("Meeting not found")
    return _join_meeting_response(meeting)


@router.get("/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(
    meeting_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> MeetingResponse:
    meeting = await _get_owned_meeting(meeting_id, current_user, db)
    return _meeting_response(meeting)


@router.post(
    "/{meeting_id}/summary",
    response_model=MeetingSummaryResponse | MeetingSummaryProcessingResponse,
)
async def generate_meeting_summary(
    meeting_id: UUID,
    payload: MeetingSummaryRequest,
    response: Response,
    current_user: CurrentUser,
    db: DBSession,
) -> MeetingSummaryResponse | MeetingSummaryProcessingResponse:
    _ = await _get_owned_meeting(meeting_id, current_user, db)
    summary, generated = await SummaryService(db).ensure_summary(
        meeting_id=meeting_id,
        regenerate=payload.regenerate,
    )
    if not generated:
        return _meeting_summary_response(summary)

    response.status_code = status.HTTP_202_ACCEPTED
    return MeetingSummaryProcessingResponse(status="processing", estimated_seconds=45)


@router.get("/{meeting_id}/summary", response_model=MeetingSummaryResponse)
async def get_meeting_summary(
    meeting_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> MeetingSummaryResponse:
    _ = await _get_owned_meeting(meeting_id, current_user, db)
    summary = await SummaryService(db).get_summary_or_raise(meeting_id)
    return _meeting_summary_response(summary)


@router.get("/{meeting_id}/transcript", response_model=TranscriptResponse)
async def get_meeting_transcript(
    meeting_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
    limit: TranscriptLimitQuery = 100,
    offset: OffsetQuery = 0,
    include_translations: str | None = None,
) -> TranscriptResponse:
    meeting = await _get_owned_meeting(meeting_id, current_user, db)
    translation_languages = _parse_translation_languages(include_translations)
    transcript_service = TranscriptService(db, redis_manager.client)
    segments = await transcript_service.get_segments_by_meeting(
        meeting_id=meeting.id,
        limit=limit,
        offset=offset,
        include_translations=translation_languages,
    )
    total_segments = await transcript_service.count_segments_by_meeting(meeting.id)
    return TranscriptResponse(
        meeting_id=meeting.id,
        source_language=meeting.source_language,
        segments=[_segment_response(segment) for segment in segments],
        total_segments=total_segments,
        limit=limit,
        offset=offset,
    )


@router.get("/{meeting_id}/transcript/search", response_model=TranscriptSearchResponse)
async def search_meeting_transcript(
    meeting_id: UUID,
    q: Annotated[str, Query(min_length=1)],
    current_user: CurrentUser,
    db: DBSession,
    language: str | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> TranscriptSearchResponse:
    meeting = await _get_owned_meeting(meeting_id, current_user, db)
    normalized_language = language.lower() if language else None
    include_languages = {normalized_language} if normalized_language else set()
    transcript_service = TranscriptService(db, redis_manager.client)
    matches = await transcript_service.search_segments(
        meeting_id=meeting.id,
        query=q,
        limit=limit,
        language=normalized_language,
        include_translations=include_languages,
    )
    return TranscriptSearchResponse(
        meeting_id=meeting.id,
        query=q,
        language=normalized_language,
        matches=[
            _search_match_response(segment, query=q, language=normalized_language)
            for segment in matches
        ],
        total_matches=len(matches),
        limit=limit,
    )


@public_router.get("/join/{room_code}/transcript", response_model=TranscriptResponse)
async def get_public_meeting_transcript(
    room_code: str,
    db: DBSession,
    limit: TranscriptLimitQuery = 100,
    offset: OffsetQuery = 0,
    include_translations: str | None = None,
) -> TranscriptResponse:
    meeting = await MeetingService(db).get_meeting_by_room_code(room_code)
    if meeting is None:
        raise NotFoundError("Meeting not found")

    translation_languages = _parse_translation_languages(include_translations)
    transcript_service = TranscriptService(db, redis_manager.client)
    segments = await transcript_service.get_segments_by_meeting(
        meeting_id=meeting.id,
        limit=limit,
        offset=offset,
        include_translations=translation_languages,
    )
    total_segments = await transcript_service.count_segments_by_meeting(meeting.id)
    return TranscriptResponse(
        meeting_id=meeting.id,
        source_language=meeting.source_language,
        segments=[_segment_response(segment) for segment in segments],
        total_segments=total_segments,
        limit=limit,
        offset=offset,
    )


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


@router.post("/{meeting_id}/translate", response_model=MeetingTranslateResponse)
async def translate_meeting(
    meeting_id: UUID,
    data: MeetingTranslateRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> MeetingTranslateResponse:
    meeting = await _get_owned_meeting(meeting_id, current_user, db)
    service = _new_translation_service(db)
    target_language = service.validate_language_code(data.target_language)
    source_language = service.validate_language_code(meeting.source_language)
    segments = await service.transcript_service.get_segments_by_meeting(
        meeting.id,
        limit=10_000,
        offset=0,
    )
    total_segments = len(segments)
    cached_count = await service.count_cached_translations(meeting.id, target_language)

    if cached_count >= total_segments:
        return MeetingTranslateResponse(
            meeting_id=meeting.id,
            target_language=target_language,
            status="complete",
            segments_translated=cached_count,
            total_segments=total_segments,
        )

    translated_count, _ = await service.backfill_meeting_translations(
        meeting.id,
        source_language=source_language,
        target_language=target_language,
    )
    return MeetingTranslateResponse(
        meeting_id=meeting.id,
        target_language=target_language,
        status="processing",
        segments_translated=translated_count,
        total_segments=total_segments,
    )
