# Product decisions and implementation notes

This file records decisions that should remain visible when the project is continued later. Update the relevant entry when the behavior, rationale, or scope changes.

## Earlier project decisions

These are established product and architecture decisions from the project discussions. They are intentionally separate from ideas that are still being evaluated.

### Initial release is Helsinki-only, but the architecture is city-switchable

Helsinki is the only city exposed to users for now. The data, labels, map configuration, and source integrations should nevertheless be organized behind a city-specific configuration boundary so another city can be added later without rewriting the application. A user-facing city selector is out of scope for the current release.

### Trending is additive, not a replacement for the base map

The normal map continues to show the available sports facilities. Trending is an optional, clearly recognizable layer that indicates what is popular now and what has only recently appeared on the list. It must not hide or replace ordinary facilities.

### Failed demand is a future product signal

Searches that produce no useful result are potentially valuable demand data: they can show that people are looking for an activity in an area where supply is missing. Failed-demand tracking is a later analytics feature and must be designed separately from trending, so neither signal is incorrectly treated as the other.

### Public data is preferred; source limitations must remain visible

LIPAS and other freely usable public data are the initial foundation for facility coverage. Source data is not assumed to be complete: generic labels such as “sports area” or “multi-sport” are not treated as meaningful activity descriptions. Where the source does not list specific sports, the UI must say so and link to source or official details rather than inventing capabilities.

The current LIPAS transformation uses explicit facility properties such as court, pool, track, and exercise-equipment counts before falling back to a small, documented type mapping. Indoor gyms and outdoor exercise places remain separate concepts. The raw snapshot is checked with `npm run check:lipas`.

Sport classification must distinguish the facility's own name/type from free-text descriptions. Descriptions can mention neighboring facilities, as with the Taivallahti minigolf records mentioning the adjacent tennis centre; those mentions must not create a false sport tag.

Some important exceptions are deliberately curated by LIPAS site ID when the source category is too generic. The five Töölön pallokenttä records are one example: their source type is “Ball field”, but their names and descriptions identify them as football fields. This exception is kept narrow so it does not turn every generic ball field into football.

Named multi-facility complexes and parks can be grouped into one map point when their LIPAS records share the same place name and form one practical destination. Violanpuisto is one such case: its nearby skating, ball, volleyball, neighbourhood-sports, and outdoor-fitness records are shown together while their individual sports remain visible in the card.

### Search and routing are based on real routes, not straight-line distance

The product direction is to find facilities using actual walking, cycling, driving, and eventually public-transport routes. A future “within 20 minutes” search must use route-network travel time, not a radius calculated from aerial distance. Travel mode and estimated duration are part of the result context.

Address lookup is scoped to the current Helsinki map chunk and automatically adds Helsinki context to short address queries. If the scoped lookup returns no result, a broader Finnish geocoder lookup is used as a fallback so a valid address is not rejected simply because the map chunk boundary or address formatting was too narrow.

### Map coverage is expanded in measured chunks

The first map release covered only the Olympic Stadium and adjacent central area. The current expanded chunk covers longitudes 24.88–24.98 and latitudes 60.165–60.28, extending the map north through Pasila, Käpylä, Oulunkylä, Maunula, and Pakila. OSM geometry and LIPAS facilities use the same bounding box. The chunked runtime starts with a lightweight overview and loads visible detail chunks as the user explores. The current expanded view exposes 652 rendered sports areas; Lauttasaari and eastern Helsinki remain separate future expansion areas so the map does not become one oversized initial payload.

### Localization is a product capability, not a one-off translation

English and Finnish are the first supported locales. Copy must be kept in a locale-aware structure so additional languages can be added through a translator-friendly catalog without requiring the translator to edit React code. A translation is not considered complete if only the visible body text is translated; controls, map modes, status text, labels, and accessibility names must be included too.

### Official details are preferred over pretending to know availability

For facilities that may be reservable, the product should link to official facility details or booking information when available. It should not imply that a place is available at a selected time unless a reliable schedule or booking source has actually been connected.

### Outdoor swimming and price data must be source-backed

Normal outdoor swimming and winter swimming are separate activities. A LIPAS record is shown as outdoor swimming only when it is identified as an open-air pool, maauimala, public beach, or equivalent source category; a winter-swimming record is shown separately. The current Helsinki snapshot exposes Kumpulan maauimala, Uimastadion, Allas Pool, and Hietaranta public beach through the outdoor-swimming filter. We do not infer public access from a name alone, and a sauna is not added as a swimming venue unless a source explicitly documents swimming there.

