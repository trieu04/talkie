from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.auth import build_token_pair, hash_password, verify_password
from src.models import AudioChunk, AudioChunkStatus, Host, Meeting, MeetingStatus


@pytest.mark.integration
class TestHostCRUD:
    async def test_create_host_persists_to_postgres(
        self,
        pg_session: AsyncSession,
        cleanup_host: list[uuid.UUID],
    ):
        host_id = uuid.uuid4()
        cleanup_host.append(host_id)

        host = Host(
            id=host_id,
            email=f"contract-{uuid.uuid4().hex[:8]}@test.com",
            password_hash=hash_password("StrongPass1"),
            display_name="Contract Test",
        )
        pg_session.add(host)
        await pg_session.commit()
        await pg_session.refresh(host)

        assert host.id == host_id
        assert host.created_at is not None

        result = await pg_session.execute(select(Host).where(Host.id == host_id))
        fetched = result.scalar_one()
        assert fetched.email == host.email
        assert fetched.display_name == "Contract Test"

    async def test_unique_email_constraint(
        self,
        pg_session: AsyncSession,
        cleanup_host: list[uuid.UUID],
    ):
        email = f"unique-{uuid.uuid4().hex[:8]}@test.com"
        host1_id = uuid.uuid4()
        cleanup_host.append(host1_id)

        host1 = Host(
            id=host1_id,
            email=email,
            password_hash=hash_password("StrongPass1"),
            display_name="First",
        )
        pg_session.add(host1)
        await pg_session.commit()

        host2 = Host(
            id=uuid.uuid4(),
            email=email,
            password_hash=hash_password("StrongPass1"),
            display_name="Second",
        )
        pg_session.add(host2)
        from sqlalchemy.exc import IntegrityError

        with pytest.raises(IntegrityError):
            await pg_session.flush()
        await pg_session.rollback()

    async def test_password_hash_verifies_correctly(
        self,
        pg_session: AsyncSession,
        cleanup_host: list[uuid.UUID],
    ):
        host_id = uuid.uuid4()
        cleanup_host.append(host_id)

        password = "MySecretPass1"
        host = Host(
            id=host_id,
            email=f"pass-{uuid.uuid4().hex[:8]}@test.com",
            password_hash=hash_password(password),
            display_name="Pass Test",
        )
        pg_session.add(host)
        await pg_session.commit()
        await pg_session.refresh(host)

        assert verify_password(password, host.password_hash) is True
        assert verify_password("WrongPass1", host.password_hash) is False


@pytest.mark.integration
class TestMeetingCRUD:
    async def test_create_meeting_with_enum_status(
        self,
        pg_session: AsyncSession,
        cleanup_host: list[uuid.UUID],
        cleanup_meeting: list[uuid.UUID],
    ):
        host_id = uuid.uuid4()
        cleanup_host.append(host_id)
        host = Host(
            id=host_id,
            email=f"meet-{uuid.uuid4().hex[:8]}@test.com",
            password_hash=hash_password("StrongPass1"),
            display_name="Meeting Host",
        )
        pg_session.add(host)
        await pg_session.commit()

        meeting_id = uuid.uuid4()
        cleanup_meeting.append(meeting_id)
        meeting = Meeting(
            id=meeting_id,
            host_id=host_id,
            title="Contract Test Meeting",
            room_code=uuid.uuid4().hex[:6].upper(),
            status=MeetingStatus.CREATED,
            source_language="vi",
        )
        pg_session.add(meeting)
        await pg_session.commit()
        await pg_session.refresh(meeting)

        assert meeting.status == MeetingStatus.CREATED

        result = await pg_session.execute(select(Meeting).where(Meeting.id == meeting_id))
        fetched = result.scalar_one()
        assert fetched.status == MeetingStatus.CREATED
        assert fetched.title == "Contract Test Meeting"

    async def test_meeting_status_transitions(
        self,
        pg_session: AsyncSession,
        cleanup_host: list[uuid.UUID],
        cleanup_meeting: list[uuid.UUID],
    ):
        host_id = uuid.uuid4()
        cleanup_host.append(host_id)
        host = Host(
            id=host_id,
            email=f"trans-{uuid.uuid4().hex[:8]}@test.com",
            password_hash=hash_password("StrongPass1"),
            display_name="Transition Host",
        )
        pg_session.add(host)
        await pg_session.commit()

        meeting_id = uuid.uuid4()
        cleanup_meeting.append(meeting_id)
        meeting = Meeting(
            id=meeting_id,
            host_id=host_id,
            title="Transition Meeting",
            room_code=uuid.uuid4().hex[:6].upper(),
            status=MeetingStatus.CREATED,
            source_language="vi",
        )
        pg_session.add(meeting)
        await pg_session.commit()

        from datetime import UTC, datetime

        meeting.status = MeetingStatus.RECORDING
        meeting.started_at = datetime.now(UTC)
        await pg_session.commit()
        await pg_session.refresh(meeting)
        assert meeting.status == MeetingStatus.RECORDING

        meeting.status = MeetingStatus.PAUSED
        await pg_session.commit()
        await pg_session.refresh(meeting)
        assert meeting.status == MeetingStatus.PAUSED

        meeting.status = MeetingStatus.ENDED
        meeting.ended_at = datetime.now(UTC)
        await pg_session.commit()
        await pg_session.refresh(meeting)
        assert meeting.status == MeetingStatus.ENDED


