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

## Phase 3 — One token set, one component model (light)

### Decision: replace the cascade instead of re-skinning it

Before this phase, `styles.css` (708 lines) and `map.css` (595 lines) defined the same components three times: a beige palette, a blue–teal re-skin halfway down, then overrides on top. That cascade is gone. The app now loads two files:

- `src/design-system/tokens.css`: every colour, radius, shadow, space, type size and motion value.
- `src/ui/ui.css`: one rule set per component, built only from tokens.

The review workbench and the old preview still use the legacy palette, so they moved to `src/review/review.css`, which imports `tokens-legacy.css`, and they no longer load with the map. `?design-system=1` is now a live gallery of the new components (`DesignSystemPreview.tsx`), using the same classes as the app.

### Font: Geist, not Satoshi

Compared on the real UI at 2× (`docs/ui-overhaul/phase-3/4-font-satoshi-vs-geist.png`). Satoshi has more personality: geometric, round "a", brand-like at title size. But the product is mostly 12–14 px list text, distances and counts. At those sizes Geist has the larger x-height, more open apertures and true tabular figures, so "330 m" and "1,368 places" line up and don't jitter. It also covers more of Latin Extended for names. Satoshi is kept only for the review tool. Self-hosted, 57 kB variable woff2, OFL licence in `public/fonts/Geist-LICENSE.txt`.

Considered and rejected: Inter (too close to the system default to give any identity) and keeping Satoshi for titles only (two families would be the opposite of "one system").

### Colour

- **Neutrals:** a cool zinc ramp (`#fafafa` → `#18181b`). The greenish tint (`#f7faf6`, `#cbd6cd`, …) and the radial gradients behind the app are gone.
- **One accent:** the logo blue `#0755a0`. It is used for primary buttons, the selected state (chips, rows), links, and every place on the map. Before, five hues competed for attention: brick-red pins, navy clusters, petrol consent button, dark-green toggles and a bright-blue chip. The design lead flagged this as the most serious finding.
- **Text in three levels.** Contrast was measured on every surface each level appears on:

| Token | Value | White | Subtle | Muted | Accent soft |
|---|---|---|---|---|---|
| `--text-1` | #18181b | 17.7 | 17.0 | 16.1 | 16.0 |
| `--text-2` | #52525b | 7.7 | 7.4 | 7.0 | 7.0 |
| `--text-3` | #66666e | 5.7 | 5.5 | 5.2 | 5.1 |
| `--accent` (as text) | #0755a0 | 7.5 | 7.1 | 6.8 | 6.7 |

  White on the accent is 7.5:1. Error text (`#b42318`) is 6.6:1 and is never the only signal.
- **Route lines keep per-mode colours** (walk, bike, transit, car). They are data encoding on the map, not UI chrome, and each mode is also named in the controls.

### Scales

- **Radius:** 4 / 6 / 8 / 12 / 16. Controls and rows use 8, popovers 12, panels 16. Nested surfaces follow outer radius minus padding: a 16 px panel with 8 px padding holds 8 px rows, and an 8 px control holds 6 px segments. `999px` is left only for dots and the sheet handle, so there are no more pills.
- **Elevation:** three levels. Each is a translucent hairline, layered soft shadows and, on levels 2–3, a faint inset top light. Borders are translucent (`rgb(24 24 27 / .1)`), so they read the same on any surface.
- **Space:** 4 / 8 grid (4, 8, 12, 16, 20, 24, 32). Control heights are 32 / 36 / 44.

### Components (one model each, all in `ui.css`)

| Component | Model |
|---|---|
| Button | primary (filled accent), secondary (white with hairline shadow), ghost. Heights 36, or 44 where touch matters. |
| Icon button | 36 × 36 ghost, same radius. Every one has an accessible name. |
| Chip / filter | 36 px, 8 px radius, white with hairline. Selected is accent-soft with accent text (`aria-pressed`). Clicking a selected sport chip deselects it. The chip row is one toolbar: one Tab stop, arrow keys inside. |
| Segmented control | `src/ui/Segmented.tsx`. Grey track, white raised thumb, radio-group semantics, arrow keys and Home/End. Used for 2D/Tilt, EN/FI and price. |
| Search field | 44 px, 16 px text (no iOS zoom), icon inside, clear button only when there is text. |
| Badge | 20 px, 6 px radius, neutral. Only for facts that exist ("Free", "Preview data"). |
| Card / panel | 16 px radius, shadow-3. On desktop, one floating panel; on phones, a top bar and a bottom sheet. |
| List row | Name (14/500), type · sports (13, text-2), address (13, text-3). Distance and price on the right only when known. Selected is accent-soft. |
| Popover | Filters panel: 12 px radius, shadow-3, groups with sentence-case legends, "Clear all" ghost button and "Show N places" primary. |
| Disclosure | One chevron component for "Facilities", "Official information", "How data is handled" and transit steps. |
| Map tooltip | Hover (mouse only): the place name on a dark 8 px card. |
| Map places and clusters | Accent fill, white 2 px ring, soft accent halo. The cluster count sets the size; there is no second colour. Selection is a larger dot, a 3 px ring, a halo and a bold label. The "near here" origin is ink, not accent, so it never reads as a place. |

