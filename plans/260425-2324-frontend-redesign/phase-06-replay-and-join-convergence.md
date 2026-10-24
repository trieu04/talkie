# Phase 06 — Replay and Join Convergence

## Context

- Parent plan: `plan.md`
- Depends on:
  - `phase-03-shared-app-shell-and-state-primitives.md`
  - `phase-05-live-meeting-workspace-redesign.md`
- Related documents:
  - `frontend-redesign-brief.md`
  - `design-system-migration-plan.md`
  - `execution-backlog-by-phase.md`

## Overview

This phase aligns the public join/review experience with the protected replay experience so that both feel like variants of one review surface. The existing codebase already suggests overlap between these pages, and the redesign should turn that overlap into a deliberate experience framework. The resulting tension is that the screens are similar but not identical, so the phase must converge structure without erasing meaningful behavioral differences.

## Scope

### In scope
- replay layout
- join/review layout
- transcript search presentation
- translation and summary presentation for replay-style surfaces
- shared screen composition between public and protected review contexts

### Out of scope
- forcing total component unification where behavior is materially different
- changing access-control behavior
- backend changes unrelated to UI needs

## File Scope

- `frontend/src/pages/JoinMeeting.tsx`
- `frontend/src/pages/MeetingReplay.tsx`
- `frontend/src/components/TranscriptSearch.tsx`
- related shared transcript and summary components where reuse is justified

## Required Outputs

1. Replay surface composition model
2. Shared search interaction pattern
3. Shared transcript review layout rules
4. Guidance on where join and replay should differ intentionally

## Requirements

### UX requirements
- Replay and join must feel structurally related.
- Search, transcript browsing, translation visibility, and summary presentation must follow one interaction language.
- Public access constraints must not make the screen feel like a separate product.

### Reuse requirements
- Shared pieces should be extracted only when the overlap is stable and obvious.
- Divergent behavior should be documented instead of hidden inside fragile abstraction.

### Design requirements
- The replay surface should feel like a calm review mode derived from the meeting workspace.
- Search and pagination affordances must become more legible and consistent.

## Acceptance Checklist

- [ ] Join and replay share a visible design family.
- [ ] Transcript search and review interactions follow one predictable pattern.
- [ ] Summary and translation presentation is consistent across replay surfaces.
- [ ] Duplication is reduced where it is structurally justified.
- [ ] Behavioral differences remain explicit rather than accidental.

## Risks

- Over-abstracting screens that should retain meaningful differences.
- Preserving too much duplication because the phase avoids hard decisions.
- Making replay feel too similar to live in ways that confuse user expectations.

## Exit Criteria

Phase 06 exits only when a user can move between join/review and replay contexts without needing to relearn the screen model.
