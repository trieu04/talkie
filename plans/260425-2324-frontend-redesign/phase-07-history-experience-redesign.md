# Phase 07 — History Experience Redesign

## Context

- Parent plan: `plan.md`
- Depends on:
  - `phase-03-shared-app-shell-and-state-primitives.md`
  - `phase-04-auth-and-home-redesign.md`
- Related document: `execution-backlog-by-phase.md`

## Overview

This phase repositions History as a reliable archive and re-entry surface rather than a utilitarian list. The principal trade-off is between richness and speed: the page must become more structured and coherent without becoming slower to scan or harder to use. The redesign should align History with the dashboard and replay ecosystem while preserving straightforward retrieval behavior.

## Scope

### In scope
- history page layout
- meeting item hierarchy
- state labeling and action visibility
- alignment with Home list/card patterns where beneficial

### Out of scope
- introducing advanced archive features not implied by the current product
- changing the underlying history data contract for speculative reasons

## File Scope

- `frontend/src/pages/History.tsx`
- any shared listing/card primitives reused with `Home.tsx`

## Required Outputs

1. History page hierarchy model
2. Meeting item/card pattern
3. Status presentation rules
4. Alignment rules between Home and History listing behavior

## Requirements

### Usability requirements
- Users must be able to quickly identify which meetings matter.
- Entry points to replay or live meeting routes must remain obvious.
- Status and metadata must support scanning, not clutter it.

### Consistency requirements
- History should belong to the same product system as Home and replay.
- If list/card primitives are shared, their responsibilities must remain simple and legible.

## Acceptance Checklist

- [ ] Meeting rows or cards are easier to scan than in the current version.
- [ ] Relevant actions remain obvious.
- [ ] History visually aligns with Home and replay experiences.
- [ ] The page uses shared patterns instead of isolated one-off styling.
- [ ] The redesign improves clarity without overcomplicating browsing.

## Risks

- Overdesigning archive browsing into a heavier-than-needed experience.
- Diverging from Home patterns so list experiences feel unrelated again.
- Hiding important route actions behind overly subtle affordances.

## Exit Criteria

Phase 07 exits only when History feels like a first-class product surface and not a leftover utility screen.
