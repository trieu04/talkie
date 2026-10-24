# Phase 02 — Theme and Token Expansion

## Context

- Parent plan: `plan.md`
- Depends on: `phase-01-ui-audit-and-baseline-definition.md`
- Related document: `design-system-migration-plan.md`

## Overview

This phase strengthens the current MUI theme into a semantic system capable of governing surface hierarchy, state presentation, and layout behavior across the entire product. The goal is not to create an abstract design framework. The goal is to create a usable token layer that directly solves the inconsistencies identified in Phase 01.

## Scope

### In scope
- semantic color roles
- spacing rules
- radius and elevation tiers
- typography role mapping
- interaction state rules
- dark/light parity rules
- token conventions for meeting, replay, transcript, and summary surfaces

### Out of scope
- redesigning all pages during this phase
- replacing MUI
- creating a large design token platform disconnected from the current app

## File Scope

- `frontend/src/theme/theme.ts`
- `frontend/src/theme/ThemeProvider.tsx`
- optional theme support files under `frontend/src/theme/`

## Required Outputs

1. Semantic token model
2. Theme naming rules
3. Surface hierarchy rules
4. Interaction state rules
5. Typography role map
6. Dark/light validation criteria

## Requirements

### Token requirements
The token system must cover at minimum:
- background and surface roles
- border roles
- text roles
- primary and secondary action roles
- destructive and warning roles
- meeting-specific state roles
- replay/search highlight roles
- summary information roles

### Usability requirements
- Tokens must be understandable by implementers without opening multiple documents.
- Token names must describe UI intent rather than raw color values.
- The system must support both light and dark mode without separate ad hoc styling.

### Implementation requirements
- The theme model must remain realistic for MUI usage.
- Token groups must be traceable back to actual screen needs in this repository.
- The phase must identify where the current theme is insufficient and what gets added to fix that.

## Architecture Guidance

### Surface hierarchy
Define a clear model for:
- app background
- page background
- base panel
- raised panel
- muted panel
- highlighted panel
- overlay

### State hierarchy
Define visual treatment rules for:
- live
- paused
- processing
- reconnecting
- completed
- success
- warning
- error

### Typography hierarchy
Define explicit UI roles instead of generic heading/body defaults.

## Acceptance Checklist

- [ ] The theme can express all major app surfaces without hardcoded color escape hatches.
- [ ] Token names are semantic and practical.
- [ ] The system covers transcript, summary, controls, navigation, and state messaging.
- [ ] Dark and light modes can both consume the same semantic layer.
- [ ] The token model stays within the constraints of the existing MUI stack.
- [ ] No token group exists purely as theoretical future-proofing.

## Risks

- Overdesigning the token model beyond what Talkie needs.
- Creating names that are elegant in docs but awkward in code.
- Leaving meeting-specific states under-specified.

## Exit Criteria

Phase 02 exits only when the team can redesign shared primitives and major screens without introducing new literal color or spacing decisions by default.
