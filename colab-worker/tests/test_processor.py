from __future__ import annotations

import math
from unittest.mock import MagicMock, patch

import numpy as np

from worker.config import WorkerConfig


def make_segment(
    text: str = " Hello ",
    start: float = 0.0,
    end: float = 1.0,
    avg_logprob: float | None = -0.3,
) -> MagicMock:
    seg = MagicMock()
    seg.text = text
    seg.start = start
    seg.end = end
    seg.avg_logprob = avg_logprob
    return seg


def _vad_returns(timestamps: list | None = None) -> tuple[MagicMock, list]:
    mock_vad_model = MagicMock()
    mock_get_timestamps = MagicMock(return_value=timestamps or [])
    return mock_vad_model, [mock_get_timestamps, None, None, None, None]


def _audio_1s_16k() -> tuple[np.ndarray, int]:
    return np.zeros(16000, dtype=np.float32), 16000


class TestAudioProcessorProcess:
    @patch("worker.processor.sf.read")
    @patch("worker.processor.torch.hub.load")
    @patch("worker.processor.WhisperLoader.load")
    def test_process_returns_segments_for_speech(
        self,
        mock_whisper_load: MagicMock,
        mock_vad_load: MagicMock,
        mock_sf_read: MagicMock,
    ) -> None:
        mock_model = MagicMock()
        mock_whisper_load.return_value = mock_model
        mock_vad_load.return_value = _vad_returns([{"start": 0, "end": 16000}])
        mock_sf_read.return_value = _audio_1s_16k()

        segments = [
            make_segment(text=" Hello world ", start=0.0, end=1.0, avg_logprob=-0.2)
        ]
        mock_model.transcribe.return_value = (iter(segments), MagicMock())

        from worker.processor import AudioProcessor

        config = WorkerConfig(vad_enabled=True)
        processor = AudioProcessor(config)
        results = processor.process(b"fake_audio_data", source_language="en")

        assert len(results) == 1
        assert results[0]["text"] == "Hello world"
        assert "start_offset_ms" in results[0]
        assert "end_offset_ms" in results[0]
        assert "confidence" in results[0]
        assert results[0]["confidence"] > 0

    @patch("worker.processor.sf.read")
    @patch("worker.processor.torch.hub.load")
    @patch("worker.processor.WhisperLoader.load")
    def test_process_returns_empty_when_vad_detects_no_speech(
        self,
        mock_whisper_load: MagicMock,
        mock_vad_load: MagicMock,
        mock_sf_read: MagicMock,
    ) -> None:
        mock_model = MagicMock()
        mock_whisper_load.return_value = mock_model
        mock_vad_load.return_value = _vad_returns([])
        mock_sf_read.return_value = _audio_1s_16k()

        from worker.processor import AudioProcessor

        config = WorkerConfig(vad_enabled=True)
        processor = AudioProcessor(config)
        results = processor.process(b"fake_audio_data", source_language="en")

        assert results == []
        mock_model.transcribe.assert_not_called()

    @patch("worker.processor.sf.read")
    @patch("worker.processor.torch.hub.load")
    @patch("worker.processor.WhisperLoader.load")
    def test_process_returns_empty_for_short_vad_segments(
        self,
        mock_whisper_load: MagicMock,
        mock_vad_load: MagicMock,
        mock_sf_read: MagicMock,
    ) -> None:
        mock_model = MagicMock()
        mock_whisper_load.return_value = mock_model
        mock_vad_load.return_value = _vad_returns([{"start": 100, "end": 100}])
        mock_sf_read.return_value = _audio_1s_16k()

        from worker.processor import AudioProcessor

        config = WorkerConfig(vad_enabled=True)
        processor = AudioProcessor(config)
        results = processor.process(b"fake_audio_data", source_language="en")

        assert results == []
        mock_model.transcribe.assert_not_called()

    @patch("worker.processor.sf.read")
    @patch("worker.processor.torch.hub.load")
    @patch("worker.processor.WhisperLoader.load")
    def test_low_confidence_segments_filtered(
        self,
        mock_whisper_load: MagicMock,
        mock_vad_load: MagicMock,
        mock_sf_read: MagicMock,
    ) -> None:
        mock_model = MagicMock()
        mock_whisper_load.return_value = mock_model
        mock_vad_load.return_value = _vad_returns([{"start": 0, "end": 16000}])
        mock_sf_read.return_value = _audio_1s_16k()

        low_conf = make_segment(text=" Low confidence ", avg_logprob=-5.0)
        high_conf = make_segment(text=" High confidence ", avg_logprob=-0.2)
        mock_model.transcribe.return_value = (iter([low_conf, high_conf]), MagicMock())

        from worker.processor import AudioProcessor

        config = WorkerConfig(vad_enabled=True, min_confidence_threshold=0.10)
        processor = AudioProcessor(config)
        results = processor.process(b"fake_audio_data", source_language="en")

        assert len(results) == 1
        assert results[0]["text"] == "High confidence"

    @patch("worker.processor.sf.read")
    @patch("worker.processor.torch.hub.load")
    @patch("worker.processor.WhisperLoader.load")
    def test_empty_text_segments_filtered(
        self,
        mock_whisper_load: MagicMock,
        mock_vad_load: MagicMock,
        mock_sf_read: MagicMock,
    ) -> None:
        mock_model = MagicMock()
        mock_whisper_load.return_value = mock_model
        mock_vad_load.return_value = _vad_returns([{"start": 0, "end": 16000}])
        mock_sf_read.return_value = _audio_1s_16k()

        empty_seg = make_segment(text="   ", avg_logprob=-0.2)
        valid_seg = make_segment(text=" Valid text ", avg_logprob=-0.2)
        mock_model.transcribe.return_value = (iter([empty_seg, valid_seg]), MagicMock())

        from worker.processor import AudioProcessor

        config = WorkerConfig(vad_enabled=True)
        processor = AudioProcessor(config)
        results = processor.process(b"fake_audio_data", source_language="en")

        assert len(results) == 1
        assert results[0]["text"] == "Valid text"

    @patch("worker.processor.torch.hub.load")
    @patch("worker.processor.WhisperLoader.load")
    def test_confidence_calculation(
        self, mock_whisper_load: MagicMock, mock_vad_load: MagicMock
    ) -> None:
        mock_model = MagicMock()
        mock_whisper_load.return_value = mock_model
        mock_vad_load.return_value = _vad_returns()

        from worker.processor import AudioProcessor

        config = WorkerConfig(vad_enabled=True)
        processor = AudioProcessor(config)

        assert (
            abs(
                processor._segment_confidence(make_segment(avg_logprob=-0.3))
                - math.exp(-0.3)
            )
            < 0.001
        )
        assert processor._segment_confidence(make_segment(avg_logprob=0.0)) == 1.0

        conf_low = processor._segment_confidence(make_segment(avg_logprob=-10.0))
        assert 0.0 <= conf_low <= 1.0
        assert abs(conf_low - math.exp(-10.0)) < 0.0001

        assert processor._segment_confidence(make_segment(avg_logprob=1.0)) == 1.0

    @patch("worker.processor.torch.hub.load")
    @patch("worker.processor.WhisperLoader.load")
    def test_confidence_none_avg_logprob_returns_zero(
        self, mock_whisper_load: MagicMock, mock_vad_load: MagicMock
    ) -> None:
        mock_model = MagicMock()
        mock_whisper_load.return_value = mock_model
        mock_vad_load.return_value = _vad_returns()

        from worker.processor import AudioProcessor

        config = WorkerConfig(vad_enabled=True)
        processor = AudioProcessor(config)

        assert processor._segment_confidence(make_segment(avg_logprob=None)) == 0.0

    @patch("worker.processor.sf.read")
    @patch("worker.processor.torch.hub.load")
    @patch("worker.processor.WhisperLoader.load")
    def test_config_thresholds_passed_to_whisper(
        self,
        mock_whisper_load: MagicMock,
        mock_vad_load: MagicMock,
        mock_sf_read: MagicMock,
    ) -> None:
        mock_model = MagicMock()
        mock_whisper_load.return_value = mock_model
        mock_vad_load.return_value = _vad_returns([{"start": 0, "end": 16000}])
        mock_sf_read.return_value = _audio_1s_16k()
        mock_model.transcribe.return_value = (iter([]), MagicMock())

        from worker.processor import AudioProcessor

        config = WorkerConfig(
            vad_enabled=True,
            no_speech_threshold=0.7,
            log_prob_threshold=-0.5,
            compression_ratio_threshold=3.0,
        )
        processor = AudioProcessor(config)
        processor.process(b"fake_audio_data", source_language="en")

        mock_model.transcribe.assert_called_once()
        call_kwargs = mock_model.transcribe.call_args.kwargs
        assert call_kwargs["no_speech_threshold"] == 0.7
        assert call_kwargs["log_prob_threshold"] == -0.5
        assert call_kwargs["compression_ratio_threshold"] == 3.0

    @patch("worker.processor.sf.read")
    @patch("worker.processor.torch.hub.load")
    @patch("worker.processor.WhisperLoader.load")
    def test_progress_callback_called(
        self,
        mock_whisper_load: MagicMock,
        mock_vad_load: MagicMock,
        mock_sf_read: MagicMock,
    ) -> None:
        mock_model = MagicMock()
        mock_whisper_load.return_value = mock_model
        mock_vad_load.return_value = _vad_returns([{"start": 0, "end": 16000}])
        mock_sf_read.return_value = _audio_1s_16k()

        segments = [make_segment(text=" Hello ", avg_logprob=-0.2)]
        mock_model.transcribe.return_value = (iter(segments), MagicMock())

        from worker.processor import AudioProcessor

        config = WorkerConfig(vad_enabled=True)
        processor = AudioProcessor(config)

        progress_values: list[int] = []
        processor.process(
            b"fake_audio_data",
            source_language="en",
            progress_callback=lambda p: progress_values.append(p),
        )

        assert progress_values[0] == 5
        assert progress_values[-1] == 100
        assert all(5 <= p <= 100 for p in progress_values)
        for i in range(1, len(progress_values)):
            assert progress_values[i] >= progress_values[i - 1]

    @patch("worker.processor.sf.read")
    @patch("worker.processor.WhisperLoader.load")
    def test_process_without_vad(
        self, mock_whisper_load: MagicMock, mock_sf_read: MagicMock
    ) -> None:
        mock_model = MagicMock()
        mock_whisper_load.return_value = mock_model
        mock_sf_read.return_value = _audio_1s_16k()

        segments = [make_segment(text=" Direct transcription ", avg_logprob=-0.2)]
        mock_model.transcribe.return_value = (iter(segments), MagicMock())

        from worker.processor import AudioProcessor

        config = WorkerConfig(vad_enabled=False)
        processor = AudioProcessor(config)

        assert processor.vad is None

        results = processor.process(b"fake_audio_data", source_language="en")

        assert len(results) == 1
        assert results[0]["text"] == "Direct transcription"
        mock_model.transcribe.assert_called_once()


