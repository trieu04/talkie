from __future__ import annotations

import time

from src.services.meeting_service import MeetingService


def test_room_code_generation_remains_fast(mock_db_session):
    service = MeetingService(mock_db_session)
    started_at = time.perf_counter()
    codes = {service.generate_room_code() for _ in range(200)}
    elapsed_ms = (time.perf_counter() - started_at) * 1000
    assert len(codes) == 200
    assert elapsed_ms < 1000