### Icons: stay with Remix Icon

The brief suggested Lucide. Lucide has no football, basketball, ice hockey or boxing glyphs, so the sport chips would have mixed two sets with different construction. The app keeps Remix's line set and uses it consistently: 16 px inline and in chips, 18–20 px in icon buttons, colour from text tokens.

### Layout: full-width map with floating panels

- **Desktop:** the map fills the viewport. One 400 px floating panel on the left holds brand, language, search, chips, the list or detail, and the footer. The camera is offset by half the panel width (212 px), so fits and selections centre in the visible map. Zoom, 2D/Tilt and reset are one control column on the right, same radius and shadow.
- **Phone:** the panel splits in two (`display: contents` on the wrapper). The top bar holds logo, search, near-me, and the chip row as floating controls. The list and detail live in a bottom sheet with peek, half-height (detail) and full height. Safe areas now work: the viewport meta gained `viewport-fit=cover`, and before this every `env(safe-area-inset-*)` resolved to 0. 2D/Tilt now exists on phones and at 200 % zoom; it was hidden before (low-vision finding).
- **The language switch moved to the sheet footer on phones** so search gets the width. The language already follows the browser and is remembered.

### Removed "AI tells"

- Uppercase, letter-spaced micro-labels are gone everywhere ("1368 AREAS", "PRIVACY SETTINGS", "SPORTS", "OPEN OFFICIAL DETAILS", the footer). Section labels are real `h3` headings in sentence case.
- Coloured side and top borders are gone (facility card top border, access note, trend summary, consent banner).
- Pills are gone, except dots and the sheet handle.
- "Price not listed" on every row is gone (phase 1). Missing facts are said once (phase 2).
- Visible helper sentences are gone ("Keyboard-friendly list…", "Select a place to lift it from the map."). They stay screen-reader-only only where they help.
- "Work in progress" in the header is gone; the panel footer says "Independent project · Not an official City of Helsinki website".
- The mobile "All" + "All categories" duplicate is gone: one scrolling chip row on every breakpoint.

### Consent

It is a small card inside the panel flow: at the bottom of the panel on desktop and at the top of the sheet on phones. It never overlaps the map. Both choices are the same secondary button, equally visible. The copy is shortened to one honest sentence, with the full explanation behind "How data is handled". In the DOM it comes right after the search controls, so it is the 7th–9th Tab stop instead of the 91st.

### Also fixed while rebuilding

- **Search matches every word separately:** "Itäkeskus uimahalli" finds "Itäkeskuksen uimahalli".
- **The sheet header no longer shrinks under a long title.** Its `min-height` had replaced the flex `auto` minimum, so a six-line name overlapped the body.
- **Map labels cap at 36 characters.** The panel always has the full name.
- **The "Near me" accessible name matches its visible text** (WCAG 2.5.3).
- **The panel comes before the map in the DOM,** so the first Tab is the brand, not the map canvas.

### Verified

Playwright at 1440 and 390, locale fi-FI:
- `lang="fi"` on load
- consent choice → focus to search
- near-me rows show distances
- open → focus on the heading; Escape → focus back on the row
- Show more → focus on row 61
- ArrowDown in 2D/Tilt switches and keeps focus
- chip select → deselect returns to All
- the Free filter shows the hidden-count note and closes the popover
- no page errors

Stress scenarios (`all`, `long`, `empty`, `maperror`, `dataerror`) at 320 px and 200 % zoom: no horizontal overflow. The heading focus ring shows for keyboard and not for mouse (`:focus-visible`).

### Not done here

- Bottom-sheet drag, snap points and fling dismiss, and camera move without a blank frame: phase 4.
- English names for basemap landmarks: OpenFreeMap's Positron labels are Finnish/Swedish. Switching label language needs a style edit per label layer. Deferred to phase 6, where the style is loaded and measured anyway.
- `src/design-system/canvasTheme.ts` and `src/renderer/*` belong to the earlier custom canvas renderer, which the MapLibre map no longer uses. Left untouched; removing dead code is a separate change.

## Phase 4 — Interaction (Emil Kowalski's principles)

Checked against Emil Kowalski's `emil-design-eng`, `mobile-native` and the gesture rules in his skills repo.

### Audit of what phase 3 already set

