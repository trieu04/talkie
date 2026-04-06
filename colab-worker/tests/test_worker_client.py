from __future__ import annotations

from unittest.mock import MagicMock

from worker.client import Job, TalkieClient
from worker.config import WorkerConfig


def make_client() -> TalkieClient:
    config = WorkerConfig(server_url="http://localhost:8000", worker_id="worker-1")
    client = TalkieClient(config)
    client.client = MagicMock()
    return client


def test_job_from_payload_uses_defaults() -> None:
    job = Job.from_payload(
        {
            "chunk_id": "chunk-1",
            "meeting_id": "meeting-1",
            "sequence": 2,
            "audio_url": "https://example.com/audio.opus",
        }
    )
    assert job.source_language == "vi"
    assert job.timeout_seconds == 30


def test_poll_jobs_parses_response() -> None:
    client = make_client()
    response = MagicMock()
    response.json.return_value = {
        "jobs": [
            {
                "chunk_id": "chunk-1",
                "meeting_id": "meeting-1",
                "sequence": 0,
                "audio_url": "https://example.com/audio.opus",
                "source_language": "en",
                "timeout_seconds": 45,
            }
        ]
    }
    response.raise_for_status.return_value = None
    client.client.get.return_value = response

    jobs = client.poll_jobs()

    assert len(jobs) == 1
    assert jobs[0].source_language == "en"
    assert jobs[0].timeout_seconds == 45


def test_claim_job_returns_false_for_conflict() -> None:
    client = make_client()
    response = MagicMock(status_code=409)
    client.client.post.return_value = response

    assert client.claim_job("chunk-1") is False
