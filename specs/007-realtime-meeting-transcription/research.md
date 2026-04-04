# Research: Realtime Meeting Transcription

**Feature**: 007-realtime-meeting-transcription  
**Date**: 2026-04-04  
**Status**: Complete

## Overview

This document captures research findings for all technical unknowns identified during planning. Each section provides a decision, rationale, and alternatives considered.

---

## 1. Frontend Framework

### Decision: **React + Vite**

### Rationale
- **Best ecosystem fit** for real-time transcription app requiring WebSocket updates, audio recording, and state management
- Deepest ecosystem for accessibility (MUI, Radix), internationalization (react-i18next), and testing (Vitest, Playwright)
- Vite provides fast HMR and simpler setup than Next.js for client-heavy real-time app
- Audio recording via MediaDevices/MediaRecorder and WebSocket streaming are framework-agnostic; differentiator is ecosystem maturity

### Alternatives Considered
| Option | Why Not Primary |
|--------|-----------------|
| Vue 3 | Strong runner-up, great DX with Pinia, but slightly weaker design-system/a11y ecosystem than React |
| Svelte/SvelteKit | Best raw simplicity/performance, but smaller ecosystem for enterprise-grade i18n + component systems |
| Next.js | Only needed if SSR/SEO for marketing pages; meeting room is client-heavy, SSR not the main value driver |

### Recommended Stack
- **Framework**: React 18+ with Vite
- **State Management**: Zustand (ideal for live transcript state, selector-based subscriptions, minimal rerenders)
- **Component Library**: MUI (full-package accessibility, design-system readiness, enterprise stability)
- **i18n**: react-i18next (most mature, lazy-loaded namespaces, pluralization)
- **Testing**: Vitest + React Testing Library (unit/component) + Playwright (E2E)

---

## 2. Backend Framework

### Decision: **FastAPI**

### Rationale
- **ASGI-native** with built-in WebSocket support, async-friendly architecture
- **Best fit for <200ms API p95** if audio processing stays off the request path
- Clean PostgreSQL/Redis integration via SQLAlchemy 2.0 and async drivers
- Lower operational complexity than Django+Channels or Flask-SocketIO
- Strongly typed REST with automatic OpenAPI docs

### Alternatives Considered
| Option | Why Not Primary |
|--------|-----------------|
| Django + Channels | More complexity: Django + DRF + Channels + async/sync boundaries; heavier for this use case |
| Flask + Flask-SocketIO | More scaling friction, sticky-session concerns, Socket.IO protocol overhead, gevent/eventlet tradeoffs |

### Recommended Stack
- **Framework**: FastAPI
- **WebSockets**: FastAPI/Starlette native WebSockets on Uvicorn (plain RFC6455, not Socket.IO)
- **Job Queue**: Dramatiq + Redis (simpler than Celery, production-ready retries/time limits)
- **ORM**: SQLAlchemy 2.0 + Alembic (strongest ecosystem fit, mature async/sync options)
- **Authentication**: OAuth2/OIDC-style JWT access + refresh tokens (HttpOnly cookies for browser, Bearer for API)
- **Testing**: pytest + pytest-asyncio + httpx.AsyncClient

### Worker Coordination Note
For poll-based Colab GPU workers:
- Use **PostgreSQL job/lease table** for worker polling, heartbeats, assignment, and recovery
- Use **Redis/Dramatiq** for backend orchestration tasks
- This pull model is clearer than making external Colab workers behave like normal queue consumers

---

## 3. Speech-to-Text Model

### Decision: **Faster-Whisper with `turbo` / `large-v3-turbo` model**

### Rationale
- **Best balance** of Vietnamese accuracy + speed + Colab feasibility
- Same Whisper-family accuracy but **much faster and lower VRAM** than vanilla OpenAI Whisper
- Supports **chunked/rolling-buffer inference** for streaming-style real-time transcription
- No API lock-in or cost during experimentation
- T4 GPU on Colab free tier has 16GB VRAM, sufficient for turbo/large models

### Alternatives Considered
| Option | Why Not Primary |
|--------|-----------------|
| OpenAI Whisper | Accurate but slower; `transcribe()` is batch/sliding-window, not ideal for live chunks |
| WhisperX | Great for offline word timestamps/diarization, but extra latency/complexity for live use |
| Google Speech-to-Text | Best native streaming API, but doesn't use Colab GPU, adds API cost/network dependency |

### Recommended Configuration
- **Model**: Faster-Whisper with `turbo` or `large-v3-turbo`
- **Fallback**: `medium` if Colab becomes unstable or latency spikes
- **Mode**: Chunked streaming with rolling buffer (not full-audio batch)
- **Chunk Size**: 4 seconds with 0.75 second overlap
- **Context Buffer**: 8-12 seconds rolling context for sentence continuity
- **VAD**: Silero-VAD or Faster-Whisper's built-in VAD

### Python Libraries
```
faster-whisper
ctranslate2
numpy
soundfile (or av)
torch + torchaudio (for VAD helpers)
silero-vad
```

---

## 4. Translation Service

### Decision: **Google Cloud Translation Advanced (NMT default, TLLM for quality-sensitive)**

### Rationale
- **Best latency** for real-time translation (<5s requirement)
- **Broad language coverage**: Vietnamese → English, Japanese, and many others supported
- **On-demand fits naturally**: only translate when user requests specific language
- **Predictable ops**: dedicated translation API is simpler than prompting a general LLM
- Cost-equivalent between NMT and Translation LLM for standard text

