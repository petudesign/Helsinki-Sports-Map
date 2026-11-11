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

## Phase 2 — Persona evaluations

Five independent agents used the phase-1 build only through screenshots (Playwright), each with its own task, device and constraints. Full reports, in Finnish, are in `docs/ui-overhaul/phase-2/<persona>.md`. Their screenshots (~42 MB) stay local and are git-ignored; the committed comparison sheets are in `docs/ui-overhaul/phase-2/compare/`.

| Persona | Task | Result | Clarity | Trust | Task | Speed | Mobile |
|---|---|---|---|---|---|---|---|
| Commuter, phone, 60 s | Free basketball court nearby tonight | Partly: 15 steps, ~75 s, court 29 min away | 3 | 2 | 3 | 2 | 3 |
| Family, laptop + phone | Nearest swimming hall, prices, Saturday hours | Partly: no prices, no hours, "nearest" impossible | 3 | 2 | 1 | 3 | 3 |
| English-speaking newcomer | Football or gym near Central Station, by transit | Partly: walking route only, transit never worked | 3 | 2 | 3 | 3 | 3 |
| Design lead, 2 min | Would I interview? | Maybe, leaning no at Linear/Wolt level | 3 | 2 | 4 | 4 | 3 |
| Low vision: 200 %, VoiceOver, deuteranopia | Tennis court via keyboard only | Partly: ~40 key presses, focus lost on open and close | 4 | 3 | 3 | 2 | 3 |

**Average trust was 2.2 / 5.** It was the lowest score for four of the five personas. That shaped the order of the fixes: first stop the UI from hiding or misrepresenting things, then speed and polish.

### Findings repeated across personas, and what was done

Ordered by how many personas hit them.

| Finding | Personas | Decision |
|---|---|---|
| The detail panel covers the map on a phone, and the selected place disappears | design lead, commuter, family, newcomer | On a phone the detail opens as a 56 dvh sheet, and the camera centres the place in the strip above it. Full snap points and drag come in phase 4. |
| "Official details" and "Check access" links go to a provider's front page (liikunta.hel.fi, hel.fi) | design lead, commuter, family, newcomer | Front-page URLs (path `/`, `/fi`, `/en`, `/sv`) are no longer presented as the place's page. The panel shows one link: the place's own page when one exists, otherwise "Find on Helsinki Service Map", which searches for the place's name. "Check access" only appears when it leads somewhere different and specific. |
| No "near me", no distances, no way to tell what is nearest | commuter, family, newcomer | A "Near me" button next to search sorts by walking distance and shows "80 m · address" on every row. A search with no results for something like "Central Station" or "Hiihtäjäntie 1" offers "Show places near …", which geocodes it and sorts by distance from there. The origin is drawn on the map, and the map fits it plus the eight nearest results. Clear removes it. |
| Missing hours and prices are not mentioned, and the hours that do exist are hidden in a collapsed section | family, commuter, newcomer | Opening hours, when present, are a visible fact next to price and access. What is missing is said once ("Prices and opening hours aren't listed here yet. Check the official page before you go."), followed by the official link. Data check: the Service Map snapshot covers 256 units, mostly in north Helsinki. Itäkeskus swimming hall is not one of them, so the gap is in the data, not the UI. |
| Indoor and outdoor places can't be told apart; "Swimming" mixes in gyms | commuter, family, newcomer | List rows now lead with the facility type ("Swimming hall", "School gym hall", "Outdoor gym") before the sports. Group records typed "3 sports facilities" don't show that count as a type. **Not done:** an Indoor/Outdoor filter. It needs a reliable classification in the data pipeline, so it is logged for the data side rather than guessed in the UI. |
| Filters remove places without saying so | commuter (Free: 284 → 35), family ("Children and families" removed every swimming hall, and the empty state blamed the search word) | With a price filter on, the list says "249 places with no listed price are hidden · Show them". The empty state names each active filter as a removable button and no longer blames the search when a filter is the cause. |
| The map doesn't follow the results | design lead, family | Changing search, filters or the near origin fits the map to the results (max zoom 15). Closing a place restores the view from before it was opened, instead of leaving the user at 100 m. The default camera is no longer shifted 220 px left: the panel sits beside the map, not over it. |
| Opens in English for Finnish browsers | family, low vision | The initial language comes from `navigator.languages`, and the user's choice is remembered in `localStorage`. |
| The privacy banner covers the map, the list and focused controls; it is the last Tab stop | commuter, low vision, brief | The banner is the first Tab stop in the DOM, but it sits in the page flow above the footer (`order`), so it never overlaps the map or list. On a phone it shows the title, the details toggle and two equal buttons only. After a choice, focus goes to search. Visual redesign in phase 3. |
| Search and directions lose state | commuter (closing directions emptied the search), newcomer (Directions wiped "football") | Opening directions keeps the search and filters. The near origin, if set, prefills the starting point. On mouse/trackpad devices the starting-point field gets focus. |
| Transit is greyed out with no reason | commuter, newcomer | When public-transport routing fails, the explanation and a link are shown whichever mode is selected. The link now says honestly where it goes ("Open transit directions in Google Maps"); it was labelled as an HSL link before. Note: locally there is no `.env`, so Digitransit and Paikkatieto calls fail in dev. The production keys were not tested. |

### Single-persona findings fixed because phase 5 needs them anyway

- **Focus:** opening a place moves focus to its heading (`tabindex=-1`). Back or Escape returns focus to the list row that opened it. "Show more" focuses the first new row and says how many are left. The report dialog closes with Escape. Verified with Playwright at 1440 and 390.
- **Screen reader:** the detail card is no longer a live region (it would have been read out in full on every change). One visually hidden status line announces "N places" or "Opened: name".
- **The report button** uses a flag icon instead of "(!)", which read as "more info".
- **The list description** (screen readers only) no longer claims the list follows the visible map area.

### Deferred, with reason

- **Colour discipline, chip and filter popover styling, uppercase micro-labels, "Work in progress" in the header, mobile "All" + "All categories" duplication** (design lead): this is the token and component work of phase 3, not patches.
- **Smooth camera move without a blank frame** (design lead): phase 4 motion.
- **2D/Tilt missing at 200 % zoom and on phones, and no arrow keys in segmented controls** (low vision): phase 5, with the segmented-control component from phase 3.
- **Peek bar tap target, drag and fast-swipe dismiss** (commuter): phase 4 sheet gestures.
- **Search relevance** ("tennis" also matching table tennis; school halls ranked like public courts): needs a ranking model in the data layer. Logged, not patched.
- **Landmarks in English on the basemap** (newcomer): basemap labels come from OpenFreeMap; considered in phase 3 together with the map style.
