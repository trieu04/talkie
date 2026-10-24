---
status: proposed
created: 2026-04-25
updated: 2026-04-25
owner: claude
blockedBy: []
blocks: []
---

# Frontend Redesign Plan Set

## Overview

This plan set defines the strategy to redesign the entire frontend of Talkie without changing the core product stack or turning the work into a risky big-bang rewrite. The frontend already has strong product capabilities, but the user interface language, screen structure, and component patterns are fragmented across authentication, dashboard, meeting, replay, and history surfaces.

The plan set is organized into three documents:

1. `frontend-redesign-brief.md` — product and UX framing, scope, constraints, and success criteria.
2. `design-system-migration-plan.md` — visual foundation, semantic tokens, shared primitives, and adoption strategy.
3. `execution-backlog-by-phase.md` — implementation phases, file scope, deliverables, dependencies, risks, and acceptance criteria.

## Objectives

- Unify the visual and interaction language across all major frontend screens.
- Build a usable design system on top of the current React + Vite + MUI stack.
- Reduce duplicated view patterns across live meeting and replay experiences.
- Create a phased migration path that keeps the application shippable throughout the redesign.

## Repository Evidence Base

The redesign plan is based on the current frontend architecture and key files in this repository, especially:

- `frontend/src/App.tsx`
- `frontend/src/main.tsx`
- `frontend/src/theme/theme.ts`
- `frontend/src/theme/ThemeProvider.tsx`
- `frontend/src/i18n/index.ts`
- `frontend/src/pages/Home.tsx`
- `frontend/src/pages/Login.tsx`
- `frontend/src/pages/Register.tsx`
- `frontend/src/pages/JoinMeeting.tsx`
- `frontend/src/pages/MeetingRoom.tsx`
- `frontend/src/pages/MeetingReplay.tsx`
- `frontend/src/pages/History.tsx`
- `frontend/src/components/RecordingControls.tsx`
- `frontend/src/components/TranscriptView.tsx`
- `frontend/src/components/SummaryView.tsx`
- `frontend/src/components/TranscriptSearch.tsx`

## Key Findings

- The app already has a theme, dark mode, route structure, i18n, and a set of reusable UI components, but these foundations are not yet strong enough to enforce consistent screen composition.
- Auth, dashboard, meeting, and replay/history surfaces use different layout and styling idioms, which creates a fragmented product feel.
- Inline `sx` usage and hardcoded colors reduce the leverage of the existing theme system.
- `MeetingRoom`, `JoinMeeting`, and `MeetingReplay` carry overlapping interaction models but do not yet share enough screen-level UI primitives.
- Loading, empty, error, and processing states are functionally present but not systematized into one coherent UX framework.

## Phase Summary

| Phase | Purpose | Output |
|---|---|---|
| 01 | Define product and UX direction | `frontend-redesign-brief.md` |
| 02 | Define visual system and migration model | `design-system-migration-plan.md` |
| 03 | Define phased execution and validation | `execution-backlog-by-phase.md` |

## Success Criteria

The redesign plan is successful when it gives the team an execution-ready roadmap that:

- identifies what is in scope and out of scope,
- preserves the current product stack,
- prioritizes high-value user flows,
- defines reusable design-system primitives,
- sequences the implementation into low-risk phases,
- and provides acceptance criteria that can be verified during delivery.
