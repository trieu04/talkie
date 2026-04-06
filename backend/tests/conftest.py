from __future__ import annotations

import uuid
from collections.abc import AsyncIterator, Callable
from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from src.core.auth import build_token_pair, hash_password
from src.core.config import Settings
from src.core.database import Base
from src.models import (
    AudioChunk,
    AudioChunkStatus,
    Host,
    Meeting,
    MeetingStatus,
    MeetingSummary,
    SegmentTranslation,
    TranscriptSegment,
)


@pytest.fixture
def test_settings() -> Settings:
    return Settings(
        database_url="postgresql+asyncpg://test:test@localhost:5432/test",
        redis_url="redis://localhost:6379/0",
        minio_endpoint="localhost:9000",
        minio_access_key="minioadmin",
        minio_secret_key="minioadmin",
        minio_bucket_name="test-bucket",
        minio_secure=False,
        jwt_secret="test-secret-key-minimum-32-characters-long",
        jwt_algorithm="HS256",
        jwt_access_expire_minutes=60,
        jwt_refresh_expire_days=7,
        worker_timeout_seconds=30,
        worker_max_retries=3,
        openai_api_key=None,
        google_translate_api_key=None,
        google_translate_project_id=None,
        allow_startup_without_infra=True,
        environment="test",
        debug=True,
    )


@pytest.fixture
async def async_engine():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )

    # SQLite lacks PostgreSQL's to_tsvector/ts_rank/to_tsquery full-text search functions
    @event.listens_for(engine.sync_engine, "connect")
    def register_functions(dbapi_conn, connection_record):
        dbapi_conn.create_function("to_tsvector", 2, lambda *args: "")
        dbapi_conn.create_function("ts_rank", 2, lambda *args: 0.0)
        dbapi_conn.create_function("to_tsquery", 2, lambda *args: "")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest.fixture
async def db_session(async_engine) -> AsyncIterator[AsyncSession]:
    async_session_factory = async_sessionmaker(
        bind=async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )

    async with async_session_factory() as session:
        yield session
        await session.rollback()


@pytest.fixture
def mock_db_session() -> AsyncMock:
    session = AsyncMock(spec=AsyncSession)
    session.execute = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.refresh = AsyncMock()
    session.flush = AsyncMock()
    session.get = AsyncMock()
    session.add = MagicMock()
    session.delete = AsyncMock()
    session.close = AsyncMock()

    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=None)
    mock_result.scalar_one = MagicMock(return_value=0)
    mock_result.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))
    mock_result.all = MagicMock(return_value=[])
    session.execute.return_value = mock_result

    return session


@pytest.fixture
def mock_redis() -> AsyncMock:
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
def mock_redis_manager(mock_redis) -> MagicMock:
    manager = MagicMock()
    manager.client = mock_redis
    manager.ping = AsyncMock(return_value=True)
    manager.close = AsyncMock()
    return manager


@pytest.fixture
def mock_storage() -> AsyncMock:
    storage = AsyncMock()
    storage.ensure_bucket = AsyncMock()
    storage.upload_bytes = AsyncMock()
    storage.download_bytes = AsyncMock(return_value=b"mock audio data")
    storage.get_presigned_url = AsyncMock(return_value="https://minio.local/test-bucket/test.opus")
    storage.bucket_name = "test-bucket"
    return storage


@pytest.fixture
def host_factory(db_session: AsyncSession) -> Callable[..., Host]:
    created_hosts: list[Host] = []

    def _create(
        email: str | None = None,
        password: str = "TestPass123",
        display_name: str = "Test User",
    ) -> Host:
        host = Host(
            id=uuid.uuid4(),
            email=email or f"test-{uuid.uuid4().hex[:8]}@example.com",
            password_hash=hash_password(password),
            display_name=display_name,
        )
        created_hosts.append(host)
        return host

    return _create


@pytest.fixture
def meeting_factory() -> Callable[..., Meeting]:
    def _create(
        host_id: UUID | None = None,
        title: str | None = "Test Meeting",
        room_code: str | None = None,
        status: MeetingStatus = MeetingStatus.CREATED,
        source_language: str = "vi",
        started_at: datetime | None = None,
        ended_at: datetime | None = None,
    ) -> Meeting:
        return Meeting(
            id=uuid.uuid4(),
            host_id=host_id or uuid.uuid4(),
            title=title,
            room_code=room_code or f"{uuid.uuid4().hex[:6].upper()}",
            status=status,
            source_language=source_language,
            started_at=started_at,
            ended_at=ended_at,
        )

    return _create


@pytest.fixture
def audio_chunk_factory() -> Callable[..., AudioChunk]:
    def _create(
        meeting_id: UUID | None = None,
        sequence: int = 0,
        storage_key: str | None = None,
        duration_ms: int = 5000,
        status: AudioChunkStatus = AudioChunkStatus.PENDING,
        worker_id: str | None = None,
        assigned_at: datetime | None = None,
        retry_count: int = 0,
    ) -> AudioChunk:
        meeting_id = meeting_id or uuid.uuid4()
        return AudioChunk(
            id=uuid.uuid4(),
            meeting_id=meeting_id,
            sequence=sequence,
            storage_key=storage_key or f"meetings/{meeting_id}/audio/{sequence}.opus",
            duration_ms=duration_ms,
            status=status,
            worker_id=worker_id,
            assigned_at=assigned_at,
            retry_count=retry_count,
        )

    return _create


