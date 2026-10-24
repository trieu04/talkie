# Phase 05 — Live Meeting Workspace Redesign

## Context

- Parent plan: `plan.md`
- Depends on:
  - `phase-02-theme-and-token-expansion.md`
  - `phase-03-shared-app-shell-and-state-primitives.md`
- Related documents:
  - `frontend-redesign-brief.md`
  - `design-system-migration-plan.md`
  - `execution-backlog-by-phase.md`

## Overview

This phase redesigns the most strategically important surface in the product: the live meeting workspace. The challenge is multifaceted because this screen must handle high-frequency state changes, transcription content density, recording controls, processing feedback, and summary access without overwhelming the user. The redesign must therefore privilege clarity of action and clarity of state above decorative complexity.

## Scope

### In scope
- meeting layout and section hierarchy
- recording controls presentation
- transcript panel presentation
- processing status presentation
- summary panel presentation
- meeting metadata framing

### Out of scope
- backend or websocket contract redesign
- audio recorder behavior changes unless required for UI integration
- large-scale hook refactors driven only by style preferences

## File Scope

- `frontend/src/pages/MeetingRoom.tsx`
- `frontend/src/components/RecordingControls.tsx`
- `frontend/src/components/TranscriptView.tsx`
- `frontend/src/components/ProcessingStatus.tsx`
- `frontend/src/components/SummaryView.tsx`
- supporting hooks only when UI composition requires limited integration work

## Required Outputs

1. Meeting workspace layout model
2. Recording control hierarchy model
3. Transcript-first content structure
4. Processing and summary state treatment rules
5. Responsive behavior rules for the meeting workspace

## Requirements

### Information hierarchy requirements
- The primary meeting action must be visually obvious in every major state.
- Transcript content must remain readable and central.
- Secondary information must support the meeting flow rather than compete with it.

### State requirements
The redesigned workspace must make the following states distinguishable without cognitive friction:
- ready
- recording
- paused
- processing
- reconnecting
- completed
- summary available

### Layout requirements
- The layout must support sustained reading of transcript content.
- Controls must feel attached to the workflow, not detached widgets.
- Summary and metadata sections must be subordinate to the live transcript unless the state explicitly changes that priority.

## Design Constraints

- Do not mix visual redesign with deep logic rewrites unless strictly required.
- Preserve current product capabilities while improving screen structure.
- Keep dark mode and translation visibility first-class.
- Avoid inventing new one-off component styles that other meeting-like screens cannot reuse.

## Acceptance Checklist

- [ ] Recording states are visually distinguishable and easy to interpret.
- [ ] The transcript remains the primary content surface.
- [ ] Processing and summary feedback are clearer than in the current layout.
- [ ] Controls, transcript, metadata, and summary form a coherent workspace.
- [ ] The page consumes shared primitives and semantic theme rules.
- [ ] The workspace remains usable across key responsive breakpoints.

## Risks

- Treating layout problems as component-level cosmetic issues.
- Over-optimizing for desktop and neglecting smaller widths.
- Letting summary or metadata sections visually compete with the transcript.
- Introducing behavioral regressions while attempting to clean up UI structure.

## Exit Criteria

Phase 05 exits only when the live meeting experience feels like the product’s best-designed surface and communicates system state with less ambiguity than the current implementation.
