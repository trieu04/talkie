from __future__ import annotations

import asyncio
import base64
import binascii
import contextlib
import json
from datetime import datetime
from importlib import import_module
from typing import Annotated, Protocol, cast
from uuid import UUID, uuid4

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select
from starlette.websockets import WebSocketState

from src.core.auth import TokenError, decode_token
from src.core.config import settings
from src.core.database import AsyncSessionFactory
from src.core.exceptions import AppError, AuthenticationError, AuthorizationError, NotFoundError
from src.core.redis import redis_manager
from src.core.storage import storage
from src.core.websocket_manager import websocket_manager
from src.models import Host, Meeting, MeetingStatus, TranscriptSegment
from src.services.audio_chunk_service import AudioChunkService
from src.services.meeting_service import MeetingService
from src.services.transcript_service import TranscriptService


class TranslationServiceProtocol(Protocol):
    transcript_service: TranscriptService

    def validate_language_code(self, language: str) -> str: ...

    async def count_cached_translations(self, meeting_id: UUID, target_language: str) -> int: ...

    async def backfill_meeting_translations(
        self,
        meeting_id: UUID,
        *,
        source_language: str,
        target_language: str,
    ) -> tuple[int, int]: ...


class TranslationServiceFactory(Protocol):
    def __call__(self, session: object, redis: object) -> TranslationServiceProtocol: ...


def _new_translation_service(session: object) -> TranslationServiceProtocol:
    module = import_module("src.services.translation_service")
    service_class = cast(TranslationServiceFactory, module.TranslationService)
    return service_class(session, redis_manager.client)


router = APIRouter(prefix="/ws")


class AudioChunkPayload(BaseModel):
    sequence: int = Field(ge=0)
    data: str
    duration_ms: int = Field(ge=1000, le=10000)
    is_final: bool = False


class RecordingControlPayload(BaseModel):
    action: str


class SyncRequestPayload(BaseModel):
    last_sequence: int = Field(ge=0)
    target_language: str | None = Field(default=None, max_length=10)


class SetLanguagePayload(BaseModel):
    target_language: str = Field(min_length=2, max_length=10)


class ParticipantTranslationState(BaseModel):
    target_language: str | None = None


def _base_url() -> str:
    return getattr(settings, "base_url", "https://talkie.app").rstrip("/")


