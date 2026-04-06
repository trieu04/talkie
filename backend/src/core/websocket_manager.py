from __future__ import annotations

import asyncio
import inspect
import time
from collections import defaultdict
from typing import cast
from uuid import UUID

from fastapi import WebSocket, status
from starlette.websockets import WebSocketDisconnect, WebSocketState

from src.core.redis import redis_manager


class WebSocketManager:
    _max_room_size: int = 100
    _stale_timeout_seconds: int = 30 * 60

    def __init__(self) -> None:
        self._rooms: dict[UUID, set[WebSocket]] = defaultdict(set)
        self._last_seen: dict[WebSocket, float] = {}
        self._active_connections: int = 0
        self._stale_connections_cleaned: int = 0
        self._lock: asyncio.Lock = asyncio.Lock()

    async def connect(self, meeting_id: UUID, websocket: WebSocket) -> bool:
        await websocket.accept()
        _ = await self.cleanup_stale_connections(meeting_id)
        async with self._lock:
            room = self._rooms[meeting_id]
            if websocket in room:
                self._touch_connection(websocket)
                return True
            if len(room) >= self._max_room_size:
                await websocket.close(
                    code=status.WS_1013_TRY_AGAIN_LATER,
                    reason="Meeting room is full",
                )
                return False
            room.add(websocket)
            self._touch_connection(websocket)
            self._active_connections += 1
            return True

    async def disconnect(self, meeting_id: UUID, websocket: WebSocket) -> None:
        async with self._lock:
            room = self._rooms.get(meeting_id)
            if room is None:
                return
            if websocket in room:
                room.discard(websocket)
                _ = self._last_seen.pop(websocket, None)
                self._active_connections = max(0, self._active_connections - 1)
            if not room:
                _ = self._rooms.pop(meeting_id, None)

    async def send_json(self, websocket: WebSocket, payload: dict[str, object]) -> None:
        await websocket.send_json(payload)
        self._touch_connection(websocket)

    async def broadcast(self, meeting_id: UUID, payload: dict[str, object]) -> None:
        _ = await self.cleanup_stale_connections(meeting_id)
        sockets = await self._snapshot(meeting_id)
        stale_connections: list[WebSocket] = []
        for websocket in sockets:
            try:
                await websocket.send_json(payload)
                self._touch_connection(websocket)
            except (RuntimeError, WebSocketDisconnect):
                stale_connections.append(websocket)
        for websocket in stale_connections:
            await self.disconnect(meeting_id, websocket)

    async def cleanup_stale_connections(self, meeting_id: UUID | None = None) -> int:
        now = time.monotonic()
        async with self._lock:
            meeting_ids = [meeting_id] if meeting_id is not None else list(self._rooms.keys())
            removed = 0
            for current_meeting_id in meeting_ids:
                room = self._rooms.get(current_meeting_id)
                if room is None:
                    continue
                stale_connections = [
                    websocket for websocket in room if self._is_stale(websocket, now)
                ]
                for websocket in stale_connections:
                    room.discard(websocket)
                    _ = self._last_seen.pop(websocket, None)
                    self._active_connections = max(0, self._active_connections - 1)
                    removed += 1
                if not room:
                    _ = self._rooms.pop(current_meeting_id, None)
            self._stale_connections_cleaned += removed
            return removed

    async def participant_count(self, meeting_id: UUID) -> int:
        return await self._redis_int(redis_manager.client.scard(self._participant_key(meeting_id)))

    async def active_connection_count(self) -> int:
        _ = await self.cleanup_stale_connections()
        async with self._lock:
            return self._active_connections

    async def room_connection_count(self, meeting_id: UUID) -> int:
        _ = await self.cleanup_stale_connections(meeting_id)
        async with self._lock:
            return len(self._rooms.get(meeting_id, set()))

    async def metrics(self) -> dict[str, int]:
        _ = await self.cleanup_stale_connections()
        async with self._lock:
            return {
                "active_connections": self._active_connections,
                "active_rooms": len(self._rooms),
                "stale_connections_cleaned": self._stale_connections_cleaned,
            }

    async def add_participant(self, meeting_id: UUID, participant_id: str) -> int:
        key = self._participant_key(meeting_id)
        add_result = redis_manager.client.sadd(key, participant_id)
        if inspect.isawaitable(add_result):
            _ = await add_result
        return await self._redis_int(redis_manager.client.scard(key))

    async def remove_participant(self, meeting_id: UUID, participant_id: str) -> int:
        key = self._participant_key(meeting_id)
        remove_result = redis_manager.client.srem(key, participant_id)
        if inspect.isawaitable(remove_result):
            _ = await remove_result
        return await self._redis_int(redis_manager.client.scard(key))

    async def _snapshot(self, meeting_id: UUID) -> tuple[WebSocket, ...]:
        async with self._lock:
            return tuple(self._rooms.get(meeting_id, set()))

    def _touch_connection(self, websocket: WebSocket) -> None:
        self._last_seen[websocket] = time.monotonic()

    def _is_stale(self, websocket: WebSocket, now: float) -> bool:
        if websocket.client_state != WebSocketState.CONNECTED:
            return True
        if websocket.application_state != WebSocketState.CONNECTED:
            return True
        last_seen = self._last_seen.get(websocket)
        if last_seen is None:
            return True
        return now - last_seen > self._stale_timeout_seconds

    @staticmethod
    def _participant_key(meeting_id: UUID) -> str:
        return f"meeting:{meeting_id}:participants"

    @staticmethod
    async def _redis_int(result: object) -> int:
        if inspect.isawaitable(result):
            return cast(int, await result)
        return int(cast(int, result))


websocket_manager = WebSocketManager()
