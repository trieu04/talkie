from __future__ import annotations

import asyncio
import logging

from src.core.config import settings
from src.core.database import AsyncSessionFactory
from src.core.storage import storage
from src.services.worker_service import WorkerService

logger = logging.getLogger(__name__)


async def run_chunk_monitor(stop_event: asyncio.Event, interval_seconds: int = 10) -> None:
    while not stop_event.is_set():
        async with AsyncSessionFactory() as session:
            reassigned_count = await WorkerService(session, storage).reassign_timed_out_chunks(
                timeout_seconds=settings.worker_timeout_seconds
            )
            logger.info("Chunk monitor reassigned %s timed out chunks", reassigned_count)

        try:
            _ = await asyncio.wait_for(stop_event.wait(), timeout=interval_seconds)
        except TimeoutError:
            continue