### Alternatives Considered
| Option | Why Not Primary |
|--------|-----------------|
| DeepL API | Excellent quality, but weaker coverage for Vietnamese and "other languages" scalability |
| OpenAI GPT for translation | Flexible but worse than dedicated API on cost/latency/consistency |
| Self-hosted models | Only if strict on-prem/data sovereignty; high ops burden |

### Integration Pattern
1. Store original Vietnamese transcript immediately
2. If no viewer requests translation, do nothing (on-demand)
3. When user requests language: translate backlog + new segments
4. Cache by `(meeting_id, segment_id, target_lang)`
5. Push translated segments via WebSocket

### Pricing
- Google NMT: ~$20/1M chars (first 500k/month free)
- Google TLLM: ~$10/1M input + $10/1M output (cost-equivalent)

---

## 5. Summary Service

### Decision: **OpenAI GPT-5.4 mini with hierarchical summarization**

### Rationale
- Summarization needs **reasoning + extraction** (key points, decisions, action items)
- Fast enough for <60s on 1-hour transcript with **map-reduce/hierarchical pipeline**
- Large context + structured JSON output make it easier than self-hosting
- Cost is reasonable, especially with mini models

### Alternatives Considered
| Option | Why Not Primary |
|--------|-----------------|
| Claude Sonnet 4.6 | Strong alternative, especially for long-context; good fallback/A-B candidate |
| Self-hosted LLMs | Only if strict data control; high ops burden for tuning/evals/GPUs |

### Integration Pattern (Hierarchical Summarization)
1. Fetch full transcript when meeting ends
2. Chunk transcript by token/time/speaker sections
3. First-pass LLM per chunk → structured JSON (key_points, decisions, action_items)
4. Merge chunk outputs in second-pass LLM
5. Final pass normalizes/deduplicates → final summary JSON + human-readable

### Pricing
- GPT-5.4 mini: $0.75/1M input, $4.50/1M output
- GPT-5.4: $2.50/1M input, $15/1M output
- Claude Sonnet 4.6: $3/1M input, $15/1M output

### Fallback Strategy
1. Primary: OpenAI GPT-5.4 mini
2. Fallback: Claude Sonnet 4.6
3. Emergency: extractive summary from transcript heuristics + smaller LLM cleanup

---

## 6. Database & Storage

### Decision: **PostgreSQL + S3-compatible storage + Redis**

### Rationale
- **PostgreSQL**: Core data is relational (hosts → meetings → segments → translations). Strong consistency, excellent indexing, native full-text search with GIN indexes.
- **S3/MinIO**: Audio files can be large; object storage is built for blobs, supports multipart upload, lifecycle archival.
- **Redis**: Hot ephemeral state, fan-out for real-time updates, presence, WebSocket channels.

### Alternatives Considered
| Option | Why Not Primary |
|--------|-----------------|
| MongoDB | Weaker fit for relational analytics, transcript segments grow awkwardly, search usually needs Atlas Search |
| Postgres + Mongo combo | Adds complexity without enough payoff; Redis covers ephemeral state role |
| Local filesystem | Painful for scaling, backup, failover, shared access |

### Recommended Architecture
- **Database**: PostgreSQL with SQLAlchemy 2.0
- **File Storage**: S3 (cloud) or MinIO (self-hosted)
- **Cache/Real-time**: Redis (Pub/Sub for UI updates, Streams for processing pipelines)
- **Search**: PostgreSQL full-text search first (tsvector + GIN index)

### Schema Entities
- `hosts` - Host accounts
- `meetings` - Meeting metadata, status, source language
- `transcript_segments` - Text, timestamps, sequence
- `segment_translations` - Per segment, per language
- `meeting_summaries` - Summary text
- `audio_chunks` - Metadata + object key + processing status

### Data Retention Strategy
- **Hot**: Active meetings in Postgres, recent audio in S3 standard, Redis TTL minutes-hours
- **Warm**: Partition transcript tables by month, move older audio to cheaper tier
- **Cold**: Transition old audio to S3 Glacier/infrequent-access
- **Policy**: Raw audio 30-90 days, transcripts/summaries longer, translations cache on demand

### Redis Usage
- Active meeting state
- Latest transcript window
- Participant presence
- WebSocket fan-out channels
- Translation job state
- Partial segments before persistence

---

## Summary of Technology Choices

| Category | Decision |
|----------|----------|
| Frontend | React + Vite, Zustand, MUI, react-i18next, Vitest + Playwright |
| Backend | FastAPI, SQLAlchemy 2.0, Dramatiq + Redis, JWT auth, pytest |
| STT | Faster-Whisper turbo/large-v3-turbo, 4s chunks, rolling buffer |
| Translation | Google Cloud Translation Advanced (NMT/TLLM) |
| Summary | OpenAI GPT-5.4 mini, hierarchical summarization |
| Database | PostgreSQL |
| File Storage | S3 / MinIO |
| Cache | Redis |
| Search | PostgreSQL full-text search (GIN index) |

---

## Open Items for Phase 1

1. Define concrete data model schema in `data-model.md`
2. Design API contracts for REST and WebSocket in `contracts/`
3. Create quickstart guide for local development in `quickstart.md`
