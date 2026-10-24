# Phase 03 — Shared App Shell and State Primitives

## Context

- Parent plan: `plan.md`
- Depends on:
  - `phase-01-ui-audit-and-baseline-definition.md`
  - `phase-02-theme-and-token-expansion.md`
- Related document: `design-system-migration-plan.md`

## Overview

This phase introduces the structural primitives that enforce consistency across routes before the team redesigns heavy feature screens. The purpose is to make layout, state, and shell behavior reusable. If this phase is skipped or done superficially, later screen redesign work will revert to page-local composition and the design system will not take hold.

## Scope

### In scope
- app shell pattern
- page header pattern
- page action region pattern
- shared section/panel primitives
- global loading, empty, error, and status patterns
- top-level navigation framing
- notification placement and state messaging patterns

### Out of scope
- full redesign of all screens
- deep business-logic refactor
- speculative component extraction with no repeated use case

## File Scope

- `frontend/src/App.tsx`
- `frontend/src/components/Notifications.tsx`
- `frontend/src/components/LanguageSelector.tsx`
- new or updated reusable components under `frontend/src/components/`

## Required Outputs

1. App shell primitive definitions
2. Shared state primitive definitions
3. Page composition rules
4. Navigation hierarchy rules
5. Notification and feedback placement rules

## Requirements

### App shell requirements
- Every major page must be able to fit inside one page-shell framework.
- The shell must support page title, supporting context, primary actions, and optional secondary actions.
- The shell must work for both protected and public routes.

### State primitive requirements
Define reusable components or patterns for:
- loading
- empty
- error
- processing
- informational status
- lightweight metrics/status chips

### Composition requirements
- Primitives must map to repeated patterns already visible in the codebase.
- Primitives must reduce page-local layout decision-making.
- App shell work must not break route protection or navigation logic.

## Recommended Primitive Inventory

- `PageShell`
- `PageHeader`
- `PageActions`
- `SectionCard`
- `SectionStack`
- `LoadingState`
- `EmptyState`
- `ErrorState`
- `StatusBadge`
- `MetricChip`

## Acceptance Checklist

- [ ] A single shell model can cover auth, dashboard, live, replay, and history contexts with intentional variation.
- [ ] Shared state patterns exist and can replace page-specific loading/empty/error blocks.
- [ ] Global navigation and app framing are clearer than the current shell.
- [ ] Notification placement and page messaging follow one consistent rule set.
- [ ] The phase reduces, rather than increases, future composition entropy.

## Risks

- Building too many primitives before enough screens consume them.
- Making the shell too rigid for meeting-heavy screens.
- Accidentally coupling shell refactor to unrelated store or API behavior.

## Exit Criteria

Phase 03 exits only when at least one route shell and one state-heavy surface can be expressed using the new shared primitives without introducing new ad hoc patterns.
