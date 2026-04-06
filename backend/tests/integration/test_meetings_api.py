from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.auth import build_token_pair
from src.models import Host, Meeting, MeetingStatus


MOCK_PASSWORD_HASH = "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW"


@pytest.fixture
async def test_user(integration_db_session: AsyncSession) -> Host:
    host = Host(
        id=uuid.uuid4(),
        email="host@example.com",
        password_hash=MOCK_PASSWORD_HASH,
        display_name="Test Host",
    )
    integration_db_session.add(host)
    await integration_db_session.commit()
    await integration_db_session.refresh(host)
    return host


@pytest.fixture
def user_auth_headers(test_user: Host) -> dict[str, str]:
    tokens = build_token_pair(str(test_user.id))
    return {"Authorization": f"Bearer {tokens['access_token']}"}


async def test_create_meeting_success(
    integration_client: AsyncClient,
    user_auth_headers: dict[str, str],
    test_user: Host,
):
    response = await integration_client.post(
        "/api/v1/meetings",
        json={"title": "Team Standup", "source_language": "vi"},
        headers=user_auth_headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Team Standup"
    assert body["source_language"] == "vi"
    assert body["status"] == "created"
    assert "room_code" in body
    assert "join_url" in body


async def test_create_meeting_requires_auth(integration_client: AsyncClient):
    response = await integration_client.post(
        "/api/v1/meetings",
        json={"title": "No Auth Meeting"},
    )
    assert response.status_code == 401


async def test_list_meetings_success(
    integration_client: AsyncClient,
    user_auth_headers: dict[str, str],
    test_user: Host,
    integration_db_session: AsyncSession,
):
    for i in range(3):
        meeting = Meeting(
            id=uuid.uuid4(),
            host_id=test_user.id,
            title=f"Meeting {i}",
            room_code=f"ABC{i}00",
            status=MeetingStatus.CREATED,
            source_language="vi",
        )
        integration_db_session.add(meeting)
    await integration_db_session.commit()

    response = await integration_client.get("/api/v1/meetings", headers=user_auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 3
    assert len(body["meetings"]) == 3


async def test_list_meetings_requires_auth(integration_client: AsyncClient):
    response = await integration_client.get("/api/v1/meetings")
    assert response.status_code == 401


async def test_get_meeting_details_success(
    integration_client: AsyncClient,
    user_auth_headers: dict[str, str],
    test_user: Host,
    integration_db_session: AsyncSession,
):
    meeting = Meeting(
        id=uuid.uuid4(),
        host_id=test_user.id,
        title="Detail Meeting",
        room_code="DET123",
        status=MeetingStatus.CREATED,
        source_language="en",
    )
    integration_db_session.add(meeting)
    await integration_db_session.commit()
    await integration_db_session.refresh(meeting)

    response = await integration_client.get(
        f"/api/v1/meetings/{meeting.id}", headers=user_auth_headers
    )
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(meeting.id)
    assert body["title"] == "Detail Meeting"


async def test_get_meeting_owner_only(
    integration_client: AsyncClient,
    user_auth_headers: dict[str, str],
    integration_db_session: AsyncSession,
):
    other_user = Host(
        id=uuid.uuid4(),
        email="other@example.com",
        password_hash=MOCK_PASSWORD_HASH,
        display_name="Other User",
    )
    integration_db_session.add(other_user)
    meeting = Meeting(
        id=uuid.uuid4(),
        host_id=other_user.id,
        title="Other Meeting",
        room_code="OTH123",
        status=MeetingStatus.CREATED,
        source_language="vi",
    )
    integration_db_session.add(meeting)
    await integration_db_session.commit()

    response = await integration_client.get(
        f"/api/v1/meetings/{meeting.id}", headers=user_auth_headers
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "AUTHORIZATION_ERROR"


async def test_start_recording_success(
    integration_client: AsyncClient,
    user_auth_headers: dict[str, str],
    test_user: Host,
    integration_db_session: AsyncSession,
):
    meeting = Meeting(
        id=uuid.uuid4(),
        host_id=test_user.id,
        title="Recording Meeting",
        room_code="REC123",
        status=MeetingStatus.CREATED,
        source_language="vi",
    )
    integration_db_session.add(meeting)
    await integration_db_session.commit()

    response = await integration_client.post(
        f"/api/v1/meetings/{meeting.id}/start",
        headers=user_auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "recording"
    assert "started_at" in body
    assert "websocket_url" in body


async def test_stop_recording_success(
    integration_client: AsyncClient,
    user_auth_headers: dict[str, str],
    test_user: Host,
    integration_db_session: AsyncSession,
):
    meeting = Meeting(
        id=uuid.uuid4(),
        host_id=test_user.id,
        title="Stop Recording",
        room_code="STP123",
        status=MeetingStatus.RECORDING,
        source_language="vi",
        started_at=datetime.now(UTC),
    )
    integration_db_session.add(meeting)
    await integration_db_session.commit()

    response = await integration_client.post(
        f"/api/v1/meetings/{meeting.id}/stop",
        headers=user_auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ended"
    assert "ended_at" in body
    assert "duration_seconds" in body
    assert "pending_chunks" in body


async def test_join_meeting_public(
    integration_client: AsyncClient,
    integration_db_session: AsyncSession,
):
    host = Host(
        id=uuid.uuid4(),
        email="pubhost@example.com",
        password_hash=MOCK_PASSWORD_HASH,
        display_name="Public Host",
    )
    integration_db_session.add(host)
    meeting = Meeting(
        id=uuid.uuid4(),
        host_id=host.id,
        title="Public Meeting",
        room_code="PUB123",
        status=MeetingStatus.RECORDING,
        source_language="vi",
    )
    integration_db_session.add(meeting)
    await integration_db_session.commit()

    response = await integration_client.get("/join/PUB123")
    assert response.status_code == 200
    body = response.json()
    assert body["meeting_id"] == str(meeting.id)
    assert body["title"] == "Public Meeting"
    assert "websocket_url" in body


async def test_join_meeting_not_found(integration_client: AsyncClient):
    response = await integration_client.get("/join/NOTEXIST")
    assert response.status_code == 404
