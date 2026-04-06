# Tasks: Realtime Meeting Transcription

**Input**: Design documents from `/specs/007-realtime-meeting-transcription/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are mandatory per constitution. This task list includes unit, integration, E2E, accessibility, performance, and validation tasks required to verify each user story and quality gate.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/src/`, `backend/tests/`
- **Frontend**: `frontend/src/`, `frontend/tests/`
- **Colab Worker**: `colab-worker/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure for all three codebases

- [x] T001 Create monorepo structure with backend/, frontend/, colab-worker/ directories
- [x] T002 [P] Initialize backend Python project with pyproject.toml and requirements.txt
- [x] T003 [P] Initialize frontend React+Vite project with package.json and TypeScript config
- [x] T004 [P] Initialize colab-worker Python project structure
- [x] T005 [P] Configure backend linting (ruff, black) and typing (mypy) in backend/pyproject.toml
- [x] T006 [P] Configure frontend linting (ESLint) and formatting (Prettier) in frontend/
- [x] T007 [P] Create docker-compose.yml with PostgreSQL, Redis, MinIO services
- [x] T008 [P] Create backend .env.example with all environment variables from quickstart.md
- [x] T009 [P] Create frontend .env.example with VITE_API_URL and VITE_WS_URL

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Database & Core Setup

- [x] T010 Configure SQLAlchemy 2.0 with async engine in backend/src/core/database.py
- [x] T011 Configure Alembic migrations in backend/alembic/
- [x] T012 [P] Create Host model in backend/src/models/host.py
- [x] T013 [P] Create Meeting model with status enum in backend/src/models/meeting.py
- [x] T014 [P] Create AudioChunk model with status enum in backend/src/models/audio_chunk.py
- [x] T015 [P] Create TranscriptSegment model in backend/src/models/transcript_segment.py
- [x] T016 [P] Create SegmentTranslation model in backend/src/models/segment_translation.py
- [x] T017 [P] Create MeetingSummary model in backend/src/models/meeting_summary.py
- [x] T018 Create initial Alembic migration with all models in backend/alembic/versions/
- [x] T019 Configure Redis connection in backend/src/core/redis.py
- [x] T020 Configure MinIO/S3 client in backend/src/core/storage.py

### Authentication Framework

- [x] T021 Implement JWT token generation/validation in backend/src/core/auth.py
- [x] T022 Create auth dependency for FastAPI routes in backend/src/core/dependencies.py
- [x] T023 Implement POST /auth/register endpoint in backend/src/api/auth.py
- [x] T024 Implement POST /auth/login endpoint in backend/src/api/auth.py
- [x] T025 Implement POST /auth/refresh endpoint in backend/src/api/auth.py

### Foundational Test Coverage

- [ ] T025a Add auth endpoint integration tests in backend/tests/integration/test_auth_api.py
- [ ] T025b Add JWT auth unit tests in backend/tests/unit/core/test_auth.py

### API & WebSocket Framework

- [x] T026 Create FastAPI app with CORS middleware in backend/src/main.py
- [x] T027 Create base Pydantic schemas for API responses in backend/src/schemas/base.py
- [x] T028 Create error handling middleware with error codes in backend/src/core/exceptions.py
- [x] T029 Setup WebSocket manager for connection handling in backend/src/core/websocket_manager.py

### Frontend Core Setup

- [x] T030 Configure Zustand store structure in frontend/src/stores/
- [x] T031 [P] Create auth store in frontend/src/stores/authStore.ts
- [x] T032 [P] Create meeting store in frontend/src/stores/meetingStore.ts
- [x] T033 [P] Create transcript store in frontend/src/stores/transcriptStore.ts
- [x] T034 Configure MUI theme and provider in frontend/src/theme/
- [x] T035 Configure react-i18next with vi/en locales in frontend/src/i18n/
- [x] T036 Create API client with axios in frontend/src/services/api.ts
- [x] T037 Create WebSocket service with reconnection logic in frontend/src/services/websocket.ts
- [x] T038 Create React Router setup with routes in frontend/src/App.tsx
- [x] T039 [P] Create Login page component in frontend/src/pages/Login.tsx
- [x] T040 [P] Create Register page component in frontend/src/pages/Register.tsx

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Host Recording & Realtime Transcript (Priority: P1) 🎯 MVP

**Goal**: Host creates meeting, records audio from browser, sees transcript in real-time

**Independent Test**: One user creates meeting, starts recording, speaks, sees transcript appear within 10 seconds

### Backend - Meeting Management

- [x] T041 [US1] Create MeetingService with create/start/stop logic in backend/src/services/meeting_service.py
- [x] T042 [US1] Implement POST /meetings endpoint in backend/src/api/meetings.py
- [x] T043 [US1] Implement GET /meetings/{id} endpoint in backend/src/api/meetings.py
- [x] T044 [US1] Implement POST /meetings/{id}/start endpoint in backend/src/api/meetings.py
- [x] T045 [US1] Implement POST /meetings/{id}/stop endpoint in backend/src/api/meetings.py
- [x] T046 [US1] Generate unique room_code on meeting creation in backend/src/services/meeting_service.py

### Backend - Audio Upload & Storage

- [x] T047 [US1] Create AudioChunkService for upload handling in backend/src/services/audio_chunk_service.py
- [x] T048 [US1] Implement POST /meetings/{id}/audio endpoint in backend/src/api/meetings.py
- [x] T049 [US1] Store audio chunks to MinIO with storage_key pattern in backend/src/services/audio_chunk_service.py

### Backend - WebSocket for Host

- [x] T050 [US1] Create host WebSocket endpoint at /ws/meeting/{id}/host in backend/src/api/websocket.py
- [x] T051 [US1] Handle audio_chunk message type with base64 decoding in backend/src/api/websocket.py
- [x] T052 [US1] Handle recording_control messages (start/pause/resume/stop) in backend/src/api/websocket.py
- [x] T053 [US1] Send chunk_received acknowledgment to host in backend/src/api/websocket.py
- [x] T054 [US1] Implement ping/pong heartbeat handling in backend/src/api/websocket.py

### Backend - Transcript Distribution

- [x] T055 [US1] Create TranscriptService for segment management in backend/src/services/transcript_service.py
- [x] T056 [US1] Implement Redis pub/sub for transcript broadcast in backend/src/services/transcript_service.py
- [x] T057 [US1] Send transcript_segment to connected clients via WebSocket in backend/src/api/websocket.py
- [x] T058 [US1] Handle partial vs finalized segments in backend/src/services/transcript_service.py

### Frontend - Meeting Creation Flow

- [x] T059 [US1] Create Home page with "Create Meeting" button in frontend/src/pages/Home.tsx
- [x] T060 [US1] Create MeetingCreate dialog with title and language selection in frontend/src/components/MeetingCreate.tsx
- [x] T061 [US1] Implement meeting creation API call in frontend/src/services/meetingApi.ts

### Frontend - Recording Interface

- [x] T062 [US1] Create MeetingRoom page component in frontend/src/pages/MeetingRoom.tsx
- [x] T063 [US1] Create AudioRecorder hook using MediaRecorder API in frontend/src/hooks/useAudioRecorder.ts
- [x] T064 [US1] Request microphone permission and handle errors in frontend/src/hooks/useAudioRecorder.ts
- [x] T065 [US1] Chunk audio into 4s segments with 750ms overlap in frontend/src/hooks/useAudioRecorder.ts
- [x] T066 [US1] Create RecordingControls component (start/stop/pause) in frontend/src/components/RecordingControls.tsx

### Frontend - WebSocket & Transcript Display

- [x] T067 [US1] Connect to host WebSocket endpoint on meeting start in frontend/src/hooks/useMeetingWebSocket.ts
- [x] T068 [US1] Send audio_chunk messages via WebSocket in frontend/src/hooks/useMeetingWebSocket.ts
- [x] T069 [US1] Buffer audio during disconnection (up to 30s) in frontend/src/hooks/useAudioRecorder.ts
- [x] T070 [US1] Create TranscriptView component displaying segments in frontend/src/components/TranscriptView.tsx
- [x] T071 [US1] Handle transcript_segment messages and update store in frontend/src/hooks/useMeetingWebSocket.ts
- [x] T072 [US1] Auto-scroll transcript to latest segment in frontend/src/components/TranscriptView.tsx
- [x] T073 [US1] Show "waiting for processing" when no workers available in frontend/src/components/ProcessingStatus.tsx

### Frontend - Connection Resilience

- [x] T074 [US1] Implement exponential backoff reconnection (1s-32s) in frontend/src/services/websocket.ts
- [x] T075 [US1] Send sync_request after reconnection in frontend/src/hooks/useMeetingWebSocket.ts
- [x] T076 [US1] Handle sync_response and merge missed segments in frontend/src/hooks/useMeetingWebSocket.ts

### Testing - User Story 1

- [ ] T076a [US1] Add MeetingService unit tests in backend/tests/unit/services/test_meeting_service.py
- [ ] T076b [US1] Add meeting WebSocket integration tests in backend/tests/integration/test_meeting_websocket.py
- [ ] T076c [US1] Add frontend MeetingRoom recording tests in frontend/tests/unit/pages/MeetingRoom.test.tsx

**Checkpoint**: Host can record meetings and see realtime transcript (requires Worker from US6 to process audio)

---

## Phase 4: User Story 6 - GPU Worker Pipeline (Priority: P6, but needed for US1)

**Goal**: Colab notebook polls server, processes audio chunks, returns transcript

**Independent Test**: Run worker, submit audio chunk via API, receive transcript text

**Note**: Implementing early because US1 depends on this for end-to-end functionality

### Backend - Worker API

- [x] T077 [US6] Create WorkerService for job assignment in backend/src/services/worker_service.py
- [x] T078 [US6] Implement GET /worker/jobs polling endpoint in backend/src/api/worker.py
- [x] T079 [US6] Implement job claiming with atomic lock in backend/src/services/worker_service.py
- [x] T080 [US6] Implement POST /worker/jobs/{id}/result endpoint in backend/src/api/worker.py
- [x] T081 [US6] Implement POST /worker/jobs/{id}/heartbeat endpoint in backend/src/api/worker.py
- [x] T082 [US6] Implement worker timeout and job reassignment logic in backend/src/services/worker_service.py
- [x] T083 [US6] Create background task for chunk timeout monitoring in backend/src/workers/chunk_monitor.py

### Colab Worker - Core

- [x] T084 [P] [US6] Create worker configuration in colab-worker/worker/config.py
- [x] T085 [US6] Create server polling client in colab-worker/worker/client.py
- [x] T086 [US6] Implement job polling loop with backoff in colab-worker/worker/client.py
- [x] T087 [US6] Create Faster-Whisper model loader in colab-worker/worker/models/whisper_loader.py
- [x] T088 [US6] Implement STT processor with chunked inference in colab-worker/worker/processor.py
- [x] T089 [US6] Implement VAD (Silero) for silence detection in colab-worker/worker/processor.py
- [x] T090 [US6] Send heartbeat during processing in colab-worker/worker/client.py
- [x] T091 [US6] Submit transcript results to server in colab-worker/worker/client.py
- [x] T092 [US6] Create main worker entry point in colab-worker/worker/main.py
- [x] T093 [US6] Create Google Colab notebook with setup cells in colab-worker/notebook.ipynb

### Testing - User Story 6

- [ ] T093a [US6] Add WorkerService claim/reassign unit tests in backend/tests/unit/services/test_worker_service.py
- [ ] T093b [US6] Add colab worker polling/result flow tests in colab-worker/tests/test_worker_client.py

**Checkpoint**: End-to-end transcript flow works: Host records → Server queues → Worker processes → Client displays

---

## Phase 5: User Story 2 - Participant Viewing (Priority: P2)

**Goal**: Participants join via room code and see realtime transcript

**Independent Test**: Host records in one browser, participant joins via link in another, both see same transcript

### Backend - Join Meeting

- [x] T094 [US2] Implement GET /join/{room_code} endpoint in backend/src/api/meetings.py
- [x] T095 [US2] Create participant WebSocket endpoint at /ws/meeting/{id}/participant in backend/src/api/websocket.py
- [x] T096 [US2] Track participant count in Redis in backend/src/services/meeting_service.py
- [x] T097 [US2] Broadcast participant_joined/left to all connections in backend/src/api/websocket.py

### Backend - Transcript Sync

- [x] T098 [US2] Handle sync_request from reconnecting participants in backend/src/api/websocket.py
- [x] T099 [US2] Return missed segments in sync_response in backend/src/services/transcript_service.py

### Frontend - Join Flow

- [x] T100 [US2] Create JoinMeeting page at /join/:roomCode in frontend/src/pages/JoinMeeting.tsx
- [x] T101 [US2] Connect to participant WebSocket endpoint in frontend/src/hooks/useMeetingWebSocket.ts
- [x] T102 [US2] Reuse TranscriptView component for participant view in frontend/src/pages/JoinMeeting.tsx
- [x] T103 [US2] Show participant count indicator in frontend/src/components/ParticipantCount.tsx
- [x] T104 [US2] Handle reconnection and sync for participants in frontend/src/hooks/useMeetingWebSocket.ts

### Testing - User Story 2

- [ ] T104a [US2] Add participant join/reconnect integration tests in backend/tests/integration/test_participant_join.py
- [ ] T104b [US2] Add frontend JoinMeeting transcript sync tests in frontend/tests/unit/pages/JoinMeeting.test.tsx

**Checkpoint**: Multiple users can view same transcript in real-time

---

## Phase 6: User Story 3 - Realtime Translation (Priority: P3)

**Goal**: Users select target language and see translation alongside transcript

**Independent Test**: Host speaks Vietnamese, participant selects English, sees English translation appear

### Backend - Translation Service

- [x] T105 [US3] Create TranslationService with Google Cloud integration in backend/src/services/translation_service.py
- [x] T106 [US3] Implement on-demand translation for segments in backend/src/services/translation_service.py
- [x] T107 [US3] Cache translations in SegmentTranslation table in backend/src/services/translation_service.py
- [x] T108 [US3] Implement POST /meetings/{id}/translate endpoint in backend/src/api/meetings.py

### Backend - Translation WebSocket

- [x] T109 [US3] Handle set_language message from clients in backend/src/api/websocket.py
- [x] T110 [US3] Trigger backfill translation for existing segments in backend/src/services/translation_service.py
- [x] T111 [US3] Send translation_segment messages to subscribed clients in backend/src/api/websocket.py
- [x] T112 [US3] Send translation_backfill_complete when done in backend/src/api/websocket.py

### Frontend - Language Selection

- [x] T113 [US3] Create LanguageSelector component in frontend/src/components/LanguageSelector.tsx
- [x] T114 [US3] Send set_language message when language selected in frontend/src/hooks/useMeetingWebSocket.ts
- [x] T115 [US3] Handle translation_segment messages in store in frontend/src/stores/transcriptStore.ts
- [x] T116 [US3] Display translation alongside original in TranscriptView in frontend/src/components/TranscriptView.tsx
- [x] T117 [US3] Show translation loading indicator during backfill in frontend/src/components/TranscriptView.tsx

### Testing - User Story 3

- [ ] T117a [US3] Add TranslationService unit tests in backend/tests/unit/services/test_translation_service.py
- [ ] T117b [US3] Add TranscriptView translation rendering tests in frontend/tests/unit/components/TranscriptView.test.tsx

**Checkpoint**: Real-time translation working for Vietnamese → English/Japanese/etc

---

## Phase 7: User Story 4 - Meeting Summary (Priority: P4)

**Goal**: Generate summary with key points, decisions, action items after meeting

**Independent Test**: End a meeting with transcript, click "Generate Summary", see structured summary

### Backend - Summary Service

- [x] T118 [US4] Create SummaryService with OpenAI integration in backend/src/services/summary_service.py
- [x] T119 [US4] Implement hierarchical summarization (chunk → merge) in backend/src/services/summary_service.py
- [x] T120 [US4] Extract key_points, decisions, action_items as JSON in backend/src/services/summary_service.py
- [x] T121 [US4] Implement POST /meetings/{id}/summary endpoint in backend/src/api/meetings.py
- [x] T122 [US4] Implement GET /meetings/{id}/summary endpoint in backend/src/api/meetings.py
- [x] T123 [US4] Support on-demand summary during meeting (partial transcript) in backend/src/services/summary_service.py

### Frontend - Summary Display

- [x] T124 [US4] Create SummaryView component in frontend/src/components/SummaryView.tsx
- [x] T125 [US4] Create "Generate Summary" button in MeetingRoom in frontend/src/pages/MeetingRoom.tsx
- [x] T126 [US4] Show summary loading state (< 60s) in frontend/src/components/SummaryView.tsx
- [x] T127 [US4] Display key points, decisions, action items with formatting in frontend/src/components/SummaryView.tsx

### Testing - User Story 4

- [ ] T127a [US4] Add SummaryService unit tests in backend/tests/unit/services/test_summary_service.py
- [ ] T127b [US4] Add SummaryView frontend tests in frontend/tests/unit/components/SummaryView.test.tsx

**Checkpoint**: Meeting summary generation working

---

## Phase 8: User Story 5 - Meeting History & Replay (Priority: P5)

**Goal**: Host sees meeting list; anyone with room code can view past transcript/translation/summary

**Independent Test**: After meeting ends, open history page, select meeting, see full transcript and summary

### Backend - History API

- [x] T128 [US5] Implement GET /meetings list endpoint with pagination in backend/src/api/meetings.py
- [x] T129 [US5] Implement GET /meetings/{id}/transcript with pagination in backend/src/api/meetings.py
- [x] T130 [US5] Implement GET /meetings/{id}/transcript/search endpoint in backend/src/api/meetings.py
- [x] T131 [US5] Create PostgreSQL full-text search on transcript_segments in backend/src/services/transcript_service.py

### Frontend - History Page

- [x] T132 [US5] Create History page listing past meetings in frontend/src/pages/History.tsx
- [x] T133 [US5] Show meeting metadata (title, date, duration, has_summary) in frontend/src/pages/History.tsx
- [x] T134 [US5] Create MeetingReplay page for viewing past meetings in frontend/src/pages/MeetingReplay.tsx
- [x] T135 [US5] Implement transcript pagination/infinite scroll in frontend/src/pages/MeetingReplay.tsx
- [x] T136 [US5] Implement search within transcript in frontend/src/components/TranscriptSearch.tsx
- [x] T137 [US5] Allow requesting translation for unseen languages in frontend/src/pages/MeetingReplay.tsx
- [x] T138 [US5] Allow generating summary for meetings without one in frontend/src/pages/MeetingReplay.tsx

### Participant Access to History

- [ ] T139 [US5] Implement participant replay backend support for ended meetings in backend/src/api/meetings.py
- [ ] T139a [US5] Implement ended-meeting room code lookup in backend/src/api/meetings.py
- [ ] T139b [US5] Authorize anonymous replay access for valid ended meetings in backend/src/services/meeting_service.py
- [ ] T139c [US5] Return replay transcript/translation/summary payload for participant access in backend/src/api/meetings.py
- [ ] T139d [US5] Add participant replay integration tests in backend/tests/integration/test_participant_replay.py
- [x] T140 [US5] Create participant replay route at /join/:roomCode (past meeting) in frontend/src/pages/JoinMeeting.tsx

### Testing - User Story 5

- [ ] T140a [US5] Add History and MeetingReplay frontend tests in frontend/tests/unit/pages/MeetingReplay.test.tsx

**Checkpoint**: Full meeting history and replay functionality

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

### Performance & Reliability

- [ ] T141 [P] Implement WebSocket connection pooling in backend/src/core/websocket_manager.py
- [ ] T142 [P] Add request logging middleware in backend/src/main.py
- [ ] T143 [P] Configure rate limiting per endpoint in backend/src/core/middleware.py
- [ ] T144 [P] Optimize transcript_segments query with proper indexes in backend/alembic/versions/
- [ ] T145 [P] Implement lazy loading for heavy components in frontend/src/App.tsx
- [ ] T155 [P] Add load test for 10 concurrent participants receiving transcript events in backend/tests/performance/test_participant_fanout.py
- [ ] T156 [P] Add soak test for 2+ hour meeting stability in backend/tests/performance/test_long_running_meeting.py
- [ ] T157 [P] Measure replay page load time against SC-009 in frontend/tests/performance/replay-load.test.ts
- [ ] T158 [P] Measure translation latency against SC-004 in backend/tests/performance/test_translation_latency.py
- [ ] T159 [P] Measure summary generation time against SC-005 in backend/tests/performance/test_summary_latency.py

### Error Handling & UX

- [x] T146 [P] Add error boundaries in frontend/src/components/ErrorBoundary.tsx
- [x] T147 [P] Create toast notifications for errors/success in frontend/src/components/Notifications.tsx
- [x] T148 [P] Add loading skeletons for async content in frontend/src/components/Skeleton.tsx

### Accessibility

- [ ] T149 [P] Add ARIA labels to all interactive elements in frontend/src/components/
- [ ] T150 [P] Ensure keyboard navigation works in frontend/src/components/
- [ ] T151 [P] Test color contrast meets WCAG 2.1 AA in frontend/src/theme/
- [ ] T160 [P] Add screen reader announcements for recording, processing, and translation status in frontend/src/components/
- [ ] T161 [P] Add accessibility tests for Login, MeetingRoom, JoinMeeting, History, and MeetingReplay in frontend/tests/accessibility/

### Documentation

- [x] T152 [P] Update quickstart.md with actual setup steps in specs/007-realtime-meeting-transcription/quickstart.md
- [ ] T153 [P] Create API documentation with OpenAPI in backend/docs/
- [ ] T154 Run full validation per quickstart.md end-to-end flow
- [ ] T162 [P] Document worker polling lifecycle and retry behavior in backend/docs/worker-architecture.md
- [ ] T163 [P] Document replay access and security model in backend/docs/replay-access.md
- [ ] T164 [P] Document translation caching and summary architecture decisions in backend/docs/architecture-decisions.md

### Validation & Quality Gates

- [ ] T165 Run backend lint and typing validation (ruff format/check, mypy) in backend/
- [ ] T166 Run frontend lint, typecheck, and build validation in frontend/
- [ ] T167 Run backend unit and integration test suites in backend/tests/
- [ ] T168 Run frontend unit and accessibility test suites in frontend/tests/
- [ ] T169 Run Playwright E2E for host -> participant -> replay happy path in frontend/tests/e2e/
- [ ] T170 Verify business-logic branch coverage meets constitution threshold in backend/tests/
- [ ] T171 Verify API docs and quickstart instructions match implemented behavior

### Edge-Case Verification

- [ ] T172 Verify no-worker-online queueing and waiting-state behavior in backend/tests/integration/test_no_worker_queueing.py
- [ ] T173 Verify abrupt host disconnect marks meeting as abnormal end and preserves received data in backend/tests/integration/test_abnormal_meeting_end.py
- [ ] T174 Verify reconnect within 30s preserves buffered audio and transcript sync in backend/tests/integration/test_reconnect_buffering.py
- [ ] T175 Verify replay access after meeting end using shared link or room code in backend/tests/integration/test_replay_access.py
- [ ] T176 Verify on-demand generation and caching for unseen replay translation languages in backend/tests/integration/test_replay_translation_generation.py

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational. UI/API implementation can proceed independently, but end-to-end MVP validation requires US6.
- **US6 (Phase 4)**: Depends on Foundational and must reach polling/result readiness before US1 can be considered end-to-end complete.
- **US2 (Phase 5)**: Depends on US1 (needs working transcript flow)
- **US3 (Phase 6)**: Depends on US1 (needs transcript segments to translate)
- **US4 (Phase 7)**: Depends on US1 (needs transcript to summarize)
- **US5 (Phase 8)**: Depends on US1, US3, US4 (needs data to view in history)
- **Polish (Phase 9)**: Depends on all user stories being functional

### User Story Dependencies

```
Foundational (Phase 2)
        │
        ├─────────────────────────┐
        ▼                         ▼
    US6 (Worker)             US1 (Host Recording)
        │                         │
        └──────────┬──────────────┘
                   │
                   ▼
         US1 + US6 = End-to-End MVP
                   │
        ┌──────────┼──────────┬──────────┐
        ▼          ▼          ▼          │
      US2        US3        US4          │
    (Participant) (Translation) (Summary) │
        │          │          │          │
        └──────────┴──────────┴──────────┘
                   │
                   ▼
                 US5
            (History/Replay)