class TestDecodeAudio:
    @patch("worker.processor.torch.hub.load")
    @patch("worker.processor.WhisperLoader.load")
    @patch("worker.processor.sf.read")
    def test_decode_audio_converts_stereo_to_mono(
        self,
        mock_sf_read: MagicMock,
        mock_whisper_load: MagicMock,
        mock_vad_load: MagicMock,
    ) -> None:
        mock_model = MagicMock()
        mock_whisper_load.return_value = mock_model
        mock_vad_load.return_value = _vad_returns()

        stereo_audio = np.array(
            [[0.5, -0.5], [0.3, -0.3], [0.1, -0.1]], dtype=np.float32
        )
        mock_sf_read.return_value = (stereo_audio, 16000)

        from worker.processor import AudioProcessor

        config = WorkerConfig(vad_enabled=True)
        processor = AudioProcessor(config)
        waveform, sample_rate = processor._decode_audio(b"fake_audio")

        assert waveform.ndim == 1
        assert sample_rate == 16000
        assert abs(waveform[0] - 0.0) < 0.001


class TestVAD:
    @patch("worker.processor.sf.read")
    @patch("worker.processor.torch.hub.load")
    @patch("worker.processor.WhisperLoader.load")
    def test_vad_threshold_passed_to_get_speech_timestamps(
        self,
        mock_whisper_load: MagicMock,
        mock_vad_load: MagicMock,
        mock_sf_read: MagicMock,
    ) -> None:
        mock_model = MagicMock()
        mock_whisper_load.return_value = mock_model

        mock_vad_model = MagicMock()
        mock_get_timestamps = MagicMock(return_value=[])
        mock_vad_load.return_value = (
            mock_vad_model,
            [mock_get_timestamps, None, None, None, None],
        )

        mock_sf_read.return_value = _audio_1s_16k()

        from worker.processor import AudioProcessor

        config = WorkerConfig(vad_enabled=True, vad_threshold=0.7)
        processor = AudioProcessor(config)
        processor.process(b"fake_audio_data", source_language="en")

        mock_get_timestamps.assert_called_once()
        assert mock_get_timestamps.call_args.kwargs["threshold"] == 0.7


