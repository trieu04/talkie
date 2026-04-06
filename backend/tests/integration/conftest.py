from __future__ import annotations

import re
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from fastapi.testclient import TestClient
from sqlalchemy import JSON, Column, MetaData, Table, event, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from src.core.database import Base, get_async_session
from src.models import Host


def _build_sqlite_metadata():
    sqlite_meta = MetaData()
    for orig_table in Base.metadata.sorted_tables:
        new_columns = []
        for col in orig_table.columns:
            col_type = col.type
            col_type_name = col_type.__class__.__name__
            if col_type_name == "JSONB":
                col_type = JSON()

            server_default = col.server_default
            if server_default is not None and hasattr(server_default, "arg"):
                try:
                    default_str = str(server_default.arg)
                    if "::jsonb" in default_str:
                        match = re.match(r"'(.*)'::", default_str)
                        if match:
                            server_default = text(f"'{match.group(1)}'")
                except Exception:
                    pass

            new_col = Column(
                col.name,
                col_type,
                primary_key=col.primary_key,
                nullable=col.nullable,
                server_default=server_default,
                index=col.index,
                unique=col.unique,
            )
            new_columns.append(new_col)

        fk_constraints = []
        for fk in orig_table.foreign_keys:
            from sqlalchemy import ForeignKeyConstraint

            fk_constraints.append(
                ForeignKeyConstraint(
                    [fk.parent.name],
                    [fk.target_fullname],
                    ondelete=fk.ondelete,
                )
            )

        Table(orig_table.name, sqlite_meta, *new_columns, *fk_constraints)

    return sqlite_meta


_SQLITE_METADATA = None


def _get_sqlite_metadata():
    global _SQLITE_METADATA
    if _SQLITE_METADATA is None:
        _SQLITE_METADATA = _build_sqlite_metadata()
    return _SQLITE_METADATA


@pytest.fixture
async def integration_engine():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )

    @event.listens_for(engine.sync_engine, "connect")
    def register_functions(dbapi_conn, connection_record):
        dbapi_conn.create_function("to_tsvector", 2, lambda *args: "")
        dbapi_conn.create_function("ts_rank", 2, lambda *args: 0.0)
        dbapi_conn.create_function("to_tsquery", 2, lambda *args: "")

    sqlite_meta = _get_sqlite_metadata()
    async with engine.begin() as conn:
        await conn.run_sync(sqlite_meta.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(sqlite_meta.drop_all)
    await engine.dispose()


@pytest.fixture
async def integration_db_session(integration_engine):
    async_session_factory = async_sessionmaker(
        bind=integration_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )
    async with async_session_factory() as session:
        yield session
        await session.rollback()


@pytest.fixture
def mock_redis_for_integration():
    redis = AsyncMock()
    redis.publish = AsyncMock(return_value=1)
    redis.subscribe = AsyncMock()
    redis.unsubscribe = AsyncMock()
    redis.sadd = AsyncMock(return_value=1)
    redis.srem = AsyncMock(return_value=1)
    redis.scard = AsyncMock(return_value=0)
    redis.get = AsyncMock(return_value=None)
    redis.set = AsyncMock(return_value=True)
    redis.delete = AsyncMock(return_value=1)
    redis.ping = AsyncMock(return_value=True)
    redis.aclose = AsyncMock()
    pubsub = AsyncMock()
    pubsub.subscribe = AsyncMock()
    pubsub.unsubscribe = AsyncMock()
    pubsub.get_message = AsyncMock(return_value=None)
    redis.pubsub = MagicMock(return_value=pubsub)
    return redis


@pytest.fixture
def mock_redis_manager_for_integration(mock_redis_for_integration):
    manager = MagicMock()
    manager.client = mock_redis_for_integration
    manager.ping = AsyncMock(return_value=True)
    manager.close = AsyncMock()
    return manager


@pytest.fixture
def mock_storage_for_integration():
    storage = AsyncMock()
    storage.ensure_bucket = AsyncMock()
    storage.upload_bytes = AsyncMock()
    storage.download_bytes = AsyncMock(return_value=b"mock audio data")
    storage.get_presigned_url = AsyncMock(return_value="https://minio.local/test-bucket/test.opus")
    storage.bucket_name = "test-bucket"
    return storage


@pytest.fixture
async def integration_client(
    integration_db_session,
    mock_redis_manager_for_integration,
    mock_storage_for_integration,
):
    with (
        patch("src.core.redis.redis_manager", mock_redis_manager_for_integration),
        patch("src.core.storage.storage", mock_storage_for_integration),
        patch("src.api.meetings.redis_manager", mock_redis_manager_for_integration),
        patch("src.api.meetings.storage", mock_storage_for_integration),
        patch("src.api.worker.storage", mock_storage_for_integration),
        patch("src.services.worker_service.redis_manager", mock_redis_manager_for_integration),
        patch("src.workers.chunk_monitor.run_chunk_monitor", new_callable=AsyncMock),
    ):
        from src.main import app

        for middleware in app.user_middleware:
            if hasattr(middleware, "cls") and middleware.cls.__name__ == "RateLimitMiddleware":
                break

        async def override_session():
            yield integration_db_session

        app.dependency_overrides[get_async_session] = override_session

        app.middleware_stack = None
        original_middleware = app.user_middleware[:]
        app.user_middleware = [
            m
            for m in app.user_middleware
            if not (hasattr(m, "cls") and m.cls.__name__ == "RateLimitMiddleware")
        ]

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c

        app.user_middleware = original_middleware
        app.middleware_stack = None
        app.dependency_overrides.clear()


@pytest.fixture
def integration_sync_client(
    integration_db_session,
    mock_redis_manager_for_integration,
    mock_storage_for_integration,
):
    with (
        patch("src.core.redis.redis_manager", mock_redis_manager_for_integration),
        patch("src.core.storage.storage", mock_storage_for_integration),
        patch("src.api.meetings.redis_manager", mock_redis_manager_for_integration),
        patch("src.api.meetings.storage", mock_storage_for_integration),
        patch("src.api.websocket.redis_manager", mock_redis_manager_for_integration),
        patch("src.api.websocket.storage", mock_storage_for_integration),
        patch("src.api.worker.storage", mock_storage_for_integration),
        patch("src.services.worker_service.redis_manager", mock_redis_manager_for_integration),
        patch("src.core.websocket_manager.redis_manager", mock_redis_manager_for_integration),
        patch("src.workers.chunk_monitor.run_chunk_monitor", new_callable=AsyncMock),
    ):
        from src.main import app

        async def override_session():
            yield integration_db_session

        app.dependency_overrides[get_async_session] = override_session
        app.middleware_stack = None
        original_middleware = app.user_middleware[:]
        app.user_middleware = [
            m
            for m in app.user_middleware
            if not (hasattr(m, "cls") and m.cls.__name__ == "RateLimitMiddleware")
        ]

        with TestClient(app) as client:
            yield client

        app.user_middleware = original_middleware
        app.middleware_stack = None
        app.dependency_overrides.clear()
