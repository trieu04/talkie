from __future__ import annotations

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from src.core.auth import build_token_pair
from src.models import Host, Meeting, MeetingStatus


MOCK_PASSWORD_HASH = "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW"


@pytest.mark.asyncio
async def test_host_websocket_connects_and_replies_to_ping(
    integration_sync_client: TestClient,
):
    host = Host(
        id=uuid.uuid4(),
        email="ws-host@example.com",
        password_hash=MOCK_PASSWORD_HASH,
        display_name="WS Host",
    )
    meeting = Meeting(
        id=uuid.uuid4(),
        host_id=host.id,
        title="Socket Meeting",
        room_code="WSH001",
        status=MeetingStatus.CREATED,
        source_language="vi",
        started_at=datetime.now(UTC),
    )
    access_token = build_token_pair(str(host.id))["access_token"]
    with (
        patch("src.api.websocket._authenticate_host", AsyncMock(return_value=host)),
        patch("src.api.websocket._get_owned_meeting", AsyncMock(return_value=meeting)),
    ):
        with integration_sync_client.websocket_connect(
            f"/ws/meeting/{meeting.id}/host?token={access_token}"
        ) as websocket:
            connected = websocket.receive_json()
            assert connected["type"] == "connected"
            assert connected["payload"]["role"] == "host"

            websocket.send_json({"type": "ping", "payload": {}})
            pong = websocket.receive_json()
            assert pong["type"] == "pong"


@pytest.mark.asyncio
async def test_host_websocket_rejects_invalid_audio_payload(
    integration_sync_client: TestClient,
):
    host = Host(
        id=uuid.uuid4(),
        email="invalid-audio@example.com",
        password_hash=MOCK_PASSWORD_HASH,
        display_name="Audio Host",
    )
    meeting = Meeting(
        id=uuid.uuid4(),
        host_id=host.id,
        title="Audio Meeting",
        room_code="AUD001",
        status=MeetingStatus.RECORDING,
        source_language="vi",
        started_at=datetime.now(UTC),
    )
    access_token = build_token_pair(str(host.id))["access_token"]
    with (
        patch("src.api.websocket._authenticate_host", AsyncMock(return_value=host)),
        patch("src.api.websocket._get_owned_meeting", AsyncMock(return_value=meeting)),
    ):
        with integration_sync_client.websocket_connect(
            f"/ws/meeting/{meeting.id}/host?token={access_token}"
        ) as websocket:
            _ = websocket.receive_json()
            websocket.send_json(
                {
                    "type": "audio_chunk",
                    "payload": {
                        "sequence": 0,
                        "data": "%%%invalid-base64%%%",
                        "duration_ms": 4000,
                        "is_final": False,
                    },
                }
            )
            error = websocket.receive_json()
            assert error["type"] == "error"
            assert error["payload"]["code"] == "INVALID_AUDIO_DATA"
