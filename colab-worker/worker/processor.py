from __future__ import annotations
# pyright: reportMissingImports=false, reportExplicitAny=false, reportAny=false, reportUnannotatedClassAttribute=false, reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false, reportUnknownParameterType=false, reportUnusedCallResult=false

from io import BytesIO
import logging
import tempfile
import time
from typing import Any, Callable

import numpy as np
import soundfile as sf
import torch
import torchaudio

from worker.config import WorkerConfig
from worker.models.whisper_loader import WhisperLoader

logger = logging.getLogger(__name__)

ProgressCallback = Callable[[int], None]

AudioWindow = dict[str, Any]


class AudioProcessor:
    def __init__(self, config: WorkerConfig):
        self.config = config
        self.model = WhisperLoader.load(config)
        self.vad = self._load_vad() if config.vad_enabled else None

    def process(
        self,
        audio_data: bytes,
        source_language: str,
        progress_callback: ProgressCallback | None = None,
    ) -> list[dict[str, Any]]:
        started_at = time.perf_counter()
        waveform, sample_rate = self._decode_audio(audio_data)
        audio_duration_seconds = len(waveform) / sample_rate if sample_rate else 0.0
        progress_callback = progress_callback or (lambda _progress: None)
        progress_callback(5)

        audio_windows = self._prepare_audio_windows(waveform, sample_rate)
        progress_callback(20)

        chunk_duration_ms = max(int(audio_duration_seconds * 1000), 1)
        results: list[dict[str, Any]] = []

        for index, window in enumerate(audio_windows, start=1):
            segment_results = self._transcribe_segment(
                window["audio"],
                sample_rate=sample_rate,
                source_language=source_language,
                start_offset_ms=window["start_offset_ms"],
            )
            results.extend(segment_results)
            progress = 20 + int((index / len(audio_windows)) * 75)
            progress_callback(min(progress, 95))

        if not results and audio_duration_seconds > 0:
            results.append(
                {
                    "text": "",
                    "start_offset_ms": 0,
                    "end_offset_ms": chunk_duration_ms,
                    "confidence": 0.0,
                }
            )

        elapsed = time.perf_counter() - started_at
        logger.info(
            "Processed %.2fs audio into %d segment(s) in %.2fs",
            audio_duration_seconds,
            len(results),
            elapsed,
        )
        progress_callback(100)
        return results

    def _decode_audio(self, audio_data: bytes) -> tuple[np.ndarray, int]:
        try:
            waveform, sample_rate = sf.read(BytesIO(audio_data), dtype="float32")
        except RuntimeError:
            with tempfile.NamedTemporaryFile(suffix=".webm") as temporary_file:
                temporary_file.write(audio_data)
                temporary_file.flush()
                tensor, sample_rate = torchaudio.load(temporary_file.name)
                waveform = tensor.numpy().T

        waveform_array = np.asarray(waveform, dtype=np.float32)
        if waveform_array.ndim == 2:
            waveform_array = waveform_array.mean(axis=1)
        return waveform_array, int(sample_rate)

    def _prepare_audio_windows(
        self, waveform: np.ndarray, sample_rate: int
    ) -> list[AudioWindow]:
        if self.vad is None:
            return [{"audio": waveform, "start_offset_ms": 0}]

        timestamps = self._detect_speech_segments(waveform, sample_rate)
        if not timestamps:
            return [{"audio": waveform, "start_offset_ms": 0}]

        return [
            {
                "audio": waveform[int(item["start"]) : int(item["end"])],
                "start_offset_ms": int((int(item["start"]) / sample_rate) * 1000),
            }
            for item in timestamps
            if int(item["end"]) > int(item["start"])
        ] or [{"audio": waveform, "start_offset_ms": 0}]

    def _transcribe_segment(
        self,
        audio: np.ndarray,
        *,
        sample_rate: int,
        source_language: str,
        start_offset_ms: int,
    ) -> list[dict[str, Any]]:
        if sample_rate != 16000:
            audio = torchaudio.functional.resample(
                torch.from_numpy(audio),
                orig_freq=sample_rate,
                new_freq=16000,
            ).numpy()

        segments, _info = self.model.transcribe(
            audio,
            language=source_language,
            vad_filter=False,
            beam_size=1,
            condition_on_previous_text=False,
        )

        results: list[dict[str, Any]] = []
        for segment in segments:
            results.append(
                {
                    "text": segment.text.strip(),
                    "start_offset_ms": start_offset_ms + int(segment.start * 1000),
                    "end_offset_ms": start_offset_ms + int(segment.end * 1000),
                    "confidence": self._segment_confidence(segment),
                }
            )
        return results

    def _detect_speech_segments(
        self,
        waveform: np.ndarray,
        sample_rate: int,
    ) -> list[dict[str, int]]:
        assert self.vad is not None
        vad_model = self.vad["model"]
        get_speech_timestamps = self.vad["get_speech_timestamps"]

        audio_tensor = torch.from_numpy(waveform)
        resample_ratio = 1.0
        if sample_rate != 16000:
            audio_tensor = torchaudio.functional.resample(
                audio_tensor,
                orig_freq=sample_rate,
                new_freq=16000,
            )
            resample_ratio = sample_rate / 16000
            sample_rate = 16000

        timestamps = list(
            get_speech_timestamps(
                audio_tensor,
                vad_model,
                sampling_rate=sample_rate,
                threshold=self.config.vad_threshold,
            )
        )
        if resample_ratio == 1.0:
            return timestamps

        return [
            {
                "start": int(item["start"] * resample_ratio),
                "end": int(item["end"] * resample_ratio),
            }
            for item in timestamps
        ]

    def _load_vad(self) -> dict[str, Any]:
        model, utils = torch.hub.load("snakers4/silero-vad", "silero_vad")
        get_speech_timestamps = utils[0]
        return {"model": model, "get_speech_timestamps": get_speech_timestamps}

    def _segment_confidence(self, segment: Any) -> float:
        if getattr(segment, "avg_logprob", None) is None:
            return 0.0
        confidence = float(np.exp(segment.avg_logprob))
        return max(0.0, min(confidence, 1.0))
