# Open Questions and Assumptions

## Overview

This document captures the assumptions currently holding the frontend redesign plan together and the unresolved questions that could materially change sequencing, scope, or acceptance criteria. The purpose is not to block progress unnecessarily. The purpose is to prevent hidden assumptions from turning into expensive downstream rework.

## Current Assumptions

### 1. The current stack remains in place
Assumption:
- React, Vite, MUI, Zustand, react-router, and i18next remain the frontend foundation.

Impact if false:
- The design-system and execution plans would need major restructuring.

### 2. The redesign is phased, not big-bang
Assumption:
- The team prefers incremental migration while keeping the product runnable.

Impact if false:
- Phase sequencing, QA strategy, and risk model would all change significantly.

### 3. Backend contracts stay mostly stable during early phases
Assumption:
- The initial redesign focuses on UI structure and experience rather than backend/API changes.

Impact if false:
- Phase boundaries between redesign and product engineering would blur.

### 4. Live meeting and replay quality matter more than cosmetic polish on lower-stakes screens
Assumption:
- The product’s perceived competence is driven primarily by meeting, transcript, and replay workflows.

Impact if false:
- The implementation order may need to shift.

### 5. English and Vietnamese must both remain supported throughout the redesign
Assumption:
- Locale support is a hard requirement and not a post-redesign cleanup item.

Impact if false:
- Some QA and layout constraints would loosen, but the product would regress in accessibility to its current audience.

## Open Questions

### 1. Is the redesign expected to be mostly visual, mostly UX, or both?
Why it matters:
- This determines how much structural change to layouts and flows is acceptable.

Current default:
- Both, with structural change constrained by the current product architecture.

### 2. Who is the final sign-off owner?
Why it matters:
- Without a clear decision owner, “better design” becomes subjective and slows delivery.

Current default:
- Not explicitly defined.

### 3. Is there a preferred visual reference or brand direction?
Why it matters:
- The design system can be coherent without a style reference, but visual decision speed will be slower.

Current default:
- Professional meeting workspace aesthetic, not yet tied to a named brand reference.

### 4. Are there performance budgets or rendering constraints for transcript-heavy screens?
Why it matters:
- Meeting and replay surfaces can become visually richer in ways that hurt performance.

Current default:
- Preserve current responsiveness; do not introduce heavier UI without justification.

### 5. Are accessibility targets formal or informal?
Why it matters:
- The QA bar changes meaningfully if WCAG-style compliance is a formal requirement.

Current default:
- Practical accessibility baseline: focus visibility, contrast, keyboard path coverage.

### 6. Is there appetite for limited logic refactor when a screen cannot be redesigned cleanly otherwise?
Why it matters:
- Some UI improvements may be awkward without limited composition refactors.

Current default:
- Limited refactor allowed only when clearly justified by UI integration needs.

## Decision Triggers

The following events should trigger a plan update rather than ad hoc workaround decisions:

- a required redesign phase cannot proceed without backend contract changes,
- dark mode support becomes materially more complex than assumed,
- localization causes layout or information hierarchy conflicts on key screens,
- replay and join flows differ more than expected,
- performance or responsiveness issues emerge from redesigned transcript surfaces,
- a stakeholder requests a more radical visual rebrand than the current plan anticipates.

## Recommendations

1. Confirm the final sign-off owner before implementation begins.
2. Confirm whether the product wants a conservative evolution or a more assertive visual shift.
3. Confirm the acceptable amount of UI-adjacent refactor during redesign phases.
4. Treat any backend dependency that emerges during redesign as a scoped decision, not an implicit extension of the phase.

## Exit Criteria

This document is sufficient when the team can clearly identify:
- which assumptions are safe to proceed with,
- which questions still need stakeholder answers,
- and which kinds of surprises require formal plan updates instead of local fixes.
