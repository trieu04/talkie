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
**Testing**: Vitest + React Testing Library + Playwright (frontend); pytest + pytest-asyncio + httpx (backend)  
**Target Platform**: Modern web browsers (Chrome, Firefox, Edge), Linux server (backend)  
**Project Type**: Web application (frontend + backend + distributed GPU workers)  
**Performance Goals**: <10s transcript latency, <5s translation latency, <60s summary for 1hr meeting, 10+ concurrent participants  
**Constraints**: <500ms UI response, <200ms API p95, stable 2hr+ sessions, reconnection with exponential backoff  
**Scale/Scope**: MVP scale, single host per meeting, 10+ participants viewing

**External Services**: Google Cloud Translation Advanced (translation), OpenAI GPT-5.4 mini (summary)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Code Quality ✓ PLANNED
- [ ] TypeScript strict mode enabled
- [ ] ESLint + Prettier configured
- [ ] Python typing (mypy) configured
- [ ] Error handling strategy defined

### II. Testing Standards ✓ PLANNED
- [ ] Unit test framework selected
- [ ] Integration test strategy for WebSocket
- [ ] E2E test approach for recording flow
- [ ] 80% branch coverage target

### III. UX Consistency ✓ PLANNED
- [ ] Design system / component library selected
- [ ] i18n framework for localization
- [ ] Loading states for all async operations
- [ ] Error feedback patterns defined
- [ ] Accessibility (WCAG 2.1 AA) compliance

### IV. Performance Requirements ✓ CRITICAL
- [ ] <500ms transcript display latency (from audio receipt)
- [ ] <100ms UI interaction response
- [ ] <200ms API response (p95)
- [ ] Memory-safe for 2hr+ sessions
- [ ] WebSocket reconnection with exponential backoff
- [ ] Performance monitoring setup

### Technical Constraints ✓ PLANNED
- [ ] Dependency justification for new packages
- [ ] Input sanitization strategy
- [ ] Auth token expiration
- [ ] Backward compatible API design
- [ ] Public API documentation

**Gate Status**: PASS (no violations, all items planned for Phase 0/1 resolution)

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
