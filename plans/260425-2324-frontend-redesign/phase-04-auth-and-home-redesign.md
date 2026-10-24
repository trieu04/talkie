# Phase 04 — Auth and Home Redesign

## Context

- Parent plan: `plan.md`
- Depends on:
  - `phase-02-theme-and-token-expansion.md`
  - `phase-03-shared-app-shell-and-state-primitives.md`
- Related documents:
  - `frontend-redesign-brief.md`
  - `execution-backlog-by-phase.md`

## Overview

This phase modernizes the product entry experience. The auth and home surfaces are not the most complex parts of the product, but they strongly shape first impressions, orientation, and perceived polish. The redesign should make the product easier to enter and easier to act from without spending disproportionate effort on cosmetic flourish.

## Scope

### In scope
- login screen
- registration screen
- home/dashboard screen
- auth shell consistency
- dashboard composition and action hierarchy

### Out of scope
- deep auth behavior changes
- backend auth contract changes
- introducing new dashboard features not already implied by the current product

## File Scope

- `frontend/src/pages/Login.tsx`
- `frontend/src/pages/Register.tsx`
- `frontend/src/pages/Home.tsx`

## Required Outputs

1. Unified auth page structure
2. Improved hierarchy for authentication forms
3. Improved home/dashboard layout and action framing
4. Clear relationship between dashboard and meeting-centered workflows

## Requirements

### Auth requirements
- Login and registration must feel like part of the same system.
- Primary action, helper text, validation states, and alternate path links must be clearly prioritized.
- Dark mode and Vietnamese/English layouts must remain coherent.

### Home requirements
- The create-meeting path must remain the most obvious action.
- Recent meetings must be easy to scan and act on.
- The page should feel connected to history and meeting workflows, not isolated from them.

### Design requirements
- Avoid introducing one-off visual treatments that do not belong to the wider system.
- Use shared primitives wherever possible.

## Acceptance Checklist

- [ ] Login and register screens visibly belong to one auth system.
- [ ] Form hierarchy is clearer than in the current implementation.
- [ ] Home emphasizes primary actions without clutter.
- [ ] Recent meetings and dashboard actions are easy to scan.
- [ ] The redesigned screens consume the shared design-system language.
- [ ] Dark mode and i18n behavior are preserved.

## Risks

- Over-polishing auth pages while under-investing in functional clarity.
- Letting Home diverge from patterns that later need to be reused in History.
- Introducing layout choices that only work on desktop.

## Exit Criteria

Phase 04 exits only when new users can enter the product, understand what to do next, and navigate toward creating, joining, or revisiting meetings with minimal ambiguity.
