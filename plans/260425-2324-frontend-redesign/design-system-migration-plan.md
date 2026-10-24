# Design System Migration Plan

## Overview

The central design problem in the current frontend is not the absence of theming, but the absence of a sufficiently expressive system that can govern screen composition and state presentation at scale. Talkie already uses MUI and has a base theme, yet many visual decisions still happen locally in page code. This migration plan defines how to evolve that foundation into a practical design system without replacing the current stack.

## Current State Summary

The existing frontend already provides:

- MUI-based component infrastructure,
- dark and light theme support,
- typography and button baseline configuration,
- reusable components for transcript, summary, notifications, and recording controls,
- route-level composition through `App.tsx`.

However, the present theme is too shallow to fully control:

- semantic color usage,
- surface hierarchy,
- layout spacing rules,
- panel composition,
- loading/error/empty state language,
- consistency across live and replay UI.

## Migration Strategy

The migration should proceed as a layered adoption effort rather than a full replacement of existing components.

### Layer 1 — Semantic tokens
Expand the theme from low-level palette values into semantic UI roles.

### Layer 2 — Shared primitives
Create reusable screen and section primitives that encode layout, spacing, and state behavior.

### Layer 3 — Feature composition
Refactor major pages to consume primitives rather than page-local styling patterns.

### Layer 4 — Hardening
Remove theme bypasses, reconcile duplication, and enforce consistency in dark mode and i18n contexts.

## Target Design System Architecture

### 1. Semantic tokens
The theme should define semantic tokens that express product intent rather than raw color choices.

#### Required token groups
- **Surface tokens**
  - app background
  - page background
  - raised surface
  - muted surface
  - overlay surface
- **Border tokens**
  - subtle border
  - default border
  - strong border
- **Text tokens**
  - primary
  - secondary
  - muted
  - inverse
  - status text
- **Action tokens**
  - primary action
  - secondary action
  - destructive action
  - focus ring
- **State tokens**
  - success
  - warning
  - error
  - info
  - processing
  - paused
  - active/live
- **Transcript tokens**
  - speaker block
  - translation block
  - highlighted search result
  - current playback position
- **Summary tokens**
  - key point
  - decision
  - action item

### 2. Layout tokens
The redesign should standardize:

- spacing scale,
- page max widths,
- panel gap rules,
- section spacing,
- border radius tiers,
- elevation tiers,
- sticky header offsets,
- mobile/tablet/desktop layout thresholds.

### 3. Typography roles
Typography should move from generic heading/body defaults to explicit UI roles such as:

- page title,
- section title,
- card title,
- supporting meta text,
- status label,
- transcript body,
- translation body,
- helper text,
- inline control label.

### 4. Interaction states
A mature design system for Talkie must standardize how controls and panels behave in:

- hover,
- focus,
- active,
- disabled,
- selected,
- loading,
- recording/live,
- reconnecting,
- completed states.

## Required Shared Primitives

The following primitives should be introduced or formalized before redesigning major screens:

### App-level primitives
- `PageShell`
- `PageHeader`
- `PageActions`
- `SectionCard`
- `SectionStack`
- `SplitPanel`
- `StickyToolbar`

### State primitives
- `LoadingState`
- `EmptyState`
- `ErrorState`
- `ProcessingState`
- `StatusBadge`
- `MetricChip`

### Content primitives
- `TranscriptPanel`
- `SummaryPanel`
- `SearchPanel`
- `ControlPanel`
- `MeetingMetaPanel`

### Form primitives
- `AuthFormShell`
- `FormSection`
- `FieldHint`
- `PrimarySubmitBar`

The precise filenames may vary, but the primitive roles should be explicit and reusable.

## File-Level Migration Targets

The design-system effort should begin from the following files:

- `frontend/src/theme/theme.ts`
- `frontend/src/theme/ThemeProvider.tsx`
- `frontend/src/App.tsx`
- `frontend/src/components/RecordingControls.tsx`
- `frontend/src/components/TranscriptView.tsx`
- `frontend/src/components/SummaryView.tsx`
- `frontend/src/components/TranscriptSearch.tsx`
- `frontend/src/components/Notifications.tsx`
- `frontend/src/components/LanguageSelector.tsx`

These files provide the strongest leverage because they either define the global visual system or represent reusable experience patterns.

## Design-System Adoption Order

### Step 1 — Strengthen theme foundation
Update `theme.ts` so the system can express semantic roles needed by all pages.

### Step 2 — Build primitives without changing page intent
Introduce shared primitives that wrap existing MUI patterns while preserving current functionality.

### Step 3 — Migrate global shell and state patterns
Apply the system to `App.tsx`, top-level layout, notifications, suspense/loading boundaries, and page wrappers.

### Step 4 — Migrate highest-value experiences
Adopt the design system in this order:

1. `MeetingRoom.tsx`
2. `MeetingReplay.tsx` and `JoinMeeting.tsx`
3. `Home.tsx`
4. `History.tsx`
5. `Login.tsx` and `Register.tsx`

This order reflects product leverage rather than implementation convenience.

### Step 5 — Remove bypasses and duplication
Eliminate hardcoded colors, reduce repeated layout code, and unify transcript/replay screen language.

## Governance Rules

To stop the system from decaying after rollout, the following rules should govern future UI changes:

- New core UI should use semantic tokens instead of literal colors.
- New pages should be composed from shared shell and state primitives.
- Shared states must use system components before page-specific fallback UI is introduced.
- Dark mode and English/Vietnamese content must be verified for every redesigned screen.
- Exceptions should be deliberate and documented, not accidental.

## Risks

### Risk 1 — Token system too abstract
If tokens become theoretical and detached from real screens, adoption will stall. The solution is to define tokens from actual screen needs in meeting, replay, and dashboard contexts.

### Risk 2 — Primitive explosion
If too many abstractions are created too early, implementation will become slower and harder to reason about. The solution is to only create primitives that correspond to repeated patterns already visible in the repo.

### Risk 3 — Theme migration without screen migration
If the theme grows but pages keep using local overrides, the redesign will produce little practical improvement. The solution is to couple token introduction with phase-based screen adoption.

### Risk 4 — Incomplete state design
If live/processing/reconnecting states remain ad hoc, the product will still feel inconsistent. The solution is to define state components as first-class primitives.

## Acceptance Criteria

This migration plan is complete when it provides a team with:

- a clear semantic token model,
- a concrete primitive inventory,
- a phased adoption order,
- rules for using the system,
- and enough structure to redesign screens without abandoning MUI or rewriting the stack.
