from __future__ import annotations

from collections.abc import Awaitable, Callable
from datetime import datetime
from typing import cast
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.core.exceptions import AppError, ConflictError
from src.models import Meeting, MeetingStatus
from src.services.meeting_service import MeetingService


def make_scalar_result(value: object) -> MagicMock:
    result = MagicMock()
    result.scalar_one_or_none = MagicMock(return_value=value)
    return result


class TestMeetingService:
    def test_generate_room_code_returns_6_char_uppercase_alphanumeric_string(self):
        room_code = MeetingService.generate_room_code()

        assert len(room_code) == 6
        assert room_code.isalnum() is True
        assert room_code == room_code.upper()

    async def test_create_meeting_creates_and_returns_a_meeting(self, mock_db_session: AsyncMock):
        service = MeetingService(mock_db_session)
        host_id = uuid.uuid4()

        with (
            patch.object(service, "get_meeting_by_room_code", AsyncMock(return_value=None)),
            patch(
                "src.services.meeting_service.MeetingService.generate_room_code",
                return_value="ABC123",
            ),
        ):
            meeting = await service.create_meeting(host_id, "Planning", "en")

        assert meeting.host_id == host_id
        assert meeting.title == "Planning"
        assert meeting.source_language == "en"
        assert meeting.room_code == "ABC123"
        assert meeting.status == MeetingStatus.CREATED

    async def test_create_meeting_with_empty_title_normalizes_to_none(
        self,
        mock_db_session: AsyncMock,
    ):
        service = MeetingService(mock_db_session)

        with (
            patch.object(service, "get_meeting_by_room_code", AsyncMock(return_value=None)),
            patch(
                "src.services.meeting_service.MeetingService.generate_room_code",
                return_value="ABC123",
            ),
        ):
            meeting = await service.create_meeting(uuid.uuid4(), "   ", "vi")

        assert meeting.title is None

    async def test_create_meeting_raises_conflict_error_after_max_attempts(
        self,
        mock_db_session: AsyncMock,
        meeting_factory: Callable[..., Meeting],
    ):
        service = MeetingService(mock_db_session)
        existing_meeting = meeting_factory()

        with (
            patch.object(
                service,
                "get_meeting_by_room_code",
                AsyncMock(return_value=existing_meeting),
            ) as mock_get_meeting_by_room_code,
            patch(
                "src.services.meeting_service.MeetingService.generate_room_code",
                return_value="ABC123",
            ),
        ):
            with pytest.raises(ConflictError, match="Unable to generate a unique room code"):
                _ = await service.create_meeting(uuid.uuid4(), "Planning", "en")

        assert mock_get_meeting_by_room_code.await_count == service.ROOM_CODE_MAX_ATTEMPTS

    async def test_get_meeting_returns_meeting_from_db(
        self,
        mock_db_session: AsyncMock,
        meeting_factory: Callable[..., Meeting],
    ):
        meeting = meeting_factory()
        mock_db_session.execute = AsyncMock(return_value=make_scalar_result(meeting))
        service = MeetingService(mock_db_session)

        result = await service.get_meeting(meeting.id)

        assert result is meeting

    async def test_get_meeting_returns_none_when_not_found(self, mock_db_session: AsyncMock):
        mock_db_session.execute = AsyncMock(return_value=make_scalar_result(None))
        service = MeetingService(mock_db_session)

        result = await service.get_meeting(uuid.uuid4())

        assert result is None

    @patch("src.services.meeting_service.datetime")
    async def test_start_meeting_transitions_created_to_recording(
        self,
        mock_datetime: MagicMock,
        mock_db_session: AsyncMock,
        meeting_factory: Callable[..., Meeting],
        frozen_time: datetime,
    ):
        host_id = uuid.uuid4()
        meeting = meeting_factory(host_id=host_id, status=MeetingStatus.CREATED, started_at=None)
        cast(MagicMock, mock_datetime.now).return_value = frozen_time
        mock_db_session.execute = AsyncMock(
            side_effect=[make_scalar_result(meeting), make_scalar_result(None)]
        )
        service = MeetingService(mock_db_session)

        result = await service.start_meeting(meeting.id, host_id)

        assert result is meeting
        assert meeting.status == MeetingStatus.RECORDING
        assert meeting.started_at == frozen_time

    async def test_start_meeting_raises_app_error_when_status_is_ended(
        self,
        mock_db_session: AsyncMock,
        meeting_factory: Callable[..., Meeting],
    ):
        host_id = uuid.uuid4()
        meeting = meeting_factory(host_id=host_id, status=MeetingStatus.ENDED)
        mock_db_session.execute = AsyncMock(return_value=make_scalar_result(meeting))
        service = MeetingService(mock_db_session)

        with pytest.raises(AppError, match="Cannot start meeting while status is 'ended'"):
            _ = await service.start_meeting(meeting.id, host_id)

    @patch("src.services.meeting_service.datetime")
    async def test_stop_meeting_transitions_recording_to_ended(
        self,
        mock_datetime: MagicMock,
        mock_db_session: AsyncMock,
        meeting_factory: Callable[..., Meeting],
        frozen_time: datetime,
    ):
        host_id = uuid.uuid4()
        meeting = meeting_factory(host_id=host_id, status=MeetingStatus.RECORDING)
        cast(MagicMock, mock_datetime.now).return_value = frozen_time
        mock_db_session.execute = AsyncMock(return_value=make_scalar_result(meeting))
        service = MeetingService(mock_db_session)

        result = await service.stop_meeting(meeting.id, host_id)

        assert result is meeting
        assert meeting.status == MeetingStatus.ENDED
        assert meeting.ended_at == frozen_time

    @patch("src.services.meeting_service.datetime")
    async def test_stop_meeting_with_abnormal_sets_ended_abnormal(
        self,
        mock_datetime: MagicMock,
        mock_db_session: AsyncMock,
        meeting_factory: Callable[..., Meeting],
        frozen_time: datetime,
    ):
        host_id = uuid.uuid4()
        meeting = meeting_factory(host_id=host_id, status=MeetingStatus.RECORDING)
        cast(MagicMock, mock_datetime.now).return_value = frozen_time
        mock_db_session.execute = AsyncMock(return_value=make_scalar_result(meeting))
        service = MeetingService(mock_db_session)

        result = await service.stop_meeting(meeting.id, host_id, abnormal=True)

        assert result is meeting
        assert meeting.status == MeetingStatus.ENDED_ABNORMAL
        assert meeting.ended_at == frozen_time

    async def test_pause_meeting_transitions_recording_to_paused(
        self,
        mock_db_session: AsyncMock,
        meeting_factory: Callable[..., Meeting],
    ):
        host_id = uuid.uuid4()
        meeting = meeting_factory(host_id=host_id, status=MeetingStatus.RECORDING)
        mock_db_session.execute = AsyncMock(return_value=make_scalar_result(meeting))
        service = MeetingService(mock_db_session)

        result = await service.pause_meeting(meeting.id, host_id)

        assert result is meeting
        assert meeting.status == MeetingStatus.PAUSED

    async def test_resume_meeting_transitions_paused_to_recording(
        self,
        mock_db_session: AsyncMock,
        meeting_factory: Callable[..., Meeting],
    ):
        host_id = uuid.uuid4()
        meeting = meeting_factory(host_id=host_id, status=MeetingStatus.PAUSED)
        mock_db_session.execute = AsyncMock(
            side_effect=[make_scalar_result(meeting), make_scalar_result(None)]
        )
        service = MeetingService(mock_db_session)

        result = await service.resume_meeting(meeting.id, host_id)

        assert result is meeting
        assert meeting.status == MeetingStatus.RECORDING

    async def test_ensure_no_other_active_meeting_raises_conflict_error_when_another_exists(
        self,
        mock_db_session: AsyncMock,
        meeting_factory: Callable[..., Meeting],
    ):
        active_meeting = meeting_factory(status=MeetingStatus.RECORDING)
        mock_db_session.execute = AsyncMock(return_value=make_scalar_result(active_meeting))
        service = MeetingService(mock_db_session)
        ensure_no_other_active_meeting = cast(
            Callable[[uuid.UUID], Awaitable[None]],
            getattr(service, "_ensure_no_other_active_meeting"),
        )

        with pytest.raises(ConflictError, match="Host already has an active meeting recording"):
            _ = await ensure_no_other_active_meeting(uuid.uuid4())