class TestAllSegmentsFiltered:
    @patch("worker.processor.sf.read")
    @patch("worker.processor.torch.hub.load")
    @patch("worker.processor.WhisperLoader.load")
    def test_process_returns_empty_when_all_segments_filtered(
        self,
        mock_whisper_load: MagicMock,
        mock_vad_load: MagicMock,
        mock_sf_read: MagicMock,
    ) -> None:
        mock_model = MagicMock()
        mock_whisper_load.return_value = mock_model
        mock_vad_load.return_value = _vad_returns([{"start": 0, "end": 16000}])
        mock_sf_read.return_value = _audio_1s_16k()

        all_filtered_segments = [
            make_segment(text="   ", avg_logprob=-0.2),
            make_segment(text=" noise ", avg_logprob=-10.0),
        ]
        mock_model.transcribe.return_value = (iter(all_filtered_segments), MagicMock())

        from worker.processor import AudioProcessor

        config = WorkerConfig(vad_enabled=True, min_confidence_threshold=0.10)
        processor = AudioProcessor(config)
        results = processor.process(b"fake_audio_data", source_language="en")

        assert results == []
        mock_model.transcribe.assert_called_once()


class TestBorderlineSpeech:
    @patch("worker.processor.sf.read")
    @patch("worker.processor.torch.hub.load")
    @patch("worker.processor.WhisperLoader.load")
    def test_quiet_speech_survives_filtering(
        self,
        mock_whisper_load: MagicMock,
        mock_vad_load: MagicMock,
        mock_sf_read: MagicMock,
    ) -> None:
        mock_model = MagicMock()
        mock_whisper_load.return_value = mock_model
        mock_vad_load.return_value = _vad_returns([{"start": 0, "end": 16000}])
        mock_sf_read.return_value = _audio_1s_16k()

        quiet_but_real = make_segment(
            text=" xin chào ", start=0.1, end=0.8, avg_logprob=-1.5
        )
        loud_and_clear = make_segment(
            text=" tốt lắm ", start=0.8, end=1.5, avg_logprob=-0.2
        )
        mock_model.transcribe.return_value = (
            iter([quiet_but_real, loud_and_clear]),
            MagicMock(),
        )

        from worker.processor import AudioProcessor

        config = WorkerConfig(vad_enabled=True, min_confidence_threshold=0.10)
        processor = AudioProcessor(config)
        results = processor.process(b"fake_audio_data", source_language="vi")

        assert len(results) == 2
        assert results[0]["text"] == "xin chào"
        assert results[1]["text"] == "tốt lắm"
        assert all(r["confidence"] >= 0.10 for r in results)

    @patch("worker.processor.sf.read")
    @patch("worker.processor.torch.hub.load")
    @patch("worker.processor.WhisperLoader.load")
    def test_noise_rejected_while_speech_kept(
        self,
        mock_whisper_load: MagicMock,
        mock_vad_load: MagicMock,
        mock_sf_read: MagicMock,
    ) -> None:
        mock_model = MagicMock()
        mock_whisper_load.return_value = mock_model
        mock_vad_load.return_value = _vad_returns([{"start": 0, "end": 16000}])
        mock_sf_read.return_value = _audio_1s_16k()

        hallucination = make_segment(text=" ... ", avg_logprob=-8.0)
        real_speech = make_segment(
            text=" cuộc họp hôm nay ", start=0.5, end=1.2, avg_logprob=-0.4
        )
        empty_noise = make_segment(text="  ", avg_logprob=-0.1)
        mock_model.transcribe.return_value = (
            iter([hallucination, real_speech, empty_noise]),
            MagicMock(),
        )

        from worker.processor import AudioProcessor

        config = WorkerConfig(vad_enabled=True, min_confidence_threshold=0.10)
        processor = AudioProcessor(config)
        results = processor.process(b"fake_audio_data", source_language="vi")

        assert len(results) == 1
        assert results[0]["text"] == "cuộc họp hôm nay"
