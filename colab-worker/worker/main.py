from __future__ import annotations
# pyright: reportUnusedCallResult=false, reportAny=false

import argparse
import logging
import threading
import time

from worker.client import TalkieClient
from worker.config import WorkerConfig
from worker.processor import AudioProcessor


def _configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s - %(message)s",
    )


def _heartbeat_loop(
    client: TalkieClient,
    chunk_id: str,
    stop_event: threading.Event,
    progress_ref: dict[str, int],
    interval_seconds: float,
) -> None:
    while not stop_event.wait(interval_seconds):
        client.heartbeat(chunk_id, progress_ref["value"])


def run_worker(config: WorkerConfig) -> None:
    client = TalkieClient(config)
    processor = AudioProcessor(config)
    logger = logging.getLogger(__name__)

    backoff = config.poll_interval_seconds
    try:
        while True:
            try:
                jobs = client.poll_jobs(limit=1)

                if not jobs:
                    sleep_for = min(backoff, config.poll_backoff_max_seconds)
                    logger.debug("No jobs available, sleeping for %.1fs", sleep_for)
                    time.sleep(sleep_for)
                    backoff = min(backoff * 2, config.poll_backoff_max_seconds)
                    continue

                backoff = config.poll_interval_seconds
                job = jobs[0]

                if not client.claim_job(job.chunk_id):
                    continue

                logger.info(
                    "Claimed chunk %s for meeting %s (sequence=%s)",
                    job.chunk_id,
                    job.meeting_id,
                    job.sequence,
                )
                audio_data = client.download_audio(job.audio_url)

                stop_event = threading.Event()
                progress_ref = {"value": 0}
                heartbeat_thread = threading.Thread(
                    target=_heartbeat_loop,
                    args=(
                        client,
                        job.chunk_id,
                        stop_event,
                        progress_ref,
                        config.heartbeat_interval_seconds,
                    ),
                    daemon=True,
                )
                heartbeat_thread.start()

                try:
                    started_at = time.perf_counter()
                    segments = processor.process(
                        audio_data,
                        job.source_language,
                        progress_callback=lambda progress: progress_ref.__setitem__(
                            "value", progress
                        ),
                    )
                    processing_time = time.perf_counter() - started_at
                    logger.info(
                        "Chunk %s processed in %.2fs with %d segment(s)",
                        job.chunk_id,
                        processing_time,
                        len(segments),
                    )
                finally:
                    stop_event.set()
                    heartbeat_thread.join(timeout=1)

                client.submit_result(job.chunk_id, segments)
                logger.info("Submitted transcript result for chunk %s", job.chunk_id)
            except Exception:
                logger.exception("Error processing worker job")
                time.sleep(5)
    finally:
        client.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the Talkie Colab worker")
    parser.add_argument("--server-url")
    parser.add_argument("--worker-id")
    return parser.parse_args()


def build_config(args: argparse.Namespace) -> WorkerConfig:
    config = WorkerConfig()
    if args.server_url:
        config.server_url = args.server_url
    if args.worker_id:
        config.worker_id = args.worker_id
    return config


if __name__ == "__main__":
    _configure_logging()
    arguments = parse_args()
    run_worker(build_config(arguments))
