from __future__ import annotations

import asyncio
from collections import defaultdict
from uuid import UUID

from fastapi import WebSocket


class WebSocketManager:
    def __init__(self) -> None:
        self._rooms: dict[UUID, set[WebSocket]] = defaultdict(set)
        self._lock: asyncio.Lock = asyncio.Lock()

    async def connect(self, meeting_id: UUID, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._rooms[meeting_id].add(websocket)

    async def disconnect(self, meeting_id: UUID, websocket: WebSocket) -> None:
        async with self._lock:
            room = self._rooms.get(meeting_id)
            if room is None:
                return
            room.discard(websocket)
            if not room:
                _ = self._rooms.pop(meeting_id, None)

    async def send_json(self, websocket: WebSocket, payload: dict[str, object]) -> None:
        await websocket.send_json(payload)

    async def broadcast(self, meeting_id: UUID, payload: dict[str, object]) -> None:
        sockets = await self._snapshot(meeting_id)
        stale_connections: list[WebSocket] = []
        for websocket in sockets:
            try:
                await websocket.send_json(payload)
            except RuntimeError:
                stale_connections.append(websocket)
        for websocket in stale_connections:
            await self.disconnect(meeting_id, websocket)

    async def participant_count(self, meeting_id: UUID) -> int:
        return len(await self._snapshot(meeting_id))

    async def _snapshot(self, meeting_id: UUID) -> tuple[WebSocket, ...]:
        async with self._lock:
            return tuple(self._rooms.get(meeting_id, set()))


websocket_manager = WebSocketManager()