```

### Parallel Opportunities

**Within Setup (Phase 1):**
- T002, T003, T004 (project init) in parallel
- T005, T006, T007, T008, T009 (config files) in parallel

**Within Foundational (Phase 2):**
- T012-T017 (all models) in parallel
- T031, T032, T033 (stores) in parallel
- T039, T040 (auth pages) in parallel

**After Foundational:**
- US1 backend and frontend tasks can run in parallel within the story
- US6 (Worker) can start in parallel with US1, but MVP validation must wait until both US1 and US6 are complete

**After US1 + US6 complete:**
- US2, US3, US4 can start in parallel (different features, different files)

---

## Parallel Example: User Story 1 Backend

```bash
# Models already done in Foundational, so launch services in parallel:
Task: T041 "Create MeetingService in backend/src/services/meeting_service.py"
Task: T047 "Create AudioChunkService in backend/src/services/audio_chunk_service.py"
Task: T055 "Create TranscriptService in backend/src/services/transcript_service.py"

# Then launch API endpoints in parallel:
Task: T042 "POST /meetings endpoint"
Task: T043 "GET /meetings/{id} endpoint"
Task: T048 "POST /meetings/{id}/audio endpoint"
Task: T050 "Host WebSocket endpoint"
```

---

## Implementation Strategy

### MVP First (US1 + US6 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: User Story 1 (Host Recording)
4. Complete Phase 4: User Story 6 (Worker) - needed for transcription
5. **STOP and VALIDATE**: Test end-to-end: record → transcript appears
6. Deploy/demo if ready - this is the core value proposition

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 + US6 → **MVP: Host can record and see transcript**
3. Add US2 → Participants can view
4. Add US3 → Translation works
5. Add US4 → Summary generation
6. Add US5 → Full history/replay

### Task Counts

| Phase | Tasks |
|-------|-------|
| Phase 1: Setup | 9 |
| Phase 2: Foundational | 33 |
| Phase 3: US1 (Host Recording) | 39 |
| Phase 4: US6 (Worker) | 19 |
| Phase 5: US2 (Participant) | 13 |
| Phase 6: US3 (Translation) | 15 |
| Phase 7: US4 (Summary) | 12 |
| Phase 8: US5 (History) | 18 |
| Phase 9: Polish | 36 |
| **Total** | **194** |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US6 (Worker) implemented early despite P6 priority because US1 depends on it
- Each user story should be independently completable and testable after its dependencies
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
