# Implementation Plan: Realtime Meeting Transcription

**Branch**: `007-realtime-meeting-transcription` | **Date**: 2026-04-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-realtime-meeting-transcription/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Build Talkie — a web application for real-time meeting transcription and translation. Host creates meeting, records audio from browser, streams to server where GPU workers (Google Colab notebooks) process speech-to-text. Transcript appears in real-time for host and participants. Translation on-demand, summary generation post-meeting, and full history access.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend), Python 3.11+ (backend), Python (Colab worker)  
**Primary Dependencies**: React + Vite, Zustand, MUI (frontend); FastAPI, SQLAlchemy 2.0, Dramatiq (backend); Faster-Whisper turbo (STT)  
**Storage**: PostgreSQL (relational data), S3/MinIO (audio files), Redis (cache/real-time)  
**Testing**: Vitest + React Testing Library + Playwright (frontend); pytest + pytest-asyncio + httpx (backend). These frameworks MUST appear as explicit implementation and validation tasks in tasks.md.  
**Target Platform**: Modern web browsers (Chrome, Firefox, Edge), Linux server (backend)  
**Project Type**: Web application (frontend + backend + distributed GPU workers)  
**Performance Goals**: <=500ms worker-result-to-screen transcript latency (p95), <=10s speech-to-screen transcript latency (p95), <5s translation latency, <60s summary for 1hr meeting, 10+ concurrent participants  
**Constraints**: <500ms UI response, <200ms API p95, stable 2hr+ sessions, reconnection with exponential backoff  
**Scale/Scope**: MVP scale, single host per meeting, 10+ participants viewing

**External Services**: Google Cloud Translation Advanced (translation), OpenAI GPT-5.4 mini (summary)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

This feature inherits all MUST/SHOULD requirements from `.specify/memory/constitution.md`.

### Inherited Quality Gates
- Code quality, strict typing, linting, formatting, error handling, and review requirements are governed by the constitution and must be validated by explicit tasks in `tasks.md`.
- Testing is mandatory: unit, integration, and E2E coverage must be represented in `tasks.md`, and business logic must meet the constitution's branch coverage threshold.
- UX consistency requirements (design system, i18n, loading/error states, accessibility) are governed by the constitution and must have both implementation and verification tasks.
- Performance requirements are governed by the constitution and refined for this feature by `spec.md` success criteria.

### Feature-Specific Compliance Notes
- Transcript latency is measured with two distinct metrics and both must be validated: `worker-result-to-screen <=500ms (p95)` and `speech-to-screen <=10s (p95)`.
- WebSocket reconnection with exponential backoff is mandatory for host and participant flows.
- Public API documentation, worker architecture documentation, and replay-access/security documentation are required deliverables for this feature.
- Validation tasks must explicitly cover lint, typecheck, build, tests, accessibility verification, and end-to-end quickstart flow.

**Gate Status**: CONDITIONAL PASS (implementation may proceed only if tasks.md includes explicit coverage for testing, validation, documentation, accessibility, and performance verification)

## Project Structure

### Documentation (this feature)

```text
specs/007-realtime-meeting-transcription/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── models/          # SQLAlchemy/ORM models
│   ├── services/        # Business logic (meetings, transcription, translation)
│   ├── api/             # REST/WebSocket endpoints
│   ├── workers/         # Background task processors
│   └── core/            # Config, auth, database
└── tests/
    ├── unit/
    ├── integration/
    └── contract/

frontend/
├── src/
│   ├── components/      # Reusable UI components
│   ├── pages/           # Route-level pages (Home, Meeting, History)
│   ├── services/        # API clients, WebSocket handlers
│   ├── hooks/           # Custom React hooks
│   ├── stores/          # State management
│   └── i18n/            # Localization files
└── tests/
    ├── unit/
    └── e2e/

colab-worker/
├── notebook.ipynb       # Google Colab notebook for GPU worker
├── worker/
│   ├── client.py        # Server polling client
│   ├── processor.py     # STT processing logic
│   └── models/          # Whisper model loading
└── tests/
```

**Structure Decision**: Web application with separate frontend, backend, and Colab worker. Frontend handles recording and display. Backend manages meetings, stores data, coordinates workers. Colab worker runs STT on GPU via poll-based job queue.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 3 separate codebases (frontend, backend, colab-worker) | GPU workers must run in Colab (free GPU), separate from server. Frontend is browser-based. | Monolith cannot leverage free Colab GPU, all-in-one server would require expensive GPU hosting |
