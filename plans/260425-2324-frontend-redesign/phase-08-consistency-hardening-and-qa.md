# Phase 08 — Consistency Hardening and QA

## Context

- Parent plan: `plan.md`
- Depends on completion of all prior redesign phases
- Related documents:
  - `execution-backlog-by-phase.md`
  - `qa-validation-matrix.md`

## Overview

This phase closes the gap between a redesigned set of screens and a coherent product system. The challenge is that many redesign efforts lose discipline at the end: literal colors remain, special-case states survive, metadata drifts, and dark mode or localization inconsistencies are discovered too late. This phase exists to prevent that decay and define the final quality bar.

## Scope

### In scope
- consistency pass across all redesigned screens
- semantic theme compliance pass
- dark mode and localization verification
- responsive verification
- accessibility verification for core interaction paths
- document metadata and shell cleanup where needed

### Out of scope
- introducing new feature ideas late in the redesign
- reopening already accepted phase goals without evidence of blocking defects

## File Scope

- all redesigned pages and shared components
- `frontend/index.html`
- `frontend/src/i18n/index.ts`
- related theme and shell files where hardening fixes are required

## Required Outputs

1. Final consistency defect list
2. Theme compliance pass
3. Dark/light verification report
4. i18n verification report
5. Responsive verification report
6. Accessibility verification report

## Requirements

### Consistency requirements
- Major screens must share one layout and state language.
- Hardcoded visual escape hatches in critical surfaces must be removed or explicitly justified.
- Metadata and document language behavior must align with the supported locales.

### Validation requirements
- Core user paths must be checked in both supported languages.
- Core redesigned screens must be checked in both light and dark modes.
- Primary keyboard and focus paths must remain navigable.
- Important responsive breakpoints must be verified.

## Acceptance Checklist

- [ ] Semantic theme usage is dominant across redesigned surfaces.
- [ ] Dark mode remains coherent on all major screens.
- [ ] English and Vietnamese content presentation remains coherent.
- [ ] Core responsive breakpoints have no layout-breaking regressions.
- [ ] Core focus and contrast issues have been addressed or explicitly recorded.
- [ ] The product passes a final consistency review using the QA matrix.

## Risks

- Leaving known exceptions undocumented.
- Treating QA as cosmetic rather than structural.
- Rushing the final pass and shipping hidden inconsistencies between surfaces.

## Exit Criteria

Phase 08 exits only when the redesigned frontend behaves like one cohesive product system under theme, locale, and device variation.