@pytest.fixture
def transcript_segment_factory() -> Callable[..., TranscriptSegment]:
    def _create(
        meeting_id: UUID | None = None,
        audio_chunk_id: UUID | None = None,
        sequence: int = 1,
        text: str = "Test transcript text",
        start_time_ms: int = 0,
        end_time_ms: int = 5000,
        confidence: float | None = 0.95,
        is_partial: bool = False,
    ) -> TranscriptSegment:
        return TranscriptSegment(
            id=uuid.uuid4(),
            meeting_id=meeting_id or uuid.uuid4(),
            audio_chunk_id=audio_chunk_id,
            sequence=sequence,
            text=text,
            start_time_ms=start_time_ms,
            end_time_ms=end_time_ms,
            confidence=confidence,
            is_partial=is_partial,
        )

    return _create


@pytest.fixture
def segment_translation_factory() -> Callable[..., SegmentTranslation]:
    def _create(
        segment_id: UUID | None = None,
        target_language: str = "en",
        translated_text: str = "Translated text",
        provider: str = "mock-google-translate",
    ) -> SegmentTranslation:
        return SegmentTranslation(
            id=uuid.uuid4(),
            segment_id=segment_id or uuid.uuid4(),
            target_language=target_language,
            translated_text=translated_text,
            provider=provider,
        )

    return _create


@pytest.fixture
def meeting_summary_factory() -> Callable[..., MeetingSummary]:
    def _create(
        meeting_id: UUID | None = None,
        content: str = "Meeting summary content",
        key_points: list[str] | None = None,
        decisions: list[dict[str, str]] | None = None,
        action_items: list[dict[str, str | None]] | None = None,
        provider: str = "mock-openai",
    ) -> MeetingSummary:
        return MeetingSummary(
            id=uuid.uuid4(),
            meeting_id=meeting_id or uuid.uuid4(),
            content=content,
            key_points=key_points or ["Point 1", "Point 2"],
            decisions=decisions or [{"decision": "Decision 1", "context": "Context 1"}],
            action_items=action_items or [{"task": "Task 1", "assignee": "John", "deadline": None}],
            transcript_snapshot_at=datetime.now(UTC),
            provider=provider,
        )

    return _create


@pytest.fixture
def test_host() -> Host:
    return Host(
        id=uuid.uuid4(),
        email="test@example.com",
        password_hash=hash_password("TestPass123"),
        display_name="Test User",
    )


@pytest.fixture
def test_tokens(test_host: Host) -> dict[str, Any]:
    return build_token_pair(str(test_host.id))


@pytest.fixture
def auth_headers(test_tokens: dict[str, Any]) -> dict[str, str]:
    return {"Authorization": f"Bearer {test_tokens['access_token']}"}


@pytest.fixture
def app(test_settings, mock_db_session, mock_redis_manager, mock_storage) -> FastAPI:
    from src.main import app as main_app

    return main_app


@pytest.fixture
async def async_client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
def sync_client(app: FastAPI) -> TestClient:
    return TestClient(app)


@pytest.fixture
def mock_websocket() -> AsyncMock:
    ws = AsyncMock()
    ws.accept = AsyncMock()
    ws.send_json = AsyncMock()
    ws.receive_json = AsyncMock(return_value={})
    ws.receive_text = AsyncMock(return_value="{}")
    ws.receive_bytes = AsyncMock(return_value=b"")
    ws.close = AsyncMock()
    ws.client_state = MagicMock()
    ws.application_state = MagicMock()
    return ws


@pytest.fixture
def frozen_time() -> datetime:
    return datetime(2024, 1, 15, 12, 0, 0, tzinfo=UTC)


@pytest.fixture
def mock_datetime(frozen_time: datetime):
    with patch("src.core.auth.datetime") as mock_dt:
        mock_dt.now.return_value = frozen_time
        mock_dt.side_effect = lambda *args, **kwargs: datetime(*args, **kwargs)
        yield mock_dt


@pytest.fixture
def sample_audio_data() -> bytes:
    return b"\x00" * 1024


@pytest.fixture
def sample_transcript_segments(
    transcript_segment_factory,
) -> Callable[[UUID, int], list[TranscriptSegment]]:
    def _create(meeting_id: UUID, count: int = 5) -> list[TranscriptSegment]:
        segments = []
        for i in range(count):
            segment = transcript_segment_factory(
                meeting_id=meeting_id,
                sequence=i + 1,
                text=f"Segment {i + 1} text content",
                start_time_ms=i * 5000,
                end_time_ms=(i + 1) * 5000,
            )
            segments.append(segment)
        return segments

    return _create


@pytest.fixture
def meeting_service(mock_db_session):
    from src.services.meeting_service import MeetingService

    return MeetingService(mock_db_session)


@pytest.fixture
def audio_chunk_service(mock_db_session, mock_storage):
    from src.services.audio_chunk_service import AudioChunkService

    return AudioChunkService(mock_db_session, mock_storage)


@pytest.fixture
def transcript_service(mock_db_session, mock_redis):
    from src.services.transcript_service import TranscriptService

    return TranscriptService(mock_db_session, mock_redis)


@pytest.fixture
def translation_service(mock_db_session, mock_redis):
    from src.services.translation_service import TranslationService

    return TranslationService(mock_db_session, mock_redis)


@pytest.fixture
def summary_service(mock_db_session):
    from src.services.summary_service import SummaryService

    return SummaryService(mock_db_session)


@pytest.fixture
def worker_service(mock_db_session, mock_storage):
    from src.services.worker_service import WorkerService

    return WorkerService(mock_db_session, mock_storage)


@pytest.fixture(autouse=True)
async def cleanup():
    yield


def pytest_configure(config):
    config.addinivalue_line(
        "markers", "slow: marks tests as slow (deselect with '-m \"not slow\"')"
    )
    config.addinivalue_line(
        "markers", "integration: marks tests as integration tests requiring real services"
    )
    config.addinivalue_line("markers", "unit: marks tests as unit tests")
