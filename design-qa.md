# Design QA — reviewer workbench

## Result

passed

## Compared surfaces

- Source UI reference: `C:\Users\petsk\AppData\Local\Temp\codex-clipboard-6d2f74da-8551-419a-a6c1-80863d0d54c2.png` (user-provided queue crop, 254 × 574 px).
- Supporting visual direction: `C:\Users\petsk\.codex\generated_images\01a09483-3275-7e91-9e33-854c68ffc80f\exec-31a329df-366c-43fd-a217-be71afe103aa.png` (review workbench concept).
- Rendered implementation: `http://localhost:4181/?review=1`, browser capture at 1280 × 720 px.

## Passes

### Typography and copy

The implementation keeps the compact editorial/operations-tool hierarchy: monospace metadata, stronger venue names, and larger primary review facts. Queue labels use ellipsis intentionally for dense records. The percentage is visible again, but it is explicitly labeled an evidence score rather than a probability. The reviewer can see the exact contribution of every check in the `Why X%?` panel: passed checks show their added points, unresolved checks show the points held back. A record reaches 100% only when every deterministic check passes. Unnecessary prototype labels were removed from the page header and candidate heading so the content begins earlier.

### Spacing and layout

The queue is now a 300–330 px desktop column. The venue ID has its own 46 px right-aligned column and a 10 px gap before the venue name, so values such as `40075` no longer collide visually with the title. The three-column desktop structure remains intact, while the context panel moves below the main content at narrower widths.

The desktop reviewer uses one scroll container for the entire center column. Price options, source evidence, extracted text, and review controls therefore stay in one continuous reading order; the source evidence block no longer introduces a nested scrollbar. The queue and context columns may scroll independently because they are separate navigation/context regions.

### Viewport resilience

Desktop is the intentional primary viewport for this reviewer tool. At approximately 900–1100 px the layout keeps a readable queue and main content, then moves the context panels below. At mobile widths it falls back to a single-column flow with usable controls; mobile is supported as a fallback, not the primary workflow.

### Colors, surfaces, and icons

Borders, pale surfaces, teal provenance/check states, and red review actions remain consistent with the existing visual direction. No new imagery or custom SVG art was introduced. The visible controls use text labels and keyboard hints, so the workflow does not depend on icons alone.

### States and interactions

Verified in the local browser:

- `Accept` persists a local decision and advances the queue.
- `Edit` opens the correction form with price and note fields.
- Keyboard shortcuts `A`, `E`, `R`, and `S` are wired for the corresponding actions.
- The detail panel exposes evidence, provenance, and deterministic validation checks.
- The score panel exposes the total, progress bar, scoring caveat, and every individual point contribution.
- The price review shows the full structured option set and states that `Accept` approves them together.

### Accessibility

Interactive controls are semantic buttons/links, focus-visible states are defined, form fields have labels, and the layout does not rely on color alone for the decision text. The current dense queue is a desktop reviewer surface; full screen-reader and zoom testing remains a later hardening pass before production use.

## Findings

No blocking visual or interaction findings for this MVP change.

Known product limitation: the evidence score is deterministic and not a probability. A calibrated confidence model should only be introduced after accepted/rejected review outcomes are stored and evaluated against measured correctness.

## Comparison history

- Initial review prototype: queue used a misleading fixed `92%` badge and the ID column was too close to the venue name.
- Current pass: restored a transparent percentage score with per-check contributions, widened the desktop queue with an explicit ID column, and removed redundant prototype labels.
