# UI decision log

Running log for the UI and usability overhaul on branch `ui/premium-redesign`. Each entry says what changed, why, and what was deliberately left out. Product and data decisions stay in [docs/PRODUCT_DECISIONS.md](docs/PRODUCT_DECISIONS.md).

Work proceeds in batches; nothing is committed or deployed until the batch is approved.

## Baseline audit (2026-11-11)

Stack: Vite 8 + React 19 + TypeScript, MapLibre GL 6 (OpenFreeMap Positron, OSM raster fallback), plain CSS (no Tailwind), Remix Icon, Satoshi variable font self-hosted from `/public/fonts`.

Confirmed from the brief:

- Header: logo, "Work in progress" subtitle, Wiki, 2D/Tilt, EN/FI, a horizontally scrolling chip row (clips at the edge with no affordance), Trending, Filters.
- Left "Facility list" card; nearly every row carries "Price not listed".
- Map sits in its own card, not full-bleed. Clusters are dark-blue numbered circles.
- Tracked uppercase micro-labels: "1368 AREAS", "PRIVACY SETTINGS", "© OPENSTREETMAP CONTRIBUTORS".
- The consent banner covers a large part of the map (desktop) and most of the screen (phone).

Added after reading the code and running it:

- **Styles are three layers of overrides.** `styles.css` (708 lines) defines a beige palette, then re-skins it to blue-teal halfway down; `map.css` (595 lines) overrides both again. `tokens.css` exists but most rules use hard-coded hex values. Radii in use: 2, 6, 8, 9, 10, 12, 14, 16, 18, 999 px. Fonts are set per rule (`font: 600 .68rem Satoshi`) rather than inherited, with sizes from 9 px to 21 px.
- **Mobile hides 2D/Tilt entirely** and collapses the sport chips into "All categories".
- **The list repeats information**: count appears in the toolbar ("1368 AREAS") and the list header ("1368 areas"). "Areas" is the wrong noun for a facility, and counts have no thousands separator.
- **Visible helper copy**: "Keyboard-friendly list of visible sports facilities." sits above the list.
- **`<html lang>` never changes** when switching to Finnish, so screen readers read Finnish with an English voice.
- **Basemap failure is silent.** When the vector style and the raster fallback both fail, MapLibre still fires `idle`, which clears the error flag, so the user sees dots on a blank canvas with no explanation.
- **Detail view shows unknown facts as a table** ("Price: Price not listed / Access: Not verified").
- **The map card on desktop is offset 220 px** to make room for the panel, but the panel is outside the map, so the default view is off-centre.
- Selected-state, filters and highlights: to be checked in phase 4.

## Phase 1 — Break the UI

### Decision: a dev-only `?stress=` harness at the data boundary

`src/dev/stress.ts` rewrites the loaded dataset before React sees it, so the worst case enters through the same path as real data (no hand-edited markup). Scenarios: `long`, `sports`, `many`, `missing`, `empty`, `nolocation`, `maperror`, `dataerror`, and `all` (= long + sports + many + missing). A plain segmented switcher appears at the bottom of the screen whenever `?stress=` is present in a dev build (`src/dev/StressToggle.tsx`).

Every call site is guarded with `import.meta.env.DEV`; the production build was checked to contain none of the stress code. The harness stays in the repo as the regression test for later batches.

Worst-case values are realistic rather than random: long Finnish compound names and their English translations, an unbroken 43-character Finnish compound (`Arabianrannanliikuntapuistontekonurmikenttä`), a one-letter name (`Ö`), a bilingual address with entrance directions, 35 sports on one venue, ~11,000 facilities (8× the real set, with duplicate names), every optional field removed.

Checked at 1600 px, 390 px and 320 px, plus 200 % zoom at 1600 and 390.

Emil Kowalski's `break-ui` skill was used as the checklist (catalog rows: long text, unbreakable strings, counts of 0/1/thousands, missing fields, error states, 200 % zoom, 320 px).

### What broke, and the fix

