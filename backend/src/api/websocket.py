from __future__ import annotations

import asyncio
import base64
import binascii
import contextlib
import json
from datetime import datetime
from typing import Annotated, Any, cast
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


async def _forward_transcript_events(websocket: WebSocket, meeting_id: UUID) -> None:
    pubsub = redis_manager.client.pubsub()
    channel = f"meeting:{meeting_id}:transcript"
    await pubsub.subscribe(channel)
    try:
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message is None:
                await asyncio.sleep(0.1)
                continue

            data = message.get("data")
            if not isinstance(data, str):
                continue

            try:
                payload = json.loads(data)
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
            await pubsub.unsubscribe(channel)
        with contextlib.suppress(Exception):
            await pubsub.aclose()


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
            "last_sequence": sync_payload.last_sequence,
            "segments": [_serialize_segment(segment) for segment in segments],
        },
    }


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

    await websocket_manager.connect(meeting_id, websocket)
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
                message = cast(Any, await websocket.receive_json())
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

            if not isinstance(message, dict):
                await _send_json(
                    websocket,
                    {
                        "type": "error",
                        "payload": {
                            "code": "INVALID_MESSAGE",
                            "message": "Message must be a JSON object",
                        },
                    },
                )
                continue

            message_type = message.get("type")
            payload = message.get("payload", {})

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
        transcript_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            _ = await transcript_task
        await websocket_manager.disconnect(meeting_id, websocket)
