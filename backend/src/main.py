from __future__ import annotations
# pyright: reportMissingImports=false, reportUnknownVariableType=false, reportUnknownArgumentType=false

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.auth import router as auth_router
from src.api.meetings import router as meetings_router
from src.api.websocket import router as websocket_router
from src.core.config import settings
from src.core.exceptions import install_exception_handlers
from src.core.redis import redis_manager
from src.core.storage import storage


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    redis_ready = await redis_manager.ping()
    if not redis_ready:
        raise RuntimeError(f"{app.title} startup failed because Redis is unavailable")
    await storage.ensure_bucket()
    yield
    await redis_manager.close()


app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
install_exception_handlers(app)

api_router = APIRouter(prefix=settings.api_v1_prefix)
api_router.include_router(auth_router)
api_router.include_router(meetings_router)
app.include_router(api_router)
app.include_router(websocket_router)


@app.get("/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "healthy", "version": settings.app_version}
