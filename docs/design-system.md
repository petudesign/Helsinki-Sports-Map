# HSM design system

Code-first. The source of truth is two files:

- `src/design-system/tokens.css`: colour, type, radius, elevation, space, motion and map roles. Components never use raw values.
- `src/ui/ui.css`: one rule set per component (button, icon button, chip, segmented control, field, badge, popover, disclosure, note, list row, panel and sheet, dialog, map controls and tooltip).

MapLibre layers cannot read CSS variables, so the map mirrors its roles in `src/design-system/mapTheme.ts`. Keep the two in sync.

Live reference: `?design-system=1` renders every component with the same classes as the app.

Rules, with reasoning in `DECISIONS.md` → Phase 3:

- One accent (`--accent`, the logo blue) for primary actions, selection, links and places on the map. Everything else is neutral.
- Three text levels, each ≥ 4.5:1 on every surface it is used on.
- Radius 4 / 6 / 8 / 12 / 16. A nested surface is the outer radius minus its padding. No pills except dots and the sheet handle.
- Elevation 1–3: a translucent hairline, layered soft shadows and a faint top light.
- 4 / 8 spacing grid; 44 px minimum touch target; inputs at 16 px.
- Sentence case everywhere. No tracked uppercase labels, no coloured side borders.
- Hover only under `(hover: hover) and (pointer: fine)`. Press feedback is `scale(.97)`. Custom ease-out curves, UI motion under 300 ms, transitions name their properties.

The review workbench (`?review=1`) still uses the legacy palette through `tokens-legacy.css` and is not part of this system yet.
