from __future__ import annotations

import time
from uuid import uuid4

import pytest

from src.core.websocket_manager import WebSocketManager


class StubRedis:
    async def sadd(self, *_args):
        return 1

    async def scard(self, *_args):
        return 10


@pytest.mark.asyncio
async def test_participant_count_lookup_is_fast(monkeypatch):
    manager = WebSocketManager()
    monkeypatch.setattr("src.core.websocket_manager.redis_manager._client", StubRedis())
    started_at = time.perf_counter()
    count = await manager.participant_count(uuid4())
    elapsed_ms = (time.perf_counter() - started_at) * 1000
    assert count == 10
    assert elapsed_ms < 100