Skateboarding has its own discovery category. LIPAS records for skateboarding, rollerblading, and scooters are grouped under “Skateboarding” because users generally need to discover the same skate-park destination, while the original source type remains available in the venue data.

Price filters use only explicit source signals. “Free” requires a `free-use?` signal or clear source text about free use; an explicit admission-fee or usage-fee signal can produce “paid or restricted”. Generic mentions of paid parking are not treated as a facility price. Groups can be “mixed”, and missing evidence remains “price not listed”. Exact euro prices are not invented from incomplete LIPAS data.

## 2026-09-11 — Accessibility foundation

### Decision

The map remains the primary visual interface, but it is no longer the only way to discover and select a sports facility. The map canvas is treated as a visual layer and is paired with an accessible, keyboard-operable facility list.

### Why

The canvas can show markers and map geometry, but screen readers cannot reliably expose the names, sports, or locations of individual canvas-drawn facilities. Small map markers are also difficult to use with a mouse, touch, or other pointing device. A text-based list gives the same core task a non-visual and low-precision alternative without removing the map from the experience.

### Implemented

- Added a collapsible facility list containing the currently visible facilities.
- Each list item exposes the facility name and known sports and can be selected with keyboard or assistive technology.
- Selecting a list item synchronizes the map selection and facility detail card.
- Marked the canvas as decorative for assistive technology so it does not present a misleading promise of accessible marker interaction.
- Added visible `:focus-visible` styling to interactive controls.
- Improved muted text and placeholder contrast.
- Kept map colors from being the only source of meaning where the interface already has text labels, such as filters, trend labels, travel modes, and route durations.

### Measurements and verification

- Muted text on the main background: `4.90:1`.
- Muted text on the panel background: `5.40:1`.
- Light text on the selected red control: `4.56:1`.
- `npm run build` passes.
- Browser accessibility tree exposes the facility list and facility names.
- Selecting Olympiastadion from the list opens the corresponding facility card.
- Browser console had no application errors or warnings during the check.
- The list was checked in a mobile-sized viewport.

The contrast target is WCAG AA for normal text: at least `4.5:1`. These values are a palette check, not a substitute for testing text over every possible map image or translucent layer.

### Map orientation labels remain visible

District labels such as Töölö, Meilahti, Pasila, and Kallio remain visible at every zoom level. The renderer places them with a small opaque label surface and stable, city-configured offsets so they provide orientation without jumping between positions as markers move during zooming. The map zoom ceiling is `10` for closer inspection while preserving the existing zoom anchor behavior.

### Neighborhood labels use a second visual hierarchy

The map uses two levels of orientation labels. Larger districts remain visible at all zoom levels, while more specific neighborhood labels such as Etu-Töölö, Taka-Töölö, Alppila, Vallila, Hermanni, Sörnäinen, and Ruskeasuo appear only when the user zooms in. Secondary labels are smaller and lower-contrast, and each label has a stable configured offset to prevent zoom-induced position changes. This keeps the overview readable while still helping users understand their exact area when exploring closer.

### Map geometry is prepared for spatial chunking

The Helsinki base map is split into a 4×4 set of spatial GeoJSON chunks, with a separate lightweight overview geometry. Features crossing a chunk boundary are included in each relevant chunk, and the runtime deduplicates features when assembling the current dataset. The app starts with the overview, then requests only the visible detail chunk plus a small neighboring preload area after zooming, panning, or switching projection. LIPAS facilities remain available across the full current area so counts and filters do not flicker while background geometry is loading.

### Chunk generation and loading are city-configurable

The chunk generator accepts the source file, output directory, and grid dimensions as command-line options. Runtime chunk loading is exposed through a reusable `createChunkedAreaLoader` and connected to Helsinki in the city configuration. A future city can therefore provide its own overview, manifest, and chunk imports without changing the app shell or renderer.

### Intentionally not solved yet

- A full manual test with NVDA, VoiceOver, or TalkBack still needs to be done.
- The canvas itself is not keyboard-pannable or keyboard-zoomable; the accessible list and zoom controls provide the essential alternative for now.
- Individual sport icons and all map geometry do not yet have a complete text-based legend or structured map description.
- Route lines and trend styling should continue to include text labels and must not rely on color alone as new route or trend features are added.

### Maintenance rule

When adding a new map-only interaction, also add an equivalent control or text representation to the accessible interface. When adding a new color, measure its contrast against the actual surface where it is used and document whether it carries meaning, decoration, or both.

