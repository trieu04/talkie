# Frontend Redesign Brief

## Overview

The core tension in Talkie’s frontend is that the product already delivers substantial functionality, yet the interface still feels like a collection of capable screens rather than a unified meeting workspace. The redesign therefore should not be framed as a cosmetic refresh. It needs to align interaction design, information hierarchy, layout grammar, and component reuse so that the application feels coherent across authentication, dashboard, live meeting, replay, and history flows.

This brief defines the target outcomes, scope, product priorities, constraints, and acceptance criteria for a full frontend redesign of the Talkie application.

## Product Context

Talkie is a real-time meeting transcription and translation platform with the following core capabilities:

- live transcription during meetings,
- multi-language translation,
- AI-generated summaries,
- participant sharing via room codes,
- meeting history and replay,
- authenticated host workflows.

The current frontend is a React 18 + Vite + TypeScript single-page application using MUI, Zustand, i18next, and axios.

## Redesign Goals

The redesign should optimize for the following goals, in this order:

1. **Unify UX and visual language across the product.**
   The app should feel like one product system rather than separate surfaces built at different times.

2. **Improve usability in high-value meeting workflows.**
   The live meeting experience, replay experience, and meeting access flows should become easier to understand and faster to operate.

3. **Standardize the frontend through a practical design system.**
   The redesign must produce reusable primitives, semantic tokens, and layout rules that reduce future inconsistency.

4. **Reduce delivery risk through phased migration.**
   The redesign should preserve the existing stack and avoid a big-bang rewrite.

5. **Strengthen dark mode, i18n consistency, and state clarity.**
   The app already supports these dimensions, but they need to become part of the core UI system rather than incidental features.

## Non-Goals

To keep the redesign tractable, the following are out of scope unless later approved explicitly:

- replacing React, Vite, MUI, Zustand, or react-router,
- redesigning backend APIs as part of the initial frontend redesign effort,
- introducing SSR or a new rendering architecture,
- rewriting state management purely for style reasons,
- changing the product feature set beyond what is required to support better UX.

## In-Scope Surfaces

The redesign covers all primary user-facing frontend routes and their shared shells:

- `frontend/src/pages/Login.tsx`
- `frontend/src/pages/Register.tsx`
- `frontend/src/pages/Home.tsx`
- `frontend/src/pages/JoinMeeting.tsx`
- `frontend/src/pages/MeetingRoom.tsx`
- `frontend/src/pages/MeetingReplay.tsx`
- `frontend/src/pages/History.tsx`
- `frontend/src/App.tsx`
- global app shell, page layout patterns, notifications, loading states, and error states
- theme, token, and visual foundation files under `frontend/src/theme/`
- reusable view components under `frontend/src/components/`

## Priority User Flows

The redesign should prioritize these flows because they have the highest product value and strongest impact on perceived quality:

1. **Authenticate and enter the product**
   - register
   - log in
   - understand next action

2. **Create or join a meeting**
   - create from dashboard
   - enter via room code or route link
   - understand meeting status immediately

3. **Run a live meeting**
   - recording controls
   - live transcript visibility
   - translation visibility
   - processing status and summary access

4. **Replay and review a meeting**
   - navigate transcript
   - search transcript
   - load translations
   - generate or view summary

5. **Browse past meetings**
   - scan list
   - detect state
   - reopen replay/live route quickly

## UX Problems to Solve

The redesign is expected to address the following repository-specific issues:

- fragmented visual patterns between auth, dashboard, meeting, and replay/history screens,
- over-reliance on inline `sx` and page-local styling decisions,
- hardcoded colors that bypass the theme system,
- duplicated live/replay interaction patterns,
- weak page-shell hierarchy and navigation language,
- inconsistent handling of loading, empty, error, and processing states,
- insufficiently systematized dark mode and localization details.

## Design Principles

The redesign should be guided by the following principles:

### 1. Product before decoration
Every screen should optimize for user intent and decision-making before visual flourish.

### 2. Content-first meeting workspace
Transcript, status, summary, and meeting actions should be visually structured around task importance, not around arbitrary card stacking.

### 3. One design language, many contexts
Auth, dashboard, live meeting, replay, and history may differ in behavior, but they should feel like variations within one system.

### 4. State clarity over cleverness
Recording, paused, processing, reconnecting, loading, empty, and completed states should always be legible.

### 5. Progressive migration
The design system should be introduced in layers so the app remains stable while screens are redesigned.

## Constraints

The redesign plan must respect these constraints:

- **Stack constraint:** Keep React + Vite + MUI + Zustand + i18next.
- **Routing constraint:** Maintain SPA routing via react-router.
- **Contract constraint:** Avoid backend/API contract changes in the early redesign phases.
- **Localization constraint:** Support Vietnamese and English throughout the redesign.
- **Theme constraint:** Dark mode remains supported, not deferred.
- **Delivery constraint:** Prefer phased rollout over full replacement.
- **Maintainability constraint:** The resulting UI system should reduce ad hoc styling, not merely rearrange it.

## Success Metrics

The redesign should be considered successful when the following outcomes are true:

### Qualitative outcomes
- The app feels visually coherent across all major screens.
- Users can distinguish primary actions and system states immediately.
- Live and replay experiences feel intentionally related rather than separately built.
- Dashboard, auth, and history screens match the same product identity.

### Structural outcomes
- Shared primitives exist for page shell, headers, state panels, section containers, and status indicators.
- Hardcoded colors in core UI components are replaced with semantic theme usage.
- Major screens depend more on common layout and state patterns than on page-local styling.

### Delivery outcomes
- The redesign can be shipped in phases without freezing the entire frontend.
- Each phase has explicit acceptance criteria and bounded file scope.

## Acceptance Criteria for the Brief

This brief is complete when it provides enough guidance for the team to:

- agree on what “full frontend redesign” means in this repository,
- prioritize the most important user journeys,
- distinguish goals from non-goals,
- preserve critical technical constraints,
- and use the brief as input to the design-system and phased execution documents.
