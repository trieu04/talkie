# Execution Backlog by Phase

## Overview

The primary delivery challenge in a full frontend redesign is sequencing the work so that the team gains consistency quickly without destabilizing the live product. This backlog breaks the redesign into bounded phases with explicit file scope, outputs, dependencies, risks, and acceptance criteria.

## Delivery Model

The recommended model is phased migration, not a big-bang rewrite.

Each phase should:

- preserve application functionality,
- keep the frontend runnable,
- deliver visible UX improvements,
- and increase system leverage for later phases.

## Phase 01 — UI Audit and Baseline Definition

### Objective
Create an authoritative baseline of current screens, shared components, UX states, and inconsistencies so later work is driven by evidence rather than intuition.

### File Scope
- `frontend/src/App.tsx`
- `frontend/src/pages/*.tsx`
- `frontend/src/components/*.tsx`
- `frontend/src/theme/*.ts*`
- `frontend/src/i18n/index.ts`

### Deliverables
- route and page inventory
- component inventory
- state matrix for loading, empty, error, processing, and live states
- visual inconsistency inventory
- prioritized user-flow map

### Dependencies
- none

### Risks
- underestimating duplicated patterns in live/replay surfaces
- conflating functional defects with design issues

### Acceptance Criteria
- all primary routes are covered,
- major reusable components are mapped,
- and the redesign scope is grounded in repository evidence.

## Phase 02 — Theme and Token Expansion

### Objective
Upgrade the current MUI theme into a semantic system that can support a full redesign.

### File Scope
- `frontend/src/theme/theme.ts`
- `frontend/src/theme/ThemeProvider.tsx`
- optional shared type/helpers under `frontend/src/theme/`

### Deliverables
- semantic color roles
- spacing, radius, elevation, and layout rules
- typography role mapping
- dark/light parity rules
- state token definitions for live, paused, processing, success, warning, and error contexts

### Dependencies
- Phase 01 baseline

### Risks
- token naming too abstract to adopt,
- token model not reflecting transcript-heavy UI needs

### Acceptance Criteria
- the theme can express app surfaces without relying on literal colors,
- core UI states have token support,
- and dark/light behavior remains coherent.

## Phase 03 — Shared App Shell and State Primitives

### Objective
Introduce the reusable layout and state primitives that all major screens will depend on.

### File Scope
- `frontend/src/App.tsx`
- `frontend/src/components/Notifications.tsx`
- `frontend/src/components/LanguageSelector.tsx`
- new or refactored shared components under `frontend/src/components/`

### Deliverables
- page shell pattern
- page header pattern
- section container pattern
- loading, empty, error, and status primitives
- improved top-level navigation and content framing

### Dependencies
- Phase 02 token foundation

### Risks
- over-abstracting too early,
- breaking current route structure or auth gating

### Acceptance Criteria
- new shared primitives are used by at least the app shell,
- route-level UX states are more consistent,
- and the global layout language is clearer than the current version.

## Phase 04 — Auth and Home Redesign

### Objective
Modernize first-use and dashboard experiences so product entry becomes clearer and more coherent.

### File Scope
- `frontend/src/pages/Login.tsx`
- `frontend/src/pages/Register.tsx`
- `frontend/src/pages/Home.tsx`

### Deliverables
- unified auth shell
- clearer form hierarchy and validation presentation
- improved create-meeting dashboard composition
- stronger relationship between dashboard and the rest of the product language

### Dependencies
- Phase 03 primitives

### Risks
- spending too much effort polishing low-leverage visuals,
- not aligning Home with meeting-centric workflows

### Acceptance Criteria
- auth pages clearly belong to the same product system,
- Home supports primary actions with stronger hierarchy,
- and dark mode/i18n remain intact.

## Phase 05 — Live Meeting Workspace Redesign

### Objective
Turn the live meeting experience into the strongest and most intentional surface in the product.

### File Scope
- `frontend/src/pages/MeetingRoom.tsx`
- `frontend/src/components/RecordingControls.tsx`
- `frontend/src/components/TranscriptView.tsx`
- `frontend/src/components/ProcessingStatus.tsx`
- `frontend/src/components/SummaryView.tsx`
- supporting hooks only if view integration requires it