## 2026-09-11 — Water must not be inferred from an arbitrary map boundary

### Decision

Only closed, source-provided water polygons are currently filled blue. Open coastline ways remain coastline lines until a validated polygon source or relation-based coastline solution is available.

### Why

Closing open coastline segments against the active map bounding box can incorrectly classify large land areas as water. Visual plausibility is not enough for a geographic map; false water is worse than an incomplete water layer.

### Follow-up

The next water-data implementation must use validated OSM multipolygon/coastline relations or another authoritative polygon source, with a visual check against known Helsinki shorelines before being enabled.

## 2026-09-11 — Service data and map rendering stay separate

### Decision

Use the Helsinki Service Map API and other useful official APIs to enrich sports facilities with verified services, sports, opening hours, prices, accessibility details, images, and booking links. Keep the map renderer independent from the API and preserve a separate isometric view.

### Why

Leaflet-style map applications provide useful patterns for loading and displaying geographic data efficiently, but Leaflet itself is not the right rendering layer for this product's custom isometric view. The same normalized facility data must feed both the 2D and isometric renderers, while each renderer controls its own projection and visual treatment.

The Service Map API should enrich a LIPAS facility or venue rather than replace its geometry. A parent venue such as Töölön Kisahalli can contain multiple child capabilities such as basketball, volleyball, badminton, running, boxing, fencing, table tennis, wrestling, gymnastics, and strength training. This avoids reducing a complex venue to a generic “sports centre” tag.

### Implementation direction

- LIPAS remains the primary source for sports-place records and geographic facility coverage.
- Helsinki Service Map becomes an enrichment source for official descriptions, services, schedules, prices, accessibility, images, and links.
- OSM and Helsinki geodata services remain map-geometry sources where appropriate.
- API data is normalized once and consumed by both 2D and isometric renderers.
- Detailed API content is loaded on demand or in background batches; the map should not block on every venue's full content.
- Attribution and source provenance remain visible wherever external official data is used.

### First pilot

The first enrichment snapshot is Töölön Kisahalli, Service Map unit `45925`. Its API data is kept in `src/data/service-map-kisahalli.json` and is currently shown behind an “Official facility information” disclosure in the selected-facility card. The pilot demonstrates the connection without making the whole map dependent on live API calls.

## 2026-09-11 — Facility names and access claims are separate

Addresses are shown as a separate field in the facility card and are not appended to the facility name. This keeps names scannable when one venue has several LIPAS records at the same address or nearby coordinates.

Price and access information must be source-backed. A LIPAS record alone does not prove that anyone can use a facility, nor does it provide an exact price. When an official provider page exists but public access is unclear, the card says that access is not publicly listed and links to the provider. Synapsia is the first example; we do not label it either “open to everyone” or “only for rehabilitation clients” without an explicit source statement.

External website values are normalized at the data boundary. Source records may contain `www.example.fi` without a protocol; the application turns these into secure external URLs before rendering links so the browser does not resolve them as local paths.

## 2026-09-11 — Location is an explicit starting-point option

### Decision

The user may choose the browser's current location as a route starting point, but the browser permission request is triggered only by an explicit “use current location” action. The coordinates are held in session state and are not written to cookies or sent to analytics.

### Why

Current location is useful for route planning, but requesting it on page load is unnecessary and creates a privacy surprise. Reverse geocoding is used only to show a human-readable address; routing can still use the coordinates if that lookup is unavailable.

## 2026-09-11 — Analytics consent is opt-in and separate from location permission

### Decision

The app remembers only the analytics consent choice in one first-party, `SameSite=Lax` preference cookie. No analytics provider, analytics event, or analytics cookie is enabled until an actual analytics integration is added and the user has opted in. The consent choice can be reopened from the footer.

### Why

Location permission and analytics consent are different decisions and must not be bundled. The project is not yet sending analytics, so collecting extra identifiers or storing coordinates would add privacy cost without product value. The consent copy is intentionally explicit that optional analytics is only being prepared.

## 2026-09-12 — Filter hierarchy keeps only sport and search in the primary flow

### Decision

Sport remains the primary filter row and search remains visible beside the map controls. Price, Trending, and future secondary filters live behind one compact Filters disclosure with an active-filter count. On narrow screens sport options continue to scroll horizontally and the disclosure panel stays inside the viewport.

### Why

