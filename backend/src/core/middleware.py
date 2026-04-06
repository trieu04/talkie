from __future__ import annotations

import asyncio
import math
import time
from collections import defaultdict, deque
from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import PlainTextResponse
from starlette.types import ASGIApp
from typing_extensions import override

from src.core.config import settings


class RateLimitMiddleware(BaseHTTPMiddleware):
    _window_seconds: int
    _default_limit: int
    _request_times: dict[str, deque[float]]
    _lock: asyncio.Lock

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)
        self._window_seconds = 60
        self._default_limit = 100
        self._request_times = defaultdict(deque)
        self._lock = asyncio.Lock()

    @override
    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        route_key, limit = self._limit_for_path(request.url.path)
        client_ip = self._client_ip(request)
        bucket_key = f"{client_ip}:{route_key}"
        now = time.monotonic()

        async with self._lock:
            timestamps = self._request_times[bucket_key]
            self._purge_expired(timestamps, now)
            if len(timestamps) >= limit:
                retry_after = max(1, math.ceil(self._window_seconds - (now - timestamps[0])))
                return PlainTextResponse(
                    "Too Many Requests",
                    status_code=429,
                    headers={"Retry-After": str(retry_after)},
                )
            timestamps.append(now)

        return await call_next(request)

    def _limit_for_path(self, path: str) -> tuple[str, int]:
        normalized = path.removeprefix(settings.api_v1_prefix)
        if normalized == "/auth/login":
            return ("auth_login", 10)
        if normalized == "/auth/register":
            return ("auth_register", 5)
        if normalized == "/worker" or normalized.startswith("/worker/"):
            return ("worker", 1000)
        return (normalized, self._default_limit)

    def _purge_expired(self, timestamps: deque[float], now: float) -> None:
        while timestamps and now - timestamps[0] >= self._window_seconds:
            _ = timestamps.popleft()

    def _client_ip(self, request: Request) -> str:
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            candidate = forwarded_for.split(",", 1)[0].strip()
            if candidate:
                return candidate
        client = request.client
        if client and client.host:
            return client.host
        return "unknown"
