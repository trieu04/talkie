from __future__ import annotations
# pyright: reportMissingImports=false, reportExplicitAny=false, reportAny=false, reportUnannotatedClassAttribute=false, reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false

from dataclasses import dataclass
import logging
from typing import Any

import httpx

from worker.config import WorkerConfig

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class Job:
    chunk_id: str
    meeting_id: str
    sequence: int
    audio_url: str
    source_language: str
    timeout_seconds: int = 30

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> "Job":
        return cls(
            chunk_id=str(payload["chunk_id"]),
            meeting_id=str(payload["meeting_id"]),
            sequence=int(payload["sequence"]),
            audio_url=str(payload["audio_url"]),
            source_language=str(payload.get("source_language") or "vi"),
            timeout_seconds=int(payload.get("timeout_seconds") or 30),
        )


class TalkieClient:
    def __init__(self, config: WorkerConfig):
        self.config = config
        self.client = httpx.Client(
            base_url=config.api_url("/"),
            timeout=httpx.Timeout(config.request_timeout_seconds),
            headers={"User-Agent": f"talkie-colab-worker/{config.worker_id}"},
        )

    def poll_jobs(self, limit: int = 1) -> list[Job]:
        response = self.client.get(
            "/worker/jobs",
            params={"worker_id": self.config.worker_id, "limit": limit},
        )
        response.raise_for_status()
        payload = response.json()
        return [Job.from_payload(item) for item in payload.get("jobs", [])]

    def claim_job(self, chunk_id: str) -> bool:
        response = self.client.post(
            f"/worker/jobs/{chunk_id}/claim",
            json={"worker_id": self.config.worker_id},
        )
        if response.status_code == httpx.codes.CONFLICT:
            logger.info("Chunk %s already claimed by another worker", chunk_id)
            return False
        response.raise_for_status()
        return True

    def download_audio(self, audio_url: str) -> bytes:
        response = self.client.get(audio_url)
        response.raise_for_status()
        return response.content

    def submit_result(self, chunk_id: str, segments: list[dict[str, Any]]) -> bool:
        response = self.client.post(
            f"/worker/jobs/{chunk_id}/result",
            json={"worker_id": self.config.worker_id, "segments": segments},
        )
        response.raise_for_status()
        return True

    def heartbeat(self, chunk_id: str, progress: int) -> bool:
        response = self.client.post(
            f"/worker/jobs/{chunk_id}/heartbeat",
            json={"worker_id": self.config.worker_id, "progress_percent": progress},
        )
        if response.is_error:
            logger.warning(
                "Heartbeat failed for chunk %s with status %s",
                chunk_id,
                response.status_code,
            )
            return False
        return True

    def close(self) -> None:
        self.client.close()