- **Press feedback:** `transform: scale(.97)` on `:active` for buttons, icon buttons, chips and the near-me button. Icon buttons were at .94 and are now .97, matching the rest.
- **Hover** exists only inside `@media (hover: hover) and (pointer: fine)`, MapLibre's controls included.
- **Curves:** `--ease-out cubic-bezier(.23,1,.32,1)` for UI, `--ease-drawer cubic-bezier(.32,.72,0,1)` for the sheet, ease-in-out for on-screen camera moves. No `ease-in` and no `transition: all` anywhere (grep-verified). UI durations run 120–260 ms.
- **Reduced motion:** `prefers-reduced-motion: reduce` sets every transition and animation to 0 ms. MapLibre camera moves already use duration 0 there.
- **Phones:** 16 px inputs, `dvh` for the shell, `viewport-fit=cover` + `env(safe-area-inset-*)`, no tap highlight, `touch-action: manipulation`, `overscroll-behavior: none` on the root and `contain` on scrollers. `user-select: none` is set on controls only, never on content.

### Decision: the phone sheet moves with transform, not height

Before this phase the sheet animated `height`, which forces a layout on every frame. Now the sheet is always full height and sits at one of three snap offsets: peek (header only, measured), half (56 dvh, for a place) and full. Only `transform: translate3d()` changes. The offsets live in CSS (`data-snap`), so resting states never depend on JavaScript.

### Decision: the sheet follows the finger and closes on a fast swipe

`src/ui/useSheetDrag.ts`, dragging from the sheet header:

- Tracks the finger 1:1 with no transition while dragging. Pointer capture keeps the drag going outside the header, and a second finger is ignored.
- A 6 px dead zone means a tap on the back, report or collapse buttons still clicks. A drag that started on a button doesn't fire it afterwards.
- On release: a flick faster than 0.4 px/ms moves one snap in its direction, whatever the distance. Faster than 1.2 px/ms downward closes to the peek from any height. Otherwise the nearest snap wins.
- Past the top or below the peek, the movement is damped (square root) instead of stopping hard.
- The collapsed content is `inert`, so it is out of the tab order and the accessibility tree while only the peek shows.

Verified in a 390 × 844 touch viewport:

| Gesture | Result |
|---|---|
| Slow 300 px drag up | half |
| Fast flick up | full |
| Fast flick down | peek |
| Tap the toggle | full |
| Open a place | half, with the place centred in the visible strip above |
| Back | list, selection cleared |

Sheets: `docs/ui-overhaul/phase-4/1-sheet-snaps-and-drag.png`.

### Decision: every selection can be undone, and opening something else clears it

- **Sport chips:** tapping the selected chip returns to All. Accessibility and audience filters are toggles. The price filter has an explicit "All", and "Clear all" resets every filter.
- **Places on the map:** tapping the selected place again deselects it, and so does tapping empty map. Back in the panel now also deselects (before, it left the place highlighted on the map). The camera returns to the view from before the place was opened.
- **Trending items** toggle the same way. "Near me" toggles off.
- **Typing a search, choosing a filter that excludes the place, or switching "Near me"** clears the selection. Opening directions keeps it on purpose, since the route needs a destination.

### Decision: no blank frames

- **Camera move:** the design lead caught an empty beige map about 120 ms after opening a place (phase-2 screenshot). Tile requests were cancelled while zooming, and the tile cache was small (128). Now `cancelPendingTileRequestsWhileZooming: false`, `maxTileCacheSize: 512` and a 150 ms tile fade. Frames captured 60–600 ms after a click always show the overzoomed parent tiles, never an empty frame (`2-camera-move-before-after.png`). The camera uses ease-in-out over 420 ms. That is longer than the 300 ms UI limit, deliberately: a camera move is spatial movement across the city, not a UI response, and 420 ms keeps it readable.
- **Panel content swaps** in place with no exit animation or empty intermediate state. Facility photos reserve 16:9 and fade in on load instead of popping.
- **Geist is preloaded** (`<link rel="preload">`), so text doesn't visibly swap fonts on first paint.

### Decision: touch targets reach 44 px without looking bigger

On `(pointer: coarse)`, icon buttons, segmented items, small buttons and chips get an invisible `::after` hit area of at least 44 × 44, and MapLibre's zoom buttons become 44 px. On desktop they keep the denser 36 px.

### Enter motion

The filters popover and the report dialog enter with opacity + `scale(.97)` → 1 in 160 ms ease-out, using `@starting-style`. The popover grows from its trigger (top-left origin) and the dialog from its centre. Exits are instant: closing should feel faster than opening.

### Not done

- **Dragging from inside the list** (pull down when scrolled to the top). Only the header drags, which avoids fighting the list's own scroll. Common in native sheets, but it needs scroll-position handling that is easy to get wrong. Logged for later.
- **Real-device check:** the drag, safe areas and tap behaviour were verified in Chromium's touch emulation. Per the `mobile-native` rules, sticky hover, rubber-banding and the notch must be confirmed on an actual iPhone before calling this done.

