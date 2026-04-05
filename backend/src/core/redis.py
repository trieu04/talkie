from __future__ import annotations

import inspect
from typing import cast

from redis.asyncio import ConnectionPool, Redis

from src.core.config import settings


class RedisManager:
    def __init__(self) -> None:
        self._pool: ConnectionPool = cast(
            ConnectionPool,
            ConnectionPool.from_url(
                settings.redis_url,
                decode_responses=True,
            ),
        )
        self._client: Redis = Redis(connection_pool=self._pool)

    @property
    def client(self) -> Redis:
        return self._client

    async def ping(self) -> bool:
        result = self._client.ping()
        if inspect.isawaitable(result):
            return bool(await result)
        return bool(cast(bool, result))

    async def close(self) -> None:
        await self._client.aclose()
        await self._pool.aclose()


redis_manager = RedisManager()
