from __future__ import annotations

import os
from unittest.mock import patch

from worker.config import WorkerConfig


class TestDefaultValues:
    def test_default_threshold_values(self) -> None:
        config = WorkerConfig()

        assert config.no_speech_threshold == 0.5
        assert config.log_prob_threshold == -0.5
        assert config.compression_ratio_threshold == 2.0
        assert config.min_confidence_threshold == 0.10

    def test_default_vad_settings(self) -> None:
        config = WorkerConfig()

        assert config.vad_enabled is True
        assert config.vad_threshold == 0.5


class TestCustomValues:
    def test_custom_threshold_values(self) -> None:
        config = WorkerConfig(
            no_speech_threshold=0.8,
            log_prob_threshold=-0.3,
            compression_ratio_threshold=3.0,
            min_confidence_threshold=0.25,
        )

        assert config.no_speech_threshold == 0.8
        assert config.log_prob_threshold == -0.3
        assert config.compression_ratio_threshold == 3.0
        assert config.min_confidence_threshold == 0.25


class TestEnvVarOverrides:
    def test_threshold_env_var_overrides(self) -> None:
        env = {
            "NO_SPEECH_THRESHOLD": "0.85",
            "LOG_PROB_THRESHOLD": "-0.2",
            "COMPRESSION_RATIO_THRESHOLD": "1.5",
            "MIN_CONFIDENCE_THRESHOLD": "0.30",
            "VAD_THRESHOLD": "0.6",
        }
        with patch.dict(os.environ, env, clear=False):
            config = WorkerConfig()

        assert config.no_speech_threshold == 0.85
        assert config.log_prob_threshold == -0.2
        assert config.compression_ratio_threshold == 1.5
        assert config.min_confidence_threshold == 0.30
        assert config.vad_threshold == 0.6


class TestApiUrl:
    def test_api_url_construction(self) -> None:
        config = WorkerConfig(server_url="http://localhost:8000", api_prefix="/api/v1")

        assert (
            config.api_url("/workers/poll")
            == "http://localhost:8000/api/v1/workers/poll"
        )
        assert (
            config.api_url("workers/poll")
            == "http://localhost:8000/api/v1/workers/poll"
        )

    def test_api_url_strips_trailing_slashes(self) -> None:
        config = WorkerConfig(
            server_url="http://localhost:8000/", api_prefix="/api/v1/"
        )

        assert config.api_url("/test") == "http://localhost:8000/api/v1/test"

    def test_api_url_with_different_prefix(self) -> None:
        config = WorkerConfig(server_url="https://api.example.com", api_prefix="/v2")

        assert config.api_url("/health") == "https://api.example.com/v2/health"