The first filter layout gave sport, price, trend, and result count too similar a visual weight. Sport is the discovery intent; price and trend refine that intent and do not need to compete with it on every visit. The active count keeps secondary state discoverable without making the default flow heavier.

## 2026-09-11 — Travel mode appears only when route planning has two endpoints

### Decision

Walk, bike, public transport, and car controls appear when a facility with coordinates is selected and a starting point is filled in. This supersedes the earlier two-text-field rule: selecting directly from the map or list is sufficient, without a search term. The destination name and missing next step are shown explicitly. Changing endpoints clears old routes and invalidates pending route results.

The facility list uses alphabetical ordering and shows known addresses alongside activities and price information. Empty results offer a search/filter reset that preserves the starting point. Address-lookup failures are reported separately from route failures.

### Why

Travel mode is meaningful only when the user has begun defining a journey. Keeping it out of the default map view reduces visual noise and prevents the controls from competing with sport and price filters before they are useful.

## 2026-09-11 — Facility list keeps its close control visible while scrolling

### Decision

The facility list header stays sticky while its contents scroll, and its label changes from “Open facility list” to “Close facility list” when expanded. The duplicate result count is removed from the footer because the count is already visible in the filter area and in the list header.

### Why

A long list must not trap the user in a state where closing requires scrolling back to the top. The footer count repeated information without helping the map task and made the bottom edge visually heavier.

## 2026-09-11 — Remove redundant view-status decoration

### Decision

The non-interactive “Practical overview” label and decorative status dot are removed from the header. The 2D/Isometric control remains as the single visible explanation and control for the map view.

### Why

The label repeated information already communicated by the view toggle, while the dot did not represent a real application state. Removing both gives the header a clearer hierarchy and avoids implying functionality that does not exist.

## 2026-09-12 — Separate expensive map backgrounds from immediate interaction

### Decision

Keep the existing cursor-anchored zoom mathematics and requestAnimationFrame camera updates. Render roads, surfaces and buildings in an OffscreenCanvas worker, then transform the last completed bitmap during gestures. Facility markers, district labels, selection and routes remain on the main canvas at their current map coordinates and native display resolution.

The worker runs one job at a time, retains only the latest pending camera, and waits for 120 ms of camera inactivity before refreshing an existing background. Background resolution is capped at 1.5 device pixels per CSS pixel; overlays retain native resolution. A software-backed worker canvas avoids competing with the visible canvas for GPU drawing. Frames have an extra 160 px border, and a previously rendered overview is retained per mode to cover exposed areas while detail catches up. This is not a guarantee of complete coverage after arbitrary large jumps.

Only changed datasets are sent to the worker. City landmark configuration is imported separately so the worker does not bundle the city datasets. Unsupported or failed workers fall back to synchronous rendering. Replaced bitmaps are explicitly released.

Viewport loading shares normalization for concurrent identical requests and caches four recent chunk combinations. Empty coverage uses the overview instead of fetching every detail chunk. Superseded viewport results cannot replace a newer requested view.

### Why and verification

Redrawing all background geometry during every zoom frame was substantially more expensive than reusing a raster during drag. Adding zoom easing would change the interaction the user preferred without removing this cost.

A synthetic headless Edge comparison at 1600 x 1000 and DPR 2 measured main-thread draw medians of approximately 28–58 ms for 2D before the change and 3–4 ms with background reuse in both modes. These are draw-cost measurements, not physical display FPS or a guarantee for mobile hardware. New chunk normalization still runs on the main thread and may warrant further profiling. Large data-bundle warnings also remain.

Regression checks: `node tools/check-background-renderer.mjs`, `node tools/check-viewport-cache.mjs`, and `npm run build`. The worker test checks latest-request coalescing, data reuse, bitmap lifetime, overview retention and synchronous fallback after failure.

## 2026-09-12 — Price review uses a local staging-to-approved pipeline

### Decision

Price enrichment is processed in four explicit stages: public source snapshot, structured review staging, human review, and approved JSON export. The reviewer must approve the complete detected price-option set for a venue; the compact map value remains the primary option while the full set is retained for the detailed view.

### Why

The previous prototype read source data directly in the browser and stored only local decisions. Separating staging from presentation gives parser output a testable contract, preserves provenance, and creates a clean path to a future API without pretending that local browser state is a backend.

### Current boundary

The first adapter is a zero-cost local transformation of the Helsinki Service Map snapshot. It does not use AI/OCR or network calls during staging. A future city should provide a source snapshot/adapter that emits the same staging contract rather than add city-specific UI logic.
