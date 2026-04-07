from __future__ import annotations

from dataclasses import dataclass, field
import os


def _float_env(key: str, default: float) -> float:
    value = os.getenv(key)
    return float(value) if value else default


@dataclass(slots=True)
class WorkerConfig:
    server_url: str = field(
        default_factory=lambda: os.getenv("TALKIE_SERVER_URL", "http://localhost:8000")
    )
    api_prefix: str = "/api/v1"

    worker_id: str = field(
        default_factory=lambda: os.getenv("WORKER_ID", f"colab-{os.urandom(4).hex()}")
    )

    poll_interval_seconds: float = 1.0
    poll_backoff_max_seconds: float = 30.0
    heartbeat_interval_seconds: float = 10.0
    request_timeout_seconds: float = 60.0

    whisper_model: str = "large-v3-turbo"
    whisper_compute_type: str = "float16"
    whisper_device: str = "cuda"

    vad_enabled: bool = True
    vad_threshold: float = field(
        default_factory=lambda: _float_env("VAD_THRESHOLD", 0.5)
    )

    no_speech_threshold: float = field(
        default_factory=lambda: _float_env("NO_SPEECH_THRESHOLD", 0.5)
    )
    log_prob_threshold: float = field(
        default_factory=lambda: _float_env("LOG_PROB_THRESHOLD", -0.5)
    )
    compression_ratio_threshold: float = field(
        default_factory=lambda: _float_env("COMPRESSION_RATIO_THRESHOLD", 2.0)
    )
    min_confidence_threshold: float = field(
        default_factory=lambda: _float_env("MIN_CONFIDENCE_THRESHOLD", 0.10)
    )

    def api_url(self, path: str) -> str:
        base = self.server_url.rstrip("/")
        prefix = self.api_prefix.strip("/")
        suffix = path if path.startswith("/") else f"/{path}"
        return f"{base}/{prefix}{suffix}"