## Phase 5 — Accessibility

### Method

- **Automated:** axe-core (WCAG 2.0/2.1/2.2 A and AA + best practice) on home, filters and detail, at 1440 px and 390 px. The map canvas is excluded, because axe cannot judge WebGL content.
- **Manual:** the phase-2 low-vision task again, keyboard only, at 200 % zoom (1280 × 800 → 640 × 400 CSS px), Finnish browser. The accessibility tree (`ariaSnapshot`) stands in for VoiceOver. Colour-vision deficiency was simulated with Chromium's `Emulation.setEmulatedVisionDeficiency` (deuteranopia and protanopia), on the original (63d56f4) and the current build in the same state.

### Results

| Check | Original | Now |
|---|---|---|
| axe violations, 1440 home / filters / detail | 2 / 1 / 1 (target-size, aria-allowed-role) | 0 / 0 / 0 |
| axe violations, 390 home / filters / detail | 1 / 0 / 0 | 0 / 0 / 0 |
| Keyboard task at 200 %: find a tennis court, open, read, close | ~40 key presses, focus lost twice, Escape did nothing | 17 key presses |
| Tab stops to reach the privacy choice | 18 (200 %) / 91 (1280 px) | 7 |
| Focus after opening a place | `body` (nothing announced) | the place's `h2`, plus "Opened: name" in the status region |
| Focus after Back / Escape | `body` | the list row that opened it |
| Tab stops with a visible focus ring (first 16) | not measured | 16 / 16 |
| 2D/Tilt at 200 % | hidden (zero width) | visible, arrow keys work |

Automated tools found almost none of the real problems. The serious ones (lost focus, Escape, the banner, unreachable results) came from the persona and the keyboard walkthrough. Both kinds of check are kept for that reason.

### Fixes in this phase

- **Focus rings were invisible on every shadowed component.** `:focus-visible` drew the ring with `box-shadow`, and the secondary buttons, chips and segmented thumbs set their own `box-shadow` in a later rule, so the ring disappeared. The keyboard walkthrough screenshot caught it on "Only necessary". The ring is now an `outline` (2 px accent, 2 px offset, 7.5:1 against white), which no component shadow can override. The chip scroller got 4 px of internal padding so the outline isn't clipped. The search and starting-point fields show focus as a 2 px accent ring on the field itself.
- **Results were unreachable by keyboard in the narrow layout.** The collapsed sheet's content is `inert` (correctly), but at 200 % zoom the desktop gets the phone layout. Tab went from the chips straight past every result. Now, when keyboard focus reaches the collapsed sheet (`:focus-visible` only, not a tap), the sheet opens, so the next Tab is the first result.
- **Report dialog:** the focus is trapped (Tab and Shift+Tab cycle "Cancel" ↔ "Continue to GitHub", as `aria-modal` promises). Escape closes it, and focus returns to the report button.
- **Filters popover:** Escape closes it and returns focus to "Filters".
- **MapLibre's own buttons** ("Zoom in", "Zoom out", attribution) now follow the UI language. They were always English.
- **Selected chips no longer rely on colour alone.** Selected means semibold text and a 1.5 px accent ring (7.5:1), not just a tinted background. The near-me toggle follows the same rule.

### Already in place from earlier phases (re-verified)

- **Every place is reachable without the map:** the list (alphabetical or nearest first), search on every word, "Show more" with focus moved to the first new row.
- **Open moves focus to the heading; close returns it. The closed sheet is `inert`.**
- **Arrow keys:** segmented controls (2D/Tilt, EN/FI, price) are radio groups with arrows and Home/End. The sport chips are one toolbar with arrows.
- **Every icon button has a name** (back, report, collapse, reset view, use location, clear search, zoom). "Near me" keeps its visible text as its accessible name (WCAG 2.5.3).
- **Language:** `<html lang>` follows the UI language, and the EN/FI options carry their own `lang` and full names ("English", "Suomi").
- **Colour:** places are the logo blue, which survives both red–green deficiencies. In the original, brick-red pins turned olive under deuteranopia and protanopia and sank into the beige map and parks. Selection is size + ring + bold label, not a second hue. The "near here" origin differs from places by colour and by shape (ink dot with a wide halo), and the list states "Distance from …" in text. Comparison: `docs/ui-overhaul/phase-5/2-colour-vision-before-after.png`.

### Not verified

- **Real VoiceOver on macOS/iOS** was not run. The accessibility tree shows the right names, roles, states and headings, but announcement timing and verbosity need a person with a screen reader.
- **Route lines** use per-mode colours (green walk, orange bike), which are close under deuteranopia. Only one mode is drawn at a time, and the selected mode is named in the controls and the legend, so the colour is never the only cue. A real route couldn't be drawn locally without the routing API keys.