| # | Severity | Where | Worst case | What happened | Fix |
|---|---|---|---|---|---|
| 1 | Broken | Panel header, 390 px @ 200 % | long name | Title squeezed to one letter per line between the back/report/collapse buttons | Header wraps; title takes its own row below 12 rem (`map.css`, Phase 1 block) |
| 2 | Broken | Map, basemap down | `maperror` | Dots on an empty canvas, no message, no retry | `idle` no longer clears a failed raster fallback; non-blocking notice "The background map didn't load. Places are still shown and the list works." + Try again (`SportsMap.tsx`) |
| 3 | Broken | Whole app, dataset down | `dataerror` | Unstyled "Could not load facilities." and a browser-default button | Proper error state with logo, heading, cause, reassurance and a 44 px primary action (`App.tsx`) |
| 4 | Broken | Detail title | long name | Clamped to 2 lines (desktop) / 1 line (phone) with an ellipsis and no way to read the rest | Full title wraps in the detail view; only the collapsed phone sheet clamps to one line |
| 5 | Ugly | List row | 35 sports | Row grew to 8 lines of comma-separated sports | First three + "+32 more" / "+32 muuta" |
| 6 | Ugly | Empty result | `empty` | Panel says "0 areas" and is otherwise blank; the explanation sits in a 10 px line above, outside the panel | Empty state inside the list: what was searched, what to try, one "Clear search and filters" button |
| 7 | Ugly | List rows | `missing` | "Price not listed" on every row | Price badge only when the price is known |
| 8 | Ugly | Detail facts | `missing` | Grey table of "Price not listed / Not verified" | Show only known facts; when none are known, one sentence: "Price and access aren't listed in the source data yet." |
| 9 | Ugly | Counts | 10944 | "10944 AREAS", "1 areas" | `Intl.NumberFormat` + singular/plural: "10,944 places", "10 944 paikkaa", "1 place" |
| 10 | Ugly | Chip row | 1600 px @ 200 % | Chips cut mid-word ("Athleti") with no hint that it scrolls | Fade mask on the trailing edge |
| 11 | Ugly | Location denied | `nolocation` | "Location permission was denied." and nothing to do next | "Location access is off. Type an address instead, or allow location in your browser settings." |
| 12 | Fragile | Body | 200 % on a 390 px phone (195 CSS px) | `body { min-width: 320px }` + `overflow: hidden` clipped the right edge with no scroll | Removed the min-width |
| 13 | Fragile | Unbroken compounds | 43-char Finnish word | Would overflow narrow columns | `overflow-wrap: anywhere; hyphens: auto` on names, and `<html lang>` now follows the UI language so hyphenation uses Finnish rules |
| 14 | A11y | `<html lang>` | FI | Stayed `en` | Updated on language change |
| 15 | Ugly | Helper copy | — | "Keyboard-friendly list…" visible | Kept for screen readers, visually hidden |

### What held up

- No horizontal page scroll at any tested width.
- 11,000 facilities: clustering and the paginated list (60 rows + "Show more") rendered without visible breakage. Not profiled yet; performance is measured in phase 6.
- Photo failures already fall back (no broken-image icon); photos reserve 16:9 so they don't shift layout.
- React escapes all data; no raw markup rendered.

### Decisions left for later batches

- **Duplicate names in the list** (real data has them too, e.g. several "Malmin kenttä"). The address line disambiguates when present; phase 3 will decide whether rows without an address show the district instead.
- **Where the count lives** (toolbar vs list header): resolved in phase 3 with the new layout, not patched here.
- **Phone sheet covers the selected place** when a detail opens: phase 4 (camera offset + sheet snap points).
- **Phase 1 CSS lives in a marked block at the end of `map.css`.** It is intentionally not merged into the old cascade, because phase 3 replaces that cascade with a token-based component layer.

### Not done, and why

- RTL and dark mode: the product supports neither, so they were not tested.
- 400 % zoom (WCAG reflow at 320 CSS px): covered indirectly by the 320 px pass.
