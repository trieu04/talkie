from __future__ import annotations

import uuid

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.auth import build_token_pair
from src.models import Host, Meeting, MeetingStatus


MOCK_PASSWORD_HASH = "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW"


async def test_audio_upload_is_queued_when_no_worker_is_online(
    integration_client: AsyncClient,
    integration_db_session: AsyncSession,
):
    host = Host(
        id=uuid.uuid4(),
        email="queue@example.com",
        password_hash=MOCK_PASSWORD_HASH,
        display_name="Queue",
    )
    meeting = Meeting(
        id=uuid.uuid4(),
        host_id=host.id,
        title="Queue Meeting",
        room_code="QUEUE1",
        status=MeetingStatus.RECORDING,
        source_language="vi",
    )
    integration_db_session.add_all([host, meeting])
    await integration_db_session.commit()

    token = build_token_pair(str(host.id))["access_token"]
    response = await integration_client.post(
        f"/api/v1/meetings/{meeting.id}/audio",
        headers={"Authorization": f"Bearer {token}"},
        files={"audio": ("chunk.webm", b"audio-bytes", "audio/webm")},
        data={"sequence": "0", "duration_ms": "4000"},
    )

    assert response.status_code == 201
    assert response.json()["status"] == "pending"