def _serialize_datetime(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.isoformat().replace("+00:00", "Z")


def _serialize_meeting(meeting: Meeting) -> dict[str, object]:
    return {
        "id": str(meeting.id),
        "room_code": meeting.room_code,
        "title": meeting.title,
        "source_language": meeting.source_language,
        "status": meeting.status.value,
        "created_at": _serialize_datetime(meeting.created_at),
        "started_at": _serialize_datetime(meeting.started_at),
        "ended_at": _serialize_datetime(meeting.ended_at),
        "join_url": f"{_base_url()}/join/{meeting.room_code}",
    }


def _serialize_segment(segment: TranscriptSegment) -> dict[str, object]:
    return {
        "id": str(segment.id),
        "audio_chunk_id": str(segment.audio_chunk_id) if segment.audio_chunk_id else None,
        "sequence": segment.sequence,
        "text": segment.text,
        "start_time_ms": segment.start_time_ms,
        "end_time_ms": segment.end_time_ms,
        "is_partial": segment.is_partial,
        "confidence": segment.confidence,
        "created_at": _serialize_datetime(segment.created_at),
        "updated_at": _serialize_datetime(segment.updated_at),
    }


async def _send_json(websocket: WebSocket, payload: dict[str, object]) -> None:
    await websocket_manager.send_json(websocket, payload)


async def _send_error_and_close(
    websocket: WebSocket,
    message: str,
    *,
    code: str = "WEBSOCKET_ERROR",
    close_code: int = status.WS_1008_POLICY_VIOLATION,
) -> None:
    if websocket.application_state == WebSocketState.CONNECTING:
        await websocket.accept()
    if websocket.application_state == WebSocketState.CONNECTED:
        await _send_json(
            websocket,
            {
                "type": "error",
                "payload": {"code": code, "message": message},
            },
        )
    await websocket.close(code=close_code)


async def _authenticate_host(token: str) -> Host:
    try:
        payload = decode_token(token, expected_type="access")
        host_id = UUID(payload["sub"])
    except (TokenError, ValueError) as exc:
        raise AuthenticationError(str(exc)) from exc

    async with AsyncSessionFactory() as session:
        result = await session.execute(select(Host).where(Host.id == host_id))
        host = result.scalar_one_or_none()
        if host is None:
            raise AuthenticationError("Authenticated user no longer exists")
        return host


async def _get_owned_meeting(meeting_id: UUID, host_id: UUID) -> Meeting:
    async with AsyncSessionFactory() as session:
        service = MeetingService(session)
        meeting = await service.get_meeting(meeting_id)
        if meeting is None:
            raise NotFoundError("Meeting not found")
        if meeting.host_id != host_id:
            raise AuthorizationError("Only the meeting host can access this websocket")
        return meeting


async def _get_meeting_by_room_code(room_code: str) -> Meeting:
    async with AsyncSessionFactory() as session:
        meeting = await MeetingService(session).get_meeting_by_room_code(room_code)
        if meeting is None:
            raise NotFoundError("Meeting not found")
        return meeting


async def _get_participant_meeting(meeting_id: UUID, room_code: str) -> Meeting:
    meeting = await _get_meeting_by_room_code(room_code)
    if meeting.id != meeting_id:
        raise AuthorizationError("Room code does not match this meeting")
    return meeting


async def _forward_transcript_events(websocket: WebSocket, meeting_id: UUID) -> None:
    pubsub = redis_manager.client.pubsub()  # pyright: ignore[reportUnknownMemberType]
    channel = f"meeting:{meeting_id}:transcript"
    await pubsub.subscribe(channel)  # pyright: ignore[reportUnknownMemberType]
    try:
        while True:
            message = await pubsub.get_message(  # pyright: ignore[reportUnknownVariableType]
                ignore_subscribe_messages=True,
                timeout=1.0,
            )
            if message is None:
                await asyncio.sleep(0.1)
                continue

            data = message.get("data")  # pyright: ignore[reportUnknownVariableType, reportUnknownMemberType]
            if not isinstance(data, str):
                continue

            try:
                payload = cast(object, json.loads(data))
            except json.JSONDecodeError:
                continue
            if not isinstance(payload, dict):
                continue

            await _send_json(websocket, cast(dict[str, object], payload))
    except (RuntimeError, WebSocketDisconnect):
        return
    except asyncio.CancelledError:
        raise
    finally:
        with contextlib.suppress(Exception):
            await pubsub.unsubscribe(channel)  # pyright: ignore[reportUnknownMemberType]
        with contextlib.suppress(Exception):
            await pubsub.aclose()


async def _forward_translation_events(
    websocket: WebSocket,
    meeting_id: UUID,
    state: ParticipantTranslationState,
) -> None:
    pubsub = redis_manager.client.pubsub()  # pyright: ignore[reportUnknownMemberType]
    channel = f"meeting:{meeting_id}:translation"
    await pubsub.subscribe(channel)  # pyright: ignore[reportUnknownMemberType]
    try:
        while True:
            message = await pubsub.get_message(  # pyright: ignore[reportUnknownVariableType]
                ignore_subscribe_messages=True,
                timeout=1.0,
            )
            if message is None:
                await asyncio.sleep(0.1)
                continue

            data = message.get("data")  # pyright: ignore[reportUnknownVariableType, reportUnknownMemberType]
            if not isinstance(data, str):
                continue

            try:
                payload = cast(object, json.loads(data))
            except json.JSONDecodeError:
                continue
            if not isinstance(payload, dict):
                continue

            payload_dict = cast(dict[str, object], payload)
            message_payload = payload_dict.get("payload")
            if not isinstance(message_payload, dict):
                continue

            current_language = state.target_language
            target_language = cast(dict[str, object], message_payload).get("target_language")
            if current_language is None or current_language != target_language:
                continue

            await _send_json(websocket, payload_dict)
    except (RuntimeError, WebSocketDisconnect):
        return
    except asyncio.CancelledError:
        raise
    finally:
        with contextlib.suppress(Exception):
            await pubsub.unsubscribe(channel)  # pyright: ignore[reportUnknownMemberType]
        with contextlib.suppress(Exception):
            await pubsub.aclose()


def _parse_client_message(message: object) -> tuple[str | None, object]:
    if not isinstance(message, dict):
        raise AppError(
            message="Message must be a JSON object",
            code="INVALID_MESSAGE",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    message_dict = cast(dict[str, object], message)
    message_type = message_dict.get("type")
    payload = message_dict.get("payload", {})
    return (message_type if isinstance(message_type, str) else None), payload


async def _handle_audio_chunk(meeting_id: UUID, payload: object) -> dict[str, object]:
    chunk_payload = AudioChunkPayload.model_validate(payload)
    audio_bytes = base64.b64decode(chunk_payload.data, validate=True)

    async with AsyncSessionFactory() as session:
        meeting_service = MeetingService(session)
        meeting = await meeting_service.get_meeting(meeting_id)
        if meeting is None:
            raise NotFoundError("Meeting not found")
        if meeting.status != MeetingStatus.RECORDING:
            raise AppError(
                message="Audio chunks can only be uploaded while the meeting is recording",
                code="INVALID_MEETING_STATUS",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        chunk = await AudioChunkService(session, storage).create_chunk(
            meeting_id=meeting_id,
            sequence=chunk_payload.sequence,
            audio_data=audio_bytes,
            duration_ms=chunk_payload.duration_ms,
        )

    return {
        "type": "chunk_received",
        "payload": {
            "sequence": chunk.sequence,
            "status": chunk.status.value,
        },
    }


async def _handle_recording_control(
    meeting_id: UUID,
    host_id: UUID,
    payload: object,
) -> dict[str, object]:
    control_payload = RecordingControlPayload.model_validate(payload)

    async with AsyncSessionFactory() as session:
        service = MeetingService(session)
        action = control_payload.action
        if action == "start":
            meeting = await service.start_meeting(meeting_id, host_id)
            message_type = "recording_started"
        elif action == "pause":
            meeting = await service.pause_meeting(meeting_id, host_id)
            message_type = "recording_paused"
        elif action == "resume":
            meeting = await service.resume_meeting(meeting_id, host_id)
            message_type = "recording_resumed"
        elif action == "stop":
            meeting = await service.stop_meeting(meeting_id, host_id)
            message_type = "recording_stopped"
        else:
            raise AppError(
                message=f"Unsupported recording action '{action}'",
                code="INVALID_RECORDING_ACTION",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

    participant_count = await websocket_manager.participant_count(meeting_id)
    return {
        "type": message_type,
        "payload": {
            "meeting": _serialize_meeting(meeting),
            "participant_count": participant_count,
        },
    }


async def _handle_sync_request(meeting_id: UUID, payload: object) -> dict[str, object]:
    sync_payload = SyncRequestPayload.model_validate(payload)
    async with AsyncSessionFactory() as session:
        segments = await TranscriptService(session, redis_manager.client).get_segments_since(
            meeting_id,
            sync_payload.last_sequence,
        )

    return {
        "type": "sync_response",
        "payload": {
            "last_sequence": segments[-1].sequence if segments else sync_payload.last_sequence,
            "segments": [_serialize_segment(segment) for segment in segments],
        },
    }


async def _handle_set_language(
    meeting: Meeting,
    payload: object,
    websocket: WebSocket,
    state: ParticipantTranslationState,
) -> None:
    set_language_payload = SetLanguagePayload.model_validate(payload)

    async with AsyncSessionFactory() as session:
        translation_service = _new_translation_service(session)
        target_language = translation_service.validate_language_code(
            set_language_payload.target_language
        )
        source_language = translation_service.validate_language_code(meeting.source_language)
        segments = await translation_service.transcript_service.get_segments_by_meeting(
            meeting.id,
            limit=10_000,
            offset=0,
        )
        cached_count = await translation_service.count_cached_translations(
            meeting.id, target_language
        )
        segments_to_translate = max(0, len(segments) - cached_count)
        state.target_language = target_language

        await _send_json(
            websocket,
            {
                "type": "translation_language_changed",
                "payload": {
                    "target_language": target_language,
                    "backfill_in_progress": segments_to_translate > 0,
                    "segments_to_translate": segments_to_translate,
                },
            },
        )

        translated_count, _ = await translation_service.backfill_meeting_translations(
            meeting.id,
            source_language=source_language,
            target_language=target_language,
        )

    await _send_json(
        websocket,
        {
            "type": "translation_backfill_complete",
            "payload": {
                "target_language": state.target_language,
                "segments_translated": translated_count,
            },
        },
    )


async def _broadcast_participant_event(
    meeting_id: UUID, event_type: str, participant_count: int
) -> None:
    await websocket_manager.broadcast(
        meeting_id,
        {
            "type": event_type,
            "payload": {"participant_count": participant_count},
        },
    )


@router.websocket("/meeting/{meeting_id}/host")
async def host_websocket(
    websocket: WebSocket,
    meeting_id: UUID,
    token: Annotated[str, Query()],
) -> None:
    try:
        host = await _authenticate_host(token)
        meeting = await _get_owned_meeting(meeting_id, host.id)
    except AppError as exc:
        await _send_error_and_close(websocket, exc.message, code=exc.code)
        return

    if not await websocket_manager.connect(meeting_id, websocket):
        return
    transcript_task = asyncio.create_task(_forward_transcript_events(websocket, meeting_id))
    session_id = str(uuid4())

    try:
        await _send_json(
            websocket,
            {
                "type": "connected",
                "payload": {
                    "session_id": session_id,
                    "role": "host",
                    "meeting": _serialize_meeting(meeting),
                    "participant_count": await websocket_manager.participant_count(meeting_id),
                },
            },
        )

        while True:
            try:
                message = cast(object, await websocket.receive_json())
            except ValueError:
                await _send_json(
                    websocket,
                    {
                        "type": "error",
                        "payload": {
                            "code": "INVALID_MESSAGE",
                            "message": "Message must be valid JSON",
                        },
                    },
                )
                continue

            try:
                message_type, payload = _parse_client_message(message)
            except AppError as exc:
                await _send_json(
                    websocket,
                    {
                        "type": "error",
                        "payload": {
                            "code": exc.code,
                            "message": exc.message,
                        },
                    },
                )
                continue

            try:
                if message_type == "audio_chunk":
                    response = await _handle_audio_chunk(meeting_id, payload)
                    await _send_json(websocket, response)
                elif message_type == "recording_control":
                    response = await _handle_recording_control(meeting_id, host.id, payload)
                    await websocket_manager.broadcast(meeting_id, response)
                elif message_type == "ping":
                    await _send_json(websocket, {"type": "pong", "payload": {}})
                elif message_type == "sync_request":
                    response = await _handle_sync_request(meeting_id, payload)
                    await _send_json(websocket, response)
                else:
                    raise AppError(
                        message=f"Unsupported message type '{message_type}'",
                        code="INVALID_MESSAGE_TYPE",
                        status_code=status.HTTP_400_BAD_REQUEST,
                    )
            except ValidationError as exc:
                await _send_json(
                    websocket,
                    {
                        "type": "error",
                        "payload": {
                            "code": "VALIDATION_ERROR",
                            "message": "Invalid websocket payload",
                            "details": exc.errors(),
                        },
                    },
                )
            except (ValueError, binascii.Error):
                await _send_json(
                    websocket,
                    {
                        "type": "error",
                        "payload": {
                            "code": "INVALID_AUDIO_DATA",
                            "message": "Audio chunk data must be valid base64",
                        },
                    },
                )
            except AppError as exc:
                await _send_json(
                    websocket,
                    {
                        "type": "error",
                        "payload": {"code": exc.code, "message": exc.message},
                    },
                )
    except WebSocketDisconnect:
        return
    finally:
        _ = transcript_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            _ = await transcript_task
        await websocket_manager.disconnect(meeting_id, websocket)


@router.websocket("/meeting/{meeting_id}/participant")
async def participant_websocket(
    websocket: WebSocket,
    meeting_id: UUID,
    room_code: Annotated[str, Query()],
) -> None:
    participant_id = str(uuid4())
    try:
        meeting = await _get_participant_meeting(meeting_id, room_code)
    except AppError as exc:
        error_code = "INVALID_ROOM_CODE" if isinstance(exc, NotFoundError) else exc.code
        await _send_error_and_close(websocket, exc.message, code=error_code)
        return

    if not await websocket_manager.connect(meeting_id, websocket):
        return
    participant_count = await websocket_manager.add_participant(meeting_id, participant_id)
    transcript_task = asyncio.create_task(_forward_transcript_events(websocket, meeting_id))
    translation_state = ParticipantTranslationState()
    translation_task = asyncio.create_task(
        _forward_translation_events(websocket, meeting_id, translation_state)
    )
    session_id = str(uuid4())

    try:
        await _send_json(
            websocket,
            {
                "type": "connected",
                "payload": {
                    "session_id": session_id,
                    "role": "participant",
                    "meeting": {
                        "id": str(meeting.id),
                        "title": meeting.title,
                        "source_language": meeting.source_language,
                        "status": meeting.status.value,
                        "started_at": _serialize_datetime(meeting.started_at),
                    },
                    "participant_count": participant_count,
                },
            },
        )
        await _broadcast_participant_event(meeting_id, "participant_joined", participant_count)

        while True:
            try:
                message = cast(object, await websocket.receive_json())
            except ValueError:
                await _send_json(
                    websocket,
                    {
                        "type": "error",
                        "payload": {
                            "code": "INVALID_MESSAGE",
                            "message": "Message must be valid JSON",
                        },
                    },
                )
                continue

            try:
                message_type, payload = _parse_client_message(message)
            except AppError as exc:
                await _send_json(
                    websocket,
                    {
                        "type": "error",
                        "payload": {
                            "code": exc.code,
                            "message": exc.message,
                        },
                    },
                )
                continue

            try:
                if message_type == "ping":
                    await _send_json(websocket, {"type": "pong", "payload": {}})
                elif message_type == "sync_request":
                    response = await _handle_sync_request(meeting_id, payload)
                    await _send_json(websocket, response)
                elif message_type == "set_language":
                    await _handle_set_language(meeting, payload, websocket, translation_state)
                else:
                    raise AppError(
                        message=f"Unsupported message type '{message_type}'",
                        code="INVALID_MESSAGE_TYPE",
                        status_code=status.HTTP_400_BAD_REQUEST,
                    )
            except ValidationError as exc:
                await _send_json(
                    websocket,
                    {
                        "type": "error",
                        "payload": {
                            "code": "VALIDATION_ERROR",
                            "message": "Invalid websocket payload",
                            "details": exc.errors(),
                        },
                    },
                )
            except AppError as exc:
                await _send_json(
                    websocket,
                    {
                        "type": "error",
                        "payload": {"code": exc.code, "message": exc.message},
                    },
                )
    except WebSocketDisconnect:
        return
    finally:
        _ = transcript_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            _ = await transcript_task
        _ = translation_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            _ = await translation_task
        participant_count = await websocket_manager.remove_participant(meeting_id, participant_id)
        await websocket_manager.disconnect(meeting_id, websocket)
        await _broadcast_participant_event(meeting_id, "participant_left", participant_count)
