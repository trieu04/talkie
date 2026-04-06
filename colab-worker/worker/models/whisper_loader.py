from __future__ import annotations
# pyright: reportMissingImports=false, reportUnknownVariableType=false, reportUnknownParameterType=false, reportUnknownMemberType=false

from faster_whisper import WhisperModel

from worker.config import WorkerConfig


class WhisperLoader:
    _instance: WhisperModel | None = None

    @classmethod
    def load(cls, config: WorkerConfig) -> WhisperModel:
        if cls._instance is None:
            cls._instance = WhisperModel(
                config.whisper_model,
                device=config.whisper_device,
                compute_type=config.whisper_compute_type,
            )
        return cls._instance
