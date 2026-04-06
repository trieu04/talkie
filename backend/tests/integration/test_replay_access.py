from __future__ import annotations

from httpx import AsyncClient


async def test_invalid_replay_room_code_returns_not_found(integration_client: AsyncClient):
    response = await integration_client.get("/api/v1/meetings/join/NOPE01/summary")
    assert response.status_code == 404
