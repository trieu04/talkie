from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from src.models import MeetingStatus
from src.services.meeting_service import MeetingService


@pytest.mark.asyncio
async def test_abnormal_meeting_end_sets_ended_abnormal(
    mock_db_session: AsyncMock, meeting_factory
):
    meeting = meeting_factory(status=MeetingStatus.RECORDING)
    service = MeetingService(mock_db_session)
    service.get_meeting = AsyncMock(return_value=meeting)  # type: ignore[method-assign]

    result = await service.stop_meeting(meeting.id, meeting.host_id, abnormal=True)

    assert result.status == MeetingStatus.ENDED_ABNORMAL
    assert result.ended_at is not None
