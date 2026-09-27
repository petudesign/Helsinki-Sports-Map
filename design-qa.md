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
- `Edit` opens price inputs for every detected option plus a review note.
- Keyboard shortcuts `A`, `E`, `R`, and `S` are wired for the corresponding actions.
- The detail panel exposes evidence, provenance, and deterministic validation checks.
- The score panel exposes the total, progress bar, scoring caveat, and every individual point contribution.
- The price review shows the full structured option set and states that `Accept` approves them together.
- Approved, rejected, and skipped queue states use distinct semantic colors.
- The header exposes the local approved-export action when approved records exist.

### Accessibility

Interactive controls are semantic buttons/links, focus-visible states are defined, form fields have labels, and the layout does not rely on color alone for the decision text. The current dense queue is a desktop reviewer surface; full screen-reader and zoom testing remains a later hardening pass before production use.

## Findings

No blocking visual or interaction findings for this MVP change.

Known product limitation: the evidence score is deterministic and not a probability. A calibrated confidence model should only be introduced after accepted/rejected review outcomes are stored and evaluated against measured correctness.

## Comparison history

- Initial review prototype: queue used a misleading fixed `92%` badge and the ID column was too close to the venue name.
- Current pass: restored a transparent percentage score with per-check contributions, widened the desktop queue with an explicit ID column, and removed redundant prototype labels.

---

# Latest design QA — wiki editor (2026-09-27)

## Comparison target and evidence

- Source visual: `C:\Users\petsk\AppData\Local\Temp\codex-clipboard-65239030-ff69-4327-9d92-09f0f4f458b7.png`, 800 × 379 px.
- Implementation: `http://localhost:4181/?wiki=1`; the in-app browser screenshot was captured at 1280 × 720 px and displayed in the same CUA comparison response as the source. The browser capture is not saved to a local screenshot file.
- Viewport and state: implementation screenshot 1280 × 720 px (CSS size/device scale not exposed by the selected browser); the source is a 800 × 379 px Zeroheight dashboard. They are intentionally different screens: the source informs the navigation and documentation-shell direction, while the requested result is an editable wiki page. No pixel-level spacing claims are made and no density normalization was applied.
- Full-view evidence: both images were reviewed together in one comparison response. The implementation carries over a slim navigation area, light documentation canvas, and restrained utility styling. It uses the map's existing logo and colors and omits dashboard cards and the activity feed because the requested screen is for writing documentation.
- Focused region: not required for this adaptation; the source does not show the heading editor or wiki editing controls.

## Fidelity and interaction review

- Typography: reuses the app's Satoshi family with a clear page title, section headings, and smaller navigation labels. Finnish and English interface labels are available.
- Spacing and layout: desktop uses a fixed left outline and one scrollable editing canvas. The page outline follows the created heading hierarchy. A narrow-screen layout moves the outline into a disclosure and keeps the language selector available; that breakpoint was reviewed in CSS but not captured in the browser.
- Colors and tokens: uses the existing blue/teal product palette, light surfaces, soft borders, and rounded controls. No Zeroheight-specific blue links or dashboard widgets were copied.
- Images and icons: reuses the existing product logo and installed Remix icons. No new decorative assets were needed.
- Copy and content: the empty state explains how to start; heading, subheading, and note controls use direct labels. Draft status identifies browser-local saving.
- Interactions: browser verification confirmed adding and editing a heading, adding a subheading, deleting the temporary section, and persistence after reload. The map exposes a working Wiki link. Browser console returned no errors.
- Build: `npm run build` passed. Vite still reports the existing large map-data chunks.

## Findings

No actionable P0/P1/P2 differences for the requested Zeroheight-inspired wiki adaptation. The source and implementation represent different screens by design, so this pass checks structural direction and the built editor rather than claiming a pixel-identical clone.

## Follow-up polish

- Capture the wiki at a real mobile viewport and refine the compact header if needed.
- Replace browser-local draft storage with a shared source of truth when collaborative/published wiki editing is needed.

## Comparison history

- Initial wiki pass: empty page, dynamic heading outline, subsection editing, delete controls, local save state, and responsive styling added.
- Current pass: verified heading/subheading interactions and local persistence, removed temporary verification content, confirmed map-to-wiki navigation, and checked the browser console.

**final result: passed**
