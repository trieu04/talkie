from __future__ import annotations

# pyright: reportMissingImports=false, reportUnknownVariableType=false, reportUnknownArgumentType=false
import asyncio
import logging
import time
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from src.api.auth import hosts_router, router as auth_router
from src.api.meetings import public_router as public_meetings_router
from src.api.meetings import router as meetings_router
from src.api.websocket import router as websocket_router
from src.api.worker import router as worker_router
from src.core.config import settings
from src.core.exceptions import install_exception_handlers
from src.core.middleware import RateLimitMiddleware
from src.core.redis import redis_manager
from src.core.storage import storage
from src.workers.chunk_monitor import run_chunk_monitor

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    infra_ready = True
    try:
        redis_ready = await redis_manager.ping()
        if not redis_ready:
            raise RuntimeError("Redis ping returned false")
    except Exception:
        if not settings.allow_startup_without_infra:
            raise RuntimeError(f"{app.title} startup failed because Redis is unavailable")
        logger.warning("Starting without Redis because ALLOW_STARTUP_WITHOUT_INFRA is enabled")
        infra_ready = False

    try:
        await storage.ensure_bucket()
    except Exception:
        if not settings.allow_startup_without_infra:
            raise RuntimeError(f"{app.title} startup failed because storage is unavailable")
        logger.warning(
            "Starting without object storage because ALLOW_STARTUP_WITHOUT_INFRA is enabled"
        )
        infra_ready = False

    stop_event = asyncio.Event()
    chunk_monitor_task = asyncio.create_task(run_chunk_monitor(stop_event)) if infra_ready else None
    yield
    stop_event.set()
    if chunk_monitor_task is not None:
        await chunk_monitor_task
    await redis_manager.close()


app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware)
install_exception_handlers(app)

api_router = APIRouter(prefix=settings.api_v1_prefix)
api_router.include_router(auth_router)
api_router.include_router(hosts_router)
api_router.include_router(meetings_router)
api_router.include_router(worker_router)
app.include_router(api_router)
app.include_router(public_meetings_router)
app.include_router(websocket_router)


@app.middleware("http")
async def request_logging_middleware(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    if request.url.path == "/health":
        return await call_next(request)

    started_at = time.perf_counter()
    client_ip = _client_ip(request)
    try:
        response = await call_next(request)
    except Exception:
        elapsed_ms = (time.perf_counter() - started_at) * 1000
        logger.exception(
            "HTTP %s %s -> 500 in %.2fms ip=%s",
            request.method,
            request.url.path,
            elapsed_ms,
            client_ip,
        )
        raise

    elapsed_ms = (time.perf_counter() - started_at) * 1000
    if response.status_code >= 500:
        log_level = logging.ERROR
    elif response.status_code >= 400:
        log_level = logging.WARNING
    else:
        log_level = logging.INFO
    logger.log(
        log_level,
        "HTTP %s %s -> %s in %.2fms ip=%s",
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
        client_ip,
    )
    return response


@app.get("/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "healthy", "version": settings.app_version}


def _client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        candidate = forwarded_for.split(",", 1)[0].strip()
        if candidate:
            return candidate
    client = request.client
    if client and client.host:
        return client.host
    return "unknown"
