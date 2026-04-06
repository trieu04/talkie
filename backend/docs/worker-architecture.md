# Worker Polling Lifecycle

## Overview

Talkie uses poll-based GPU workers. Each worker:

1. polls `GET /api/v1/worker/jobs`
2. claims a job with `POST /api/v1/worker/jobs/{id}/claim`
3. downloads audio via a presigned URL
4. sends heartbeat updates while processing
5. submits transcript results with `POST /api/v1/worker/jobs/{id}/result`

## Retry and Timeout Behavior

- workers receive a `timeout_seconds` lease per claimed job
- `POST /api/v1/worker/jobs/{id}/heartbeat` extends the lease
- expired leases are detected by the backend chunk monitor
- timed-out chunks are returned to `pending` until `worker_max_retries` is exceeded
- exhausted chunks are marked `failed`

## Operational Notes

- polling keeps Colab workers compatible with outbound-only networking
- transcript creation remains on the backend for consistent ordering
- raw audio remains in object storage; workers only receive presigned download URLs