@pytest.mark.integration
class TestAudioChunkCRUD:
    async def test_create_and_query_audio_chunks_with_enum_status(
        self,
        pg_session: AsyncSession,
        cleanup_host: list[uuid.UUID],
        cleanup_meeting: list[uuid.UUID],
    ):
        host_id = uuid.uuid4()
        cleanup_host.append(host_id)
        host = Host(
            id=host_id,
            email=f"chunk-{uuid.uuid4().hex[:8]}@test.com",
            password_hash=hash_password("StrongPass1"),
            display_name="Chunk Host",
        )
        pg_session.add(host)
        await pg_session.commit()

        meeting_id = uuid.uuid4()
        cleanup_meeting.append(meeting_id)
        meeting = Meeting(
            id=meeting_id,
            host_id=host_id,
            title="Chunk Meeting",
            room_code=uuid.uuid4().hex[:6].upper(),
            status=MeetingStatus.RECORDING,
            source_language="vi",
        )
        pg_session.add(meeting)
        await pg_session.commit()

        chunk = AudioChunk(
            id=uuid.uuid4(),
            meeting_id=meeting_id,
            sequence=0,
            storage_key=f"meetings/{meeting_id}/audio/0.opus",
            duration_ms=5000,
            status=AudioChunkStatus.PENDING,
        )
        pg_session.add(chunk)
        await pg_session.commit()
        await pg_session.refresh(chunk)

        assert chunk.status == AudioChunkStatus.PENDING

        result = await pg_session.execute(
            select(AudioChunk).where(
                AudioChunk.meeting_id == meeting_id,
                AudioChunk.status == AudioChunkStatus.PENDING,
            )
        )
        fetched = result.scalar_one()
        assert fetched.id == chunk.id

        chunk.status = AudioChunkStatus.ASSIGNED
        chunk.worker_id = "test-worker"
        await pg_session.commit()
        await pg_session.refresh(chunk)
        assert chunk.status == AudioChunkStatus.ASSIGNED

        result = await pg_session.execute(
            select(AudioChunk).where(
                AudioChunk.status.in_([AudioChunkStatus.ASSIGNED, AudioChunkStatus.PROCESSING])
            )
        )
        assigned_chunks = list(result.scalars().all())
        assert any(c.id == chunk.id for c in assigned_chunks)


@pytest.mark.integration
class TestTokenFlow:
    async def test_token_pair_roundtrip(
        self,
        pg_session: AsyncSession,
        cleanup_host: list[uuid.UUID],
    ):
        host_id = uuid.uuid4()
        cleanup_host.append(host_id)
        host = Host(
            id=host_id,
            email=f"token-{uuid.uuid4().hex[:8]}@test.com",
            password_hash=hash_password("StrongPass1"),
            display_name="Token User",
        )
        pg_session.add(host)
        await pg_session.commit()

        from src.core.auth import decode_token

        pair = build_token_pair(str(host_id))
        assert pair["token_type"] == "bearer"
        assert pair["expires_in"] > 0

        access_payload = decode_token(pair["access_token"], expected_type="access")
        assert access_payload["sub"] == str(host_id)

        refresh_payload = decode_token(pair["refresh_token"], expected_type="refresh")
        assert refresh_payload["sub"] == str(host_id)
