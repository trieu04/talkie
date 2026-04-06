from __future__ import annotations

import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.core.config import settings


@pytest.fixture
async def pg_engine():
    test_engine = create_async_engine(
        settings.database_url,
        echo=False,
        pool_pre_ping=True,
    )
    yield test_engine
    await test_engine.dispose()


@pytest.fixture
async def pg_session(pg_engine):
    factory = async_sessionmaker(
        bind=pg_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )
    async with factory() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def cleanup_host(pg_session: AsyncSession):
    created_ids: list[uuid.UUID] = []
    yield created_ids
    for host_id in reversed(created_ids):
        await pg_session.execute(text("DELETE FROM hosts WHERE id = :id"), {"id": str(host_id)})
    await pg_session.commit()


@pytest.fixture
async def cleanup_meeting(pg_session: AsyncSession):
    created_ids: list[uuid.UUID] = []
    yield created_ids
    for meeting_id in reversed(created_ids):
        await pg_session.execute(
            text("DELETE FROM meetings WHERE id = :id"), {"id": str(meeting_id)}
        )
    await pg_session.commit()
