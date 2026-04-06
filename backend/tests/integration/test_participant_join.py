from __future__ import annotations

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from src.core.exceptions import NotFoundError
from src.models import Host, Meeting, MeetingStatus, TranscriptSegment


MOCK_PASSWORD_HASH = "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW"


@pytest.mark.asyncio
async def test_participant_websocket_connects_and_receives_sync_response(
    integration_sync_client: TestClient,
):
    host = Host(
        id=uuid.uuid4(),
        email="participant@example.com",
        password_hash=MOCK_PASSWORD_HASH,
        display_name="Participant Host",
    )
    meeting = Meeting(
        id=uuid.uuid4(),
        host_id=host.id,
        title="Participant Meeting",
        room_code="PRT001",
        status=MeetingStatus.RECORDING,
        source_language="vi",
        started_at=datetime.now(UTC),
    )
    segment = TranscriptSegment(
        id=uuid.uuid4(),
        meeting_id=meeting.id,
        audio_chunk_id=None,
        sequence=1,
        text="Xin chào participant",
        start_time_ms=0,
        end_time_ms=1000,
        confidence=0.95,
        is_partial=False,
    )
    with (
        patch("src.api.websocket._get_participant_meeting", AsyncMock(return_value=meeting)),
        patch(
            "src.api.websocket._handle_sync_request",
            AsyncMock(
                return_value={
                    "type": "sync_response",
                    "payload": {"last_sequence": 1, "segments": [{"id": str(segment.id)}]},
                }
            ),
        ),
    ):
        with integration_sync_client.websocket_connect(
            f"/ws/meeting/{meeting.id}/participant?room_code={meeting.room_code}"
        ) as websocket:
            connected = websocket.receive_json()
            assert connected["type"] == "connected"
            assert connected["payload"]["role"] == "participant"

            participant_joined = websocket.receive_json()
            assert participant_joined["type"] == "participant_joined"

            websocket.send_json({"type": "sync_request", "payload": {"last_sequence": 0}})
            sync_response = websocket.receive_json()
            assert sync_response["type"] == "sync_response"
            assert len(sync_response["payload"]["segments"]) == 1


@pytest.mark.asyncio
async def test_participant_websocket_rejects_invalid_room_code(
    integration_sync_client: TestClient,
):
    with patch(
        "src.api.websocket._get_participant_meeting",
        AsyncMock(side_effect=NotFoundError("Meeting not found")),
    ):
        with integration_sync_client.websocket_connect(
            "/ws/meeting/00000000-0000-0000-0000-000000000001/participant?room_code=BAD001"
        ) as websocket:
            error = websocket.receive_json()
            assert error["type"] == "error"