### Deliverables
- restructured meeting layout
- clearer control hierarchy
- transcript-first information architecture
- more legible processing and summary states
- better section relationships between metadata, controls, transcript, and summary

### Dependencies
- Phase 02 and Phase 03

### Risks
- accidental mixing of UX redesign with deep behavioral refactor,
- insufficient treatment of recording and processing states,
- layout regressions on smaller screens

### Acceptance Criteria
- recording, paused, processing, and live states are immediately understandable,
- transcript readability improves,
- and meeting controls feel integrated rather than attached.

## Phase 06 — Replay and Join Convergence

### Objective
Unify replay-style experiences so public review and protected replay share one design language and reusable UI structure.

### File Scope
- `frontend/src/pages/JoinMeeting.tsx`
- `frontend/src/pages/MeetingReplay.tsx`
- `frontend/src/components/TranscriptSearch.tsx`
- related shared transcript and summary components

### Deliverables
- shared replay screen framework
- consistent transcript search and filtering presentation
- aligned summary and translation treatment
- reduced duplication in screen composition

### Dependencies
- Phase 05 patterns, because replay and live should feel related

### Risks
- forcing abstraction where behavior still differs materially,
- preserving old duplication due to time pressure

### Acceptance Criteria
- replay and join experiences feel structurally related,
- users can search, review, and interpret transcript state consistently,
- and screen-level duplication is reduced.

## Phase 07 — History Experience Redesign

### Objective
Improve meeting discoverability and make history feel like a reliable knowledge archive rather than a plain list.

### File Scope
- `frontend/src/pages/History.tsx`
- any extracted list/card primitives used by Home and History

### Deliverables
- improved browsing hierarchy
- clearer meeting state presentation
- better scanning and action affordances
- alignment with dashboard patterns where appropriate

### Dependencies
- Phase 03 primitives
- optional reuse from Home redesign

### Risks
- overdesigning a list view without improving task efficiency,
- divergence from Home listing patterns

### Acceptance Criteria
- users can identify and reopen relevant meetings faster,
- history feels visually aligned with the rest of the redesigned product,
- and the page no longer relies on a one-off card language.

## Phase 08 — Consistency Hardening and QA

### Objective
Remove remaining inconsistencies and prove that the redesign behaves as one system.

### File Scope
- all redesigned pages and shared components
- `frontend/index.html`
- `frontend/src/i18n/index.ts`

### Deliverables
- hardcoded color cleanup in critical components
- language/document metadata cleanup
- dark mode verification pass
- responsive verification pass
- accessibility verification pass for focus, contrast, and primary keyboard paths

### Dependencies
- completion of prior phases

### Risks
- leaving “temporary” exceptions in place,
- failing to validate state-heavy screens comprehensively

### Acceptance Criteria
- semantic theme usage is dominant across redesigned screens,
- major states render consistently in light and dark themes,
- English and Vietnamese views remain coherent,
- and the redesigned app passes a final consistency review.

## Cross-Phase Delivery Rules

The following rules apply across all phases:

1. Keep the current stack and routing model.
2. Avoid backend contract changes unless a later approved phase explicitly requires them.
3. Prefer screen-level convergence over speculative abstraction.
4. Validate dark mode and i18n on every redesigned screen.
5. Preserve functional behavior while changing information hierarchy and visual structure.
6. Keep the product shippable between phases.

## Suggested Implementation Order

The prevailing trade-off is between product leverage and delivery safety. The recommended order is:

1. Phase 01
2. Phase 02
3. Phase 03
4. Phase 05
5. Phase 06
6. Phase 04
7. Phase 07
8. Phase 08

This order prioritizes the live and replay experience ahead of lower-stakes cosmetic surfaces because those flows define the product’s perceived competence.

## Definition of Done for the Backlog

This backlog is complete when a delivery team can use it to:

- execute the redesign in bounded phases,
- identify which files each phase touches,
- understand dependencies and risks,
- and verify phase completion through explicit acceptance criteria.
