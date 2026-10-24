# QA Validation Matrix

## Overview

The central QA risk in a phased frontend redesign is false confidence. A screen can look improved in isolation while still breaking consistency across theme modes, locales, responsive widths, or adjacent workflows. This validation matrix defines the minimum review surface required to claim that a redesign phase is actually complete.

## Validation Rules

These rules apply to every redesign phase unless a phase explicitly documents a justified exception.

1. Validate both supported locales: English and Vietnamese.
2. Validate both supported theme modes: light and dark.
3. Validate at least three responsive widths:
   - mobile
   - tablet
   - desktop
4. Validate primary keyboard focus paths on all redesigned screens.
5. Validate all affected loading, empty, error, and success or processing states.
6. Validate route entry and exit paths for any redesigned workflow.

## Core Screen Matrix

| Screen / Surface | Light | Dark | EN | VI | Mobile | Tablet | Desktop | Loading | Empty | Error | Success / Processing | Keyboard Path |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Login | Required | Required | Required | Required | Required | Required | Required | Required | N/A | Required | Required | Required |
| Register | Required | Required | Required | Required | Required | Required | Required | Required | N/A | Required | Required | Required |
| Home | Required | Required | Required | Required | Required | Required | Required | Required | Required | Required | Required | Required |
| Meeting Room | Required | Required | Required | Required | Required | Required | Required | Required | N/A | Required | Required | Required |
| Join Meeting | Required | Required | Required | Required | Required | Required | Required | Required | Possible | Required | Required | Required |
| Meeting Replay | Required | Required | Required | Required | Required | Required | Required | Required | Possible | Required | Required | Required |
| History | Required | Required | Required | Required | Required | Required | Required | Required | Required | Required | Required | Required |
| Global App Shell | Required | Required | Required | Required | Required | Required | Required | Required | N/A | Required | Required | Required |

## Per-Phase Validation Focus

### Phase 01
Focus on baseline correctness.

Checklist:
- [ ] Route inventory matches actual routing.
- [ ] Screen inventory covers all user-facing pages.
- [ ] State inventory includes high-complexity meeting and replay states.
- [ ] Evidence is tied to repository files.

### Phase 02
Focus on token completeness and practicality.

Checklist:
- [ ] Token model covers key surfaces and states.
- [ ] Light and dark semantic mapping is coherent.
- [ ] No critical screen need depends on undefined token intent.

### Phase 03
Focus on shared shell and primitive reuse.

Checklist:
- [ ] Page shell works across public and protected routes.
- [ ] Shared loading, empty, error, and status patterns are visible.
- [ ] Notifications and page framing follow one rule set.

### Phase 04
Focus on auth and dashboard clarity.

Checklist:
- [ ] Auth pages preserve keyboard flow and form clarity.
- [ ] Home keeps primary actions obvious at all supported widths.
- [ ] Recent-meeting affordances remain understandable in both locales.

### Phase 05
Focus on live meeting state complexity.

Checklist:
- [ ] Recording, paused, processing, reconnecting, and summary-available states are distinguishable.
- [ ] Transcript remains readable in both themes and at key widths.
- [ ] Primary control path works with keyboard focus and visible state cues.

### Phase 06
Focus on replay/join convergence.

Checklist:
- [ ] Search and review interactions feel consistent across join and replay.
- [ ] Translation and summary panels follow the same logic.
- [ ] Public-context constraints do not create broken or confusing layout states.

### Phase 07
Focus on archive scanning efficiency.

Checklist:
- [ ] Meeting list or cards remain fast to scan on desktop and usable on mobile.
- [ ] Action affordances remain obvious.
- [ ] Status labels are visually and semantically consistent.

### Phase 08
Focus on final consistency.

Checklist:
- [ ] Hardcoded visual exceptions in critical surfaces are removed or documented.
- [ ] Locale, theme, and responsive checks are complete.
- [ ] Final product review finds no major cross-surface inconsistency.

## Manual Test Paths

### Path A — Enter and start
1. Open login.
2. Authenticate.
3. Land on Home.
4. Create or enter a meeting.
5. Confirm hierarchy and state clarity on the destination screen.

### Path B — Live meeting usage
1. Enter a live meeting.
2. Observe ready state.
3. Start or view recording state.
4. Observe transcript and processing feedback.
5. Confirm summary and supporting panels remain legible.

### Path C — Replay and review
1. Open replay or join route.
2. Search transcript.
3. Review translations.
4. View summary.
5. Confirm review interactions match expected design language.

### Path D — Browse history
1. Open History.
2. Scan meeting states.
3. Re-enter a live or replay route.
4. Confirm continuity with surrounding product surfaces.

## Defect Severity Guidelines

| Severity | Definition | Example |
|---|---|---|
| Critical | Blocks task completion or breaks core workflow | Cannot access primary meeting action |
| High | Major confusion or broken core state communication | Recording and paused states visually indistinguishable |
| Medium | Noticeable inconsistency or friction | History list hierarchy is unclear in dark mode |
| Low | Cosmetic or edge inconsistency | Minor spacing drift in one locale |

## Exit Rule

A redesign phase should not be marked complete if it still has:
- any critical defect,
- any high-severity inconsistency in a primary workflow,
- or incomplete theme/locale validation for the affected screens.
