# Phase 01 — UI Audit and Baseline Definition

## Context

- Parent plan: `plan.md`
- Related documents:
  - `frontend-redesign-brief.md`
  - `design-system-migration-plan.md`
  - `execution-backlog-by-phase.md`
- Primary purpose: establish the evidence base and baseline artifacts required for every later redesign phase.

## Overview

This phase converts current observations about the frontend into explicit implementation artifacts. The core value of the phase is not design output. It is decision quality. Without a stable baseline, later phases will drift into subjective redesign work, duplicate effort, and accidental scope expansion.

## Scope

### In scope
- route inventory
- page inventory
- shared component inventory
- UX state inventory
- layout pattern inventory
- design inconsistency inventory
- priority user-flow map

### Out of scope
- redesigning visuals
- introducing new shared primitives
- modifying product behavior
- changing API or store contracts

## File Scope

- `frontend/src/App.tsx`
- `frontend/src/main.tsx`
- `frontend/src/pages/*.tsx`
- `frontend/src/components/*.tsx`
- `frontend/src/theme/*.ts*`
- `frontend/src/i18n/index.ts`
- `frontend/index.html`

## Required Outputs

This phase is only complete when the following artifacts exist inside the plan context or are embedded into implementation notes derived from this phase:

1. Route map
2. Screen inventory with purpose and key states
3. Shared component inventory
4. State matrix for loading, empty, error, success, processing, live, paused, reconnecting, completed
5. Visual inconsistency inventory
6. Priority user-flow map
7. Risks that must constrain later design decisions

## Requirements

### Functional requirements
- Every primary route in the current SPA must be listed.
- Every major page must include its purpose, primary actions, key data states, and shared dependencies.
- Every shared component that materially affects the redesign must be classified as:
  - reusable as-is,
  - reusable with redesign,
  - replaceable,
  - or likely to split.

### UX requirements
- The baseline must identify the top user journeys that determine product quality.
- The baseline must record where users experience the most state complexity.
- The baseline must distinguish structural problems from purely visual problems.

### Technical requirements
- Findings must be tied to actual files and not generic assumptions.
- The baseline must identify where hardcoded colors, duplicated layout logic, or unstable screen patterns create redesign constraints.

## Recommended Working Method

1. Read app shell and routing first.
2. Read all route pages.
3. Read shared components used in meeting/replay/history flows.
4. Classify repeated layout and state patterns.
5. Produce the baseline artifacts in a consistent format.
6. Mark unresolved questions that need explicit design decisions later.

## Deliverable Structure

### Route map
Include:
- route path
- auth protection state
- page file
- primary purpose
- major states

### Screen inventory
Include:
- screen name
- primary user task
- key components used
- layout pattern
- state complexity level
- redesign priority

### Inconsistency inventory
Include:
- issue
- files affected
- severity
- impact on redesign
- whether design-system work can solve it

## Acceptance Checklist

- [ ] All routes in `App.tsx` are captured.
- [ ] All major pages under `frontend/src/pages/` are described.
- [ ] Shared components central to transcript, summary, controls, notifications, and language/theme behavior are mapped.
- [ ] A state matrix exists for all key user-facing screens.
- [ ] At least one prioritized flow map exists for auth, create/join, live meeting, replay, and history.
- [ ] Findings are anchored to repository files.
- [ ] No design recommendations are presented as facts without baseline evidence.

## Risks

- Mistaking code complexity for user-facing UX complexity.
- Missing duplicated patterns in replay and live surfaces.
- Recording observations too abstractly to guide later phases.

## Exit Criteria

Phase 01 exits only when the team can answer these questions without reopening broad discovery:

- Which screens matter most?
- Which states are hardest to design well?
- Which components or pages are blocking consistency?
- Which inconsistencies must the design system solve first?
