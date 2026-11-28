# Helsinki Sports Map

An accessible sports discovery map for Helsinki, built on public data to help people find places to move by sport, location, travel time, price, accessibility, and other practical details.

> Work in progress — the map covers Helsinki and is actively being refined with richer venue metadata and discovery tools.

## Live demo

https://helsinki-sports-map.vercel.app/

## Why

Helsinki has a large amount of sports infrastructure, but information about facilities, access, pricing, routes, and availability is spread across different datasets and services.

Helsinki Sports Map brings that information into one place to help answer practical questions such as:

- Where can I play basketball near me?
- What sports facilities can I reach in 10–20 minutes?
- Is a venue free or paid?
- Is it accessible?
- How long does it take to get there by walking, bike, car, or HSL public transport?
- Can I use or reserve the facility at the time I need it?

The long-term goal is to make the underlying system reusable beyond Helsinki as well.

## Current features

- **Interactive vector map**: MapLibre GL JS with 2D and tilted views, native pinch zoom, touch panning, clustered GeoJSON markers, and a draggable mobile sheet
- **Smart search**: Search by sport, venue name, Helsinki district (178 districts), place, or street address
- **Practical filters**: Filter by sport, price (free / paid), accessibility (step-free entrance, accessible toilet, accessible parking), children & families, and saved favorites
- **Meet-halfway search**: Type two Helsinki districts into the search bar (e.g. `"Kallio ja Lauttasaari"` or `"padel Kamppi Töölö"`) to rank and map sports facilities fairly between both areas
- **Saved favorites**: Star your regular venues locally in the browser (no account required) and filter by saved places
- **Routing & HSL public transport**: Walking, cycling, driving, and HSL public transport routes with travel time, distance, step-by-step transit legs, and HSL fare zone (A–E) overlay and ticket guidance
- **Flexible starting points**: Use your current location (optional) or pick any Helsinki address, place, or district
- **Enriched venue details**: Combined LIPAS and Helsinki Service Map metadata including venue photos, opening hours (where available), accessibility details, and direct links to official pages
- **Bilingual UI**: Finnish (`?lang=fi`) and English (`?lang=en`)
- **Accessibility**: Keyboard-accessible facility list, screen-reader-friendly controls, and source-backed accessibility attributes
- **SEO & AI discovery**: Static indexable sport directory pages (HTML + JSON-LD), `sitemap.xml`, `robots.txt`, and `llms.txt` generated at build time
- **Privacy controls**: Optional analytics consent (analytics is not active yet; location, searches, and routes are never stored in cookies)

Map configuration and data regeneration: [map engine notes](docs/map-engine.md).

## Current status

The project is under active development. Current focus areas:

- Expanding pricing, opening hours, and official reservation links across venues
- Improving search, filtering, and discovery workflows
- Adding travel-time and multi-person discovery features
- Refining mobile and desktop polish, performance, and accessibility

## Planned features

- Travel-time areas such as “within 10 / 20 / 30 minutes” (isochrones)
- Helsinki sports facility reservation / availability links and fuller pricing & opening hours coverage
- Real trending and sports-density map layers
- Additional languages through community-supported translations
- Architecture extended to other cities (starting with Espoo, Vantaa, and other municipalities)

## Accessibility

Accessibility is treated as a core part of the product rather than a separate mode.

Current and ongoing work includes:

- Keyboard-accessible facility browsing and screen-reader-friendly lists and controls
- Optional location access (typing an address or district always works)
- Avoiding reliance on color alone
- Filters and detail views for step-free entrance, accessible toilet, accessible parking, lift, ramp, and wheelchair space where reliable data is available

## Privacy

Analytics is optional and not active yet.

Precise location, entered addresses, searches, and route endpoints are never saved in cookies or used as analytics data. Location access is only requested when the user explicitly chooses to use their current location, and user-derived route and reverse-geocoding API responses are not CDN-cached.

See [docs/PRIVACY.md](docs/PRIVACY.md) and [docs/security-model.md](docs/security-model.md) for details.

## Data

The application combines and normalizes public geographic and sports facility data:

- **LIPAS** (University of Jyväskylä, CC BY 4.0) — Helsinki sports facility registry (3,000+ runtime sites grouped into 1,300+ facilities)
- **City of Helsinki Service Map (Palvelukartta)** — 1,065 matched units providing venue photos (532), opening hours (193), accessibility attributes, family signals, and official links
- **HSL & Digitransit** — public transport routing via a server-side proxy (`DIGITRANSIT_API_KEY`) and HSL fare zones (CC BY 4.0)
- **OpenStreetMap ecosystem**
  - Nominatim for bounded, user-triggered geocoding and reverse geocoding fallback (never used for autocomplete)
  - OpenStreetMap-based routing for walking, cycling, and driving
- **Helsinki Paikkatietohaku** — exact address resolution through a server-side proxy when `PAIKKATIETO_API_KEY` is configured
- **Helsinki WFS street index & district data** — street-name prefix discovery and district lookup for live search suggestions

The data layer is kept separate from the UI so additional sources, municipalities, and providers can be plugged in later.

## Tech

- React 19, TypeScript, Vite 8
- MapLibre GL JS (WebGL vector map with OpenFreeMap Positron basemap tiles, configurable via `VITE_MAP_STYLE_URL`)
- Clustered GeoJSON facilities, separate route and HSL fare zone layers
- Serverless API proxies (`api/`) with shared validation and rate limiting (`server/security.mjs`)
- Data import, validation, and static SEO page generation scripts (`tools/`)
- Hosted on Vercel

The main map uses MapLibre for native touch gestures, zoom-dependent vector tiles, and worker-based clustering. The tilted view uses the same map instance as the 2D view.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

The dev server runs on `http://localhost:4180` and mounts the same API handlers as production.

### Environment variables

API keys are server-only and must never be prefixed with `VITE_`:

- `PAIKKATIETO_API_KEY` — Helsinki Paikkatietohaku key for exact address resolution
- `DIGITRANSIT_API_KEY` — Digitransit subscription key for HSL public transport routing
- `VITE_MAP_STYLE_URL` — optional compatible MapLibre style URL (defaults to OpenFreeMap Positron; other hosts must also be allowed in `vercel.json` CSP)

Set the same variables in Vercel project settings for deployments.

### Useful scripts

- `npm run dev` — start local dev server
- `npm run build` — type-check, build the app, and generate static SEO directory pages
- `npm run check:map`, `npm run check:routing`, `npm run check:transit`, `npm run check:venues`, `npm run check:lipas`, `npm run check:service-map` — data and routing verification checks
- `npm run data:lipas`, `npm run data:lipas:runtime`, `npm run data:service-map`, `npm run data:districts`, `npm run data:venue-map` — dataset import and build scripts

Dev-only UI previews:

- `/?design-system=1` — component and state preview
- `/?stress` — worst-case data stress-test toggle

## Architecture

The project separates sports facility data from map rendering, with dedicated modules for:

- Map rendering and layers (`src/components/SportsMap.tsx`, `src/components/map/`)
- Facility data normalization (`src/data/`, `src/config/city.ts`)
- Search, filtering, geocoding, and routing (`src/search.ts`, `src/filters.ts`, `src/geocoding.ts`, `src/routing.ts`)
- Localization and privacy (`src/i18n.ts`, `src/privacy.ts`)
- Server-side lookup proxies and security helpers (`api/`, `server/`)
- Data import, validation, and SEO generation (`tools/`)

Basemap roads, buildings, and surfaces come from vector tiles, so the app only bundles the facility dataset (`src/data/venue-map.json`, the LIPAS runtime snapshot, and the matched Helsinki Service Map snapshot). Large raw extracts live in `data/raw/` and are never imported by the app.

## Localization

The interface currently supports:

- Finnish (`fi`)
- English (`en`)

The localization structure is designed so additional languages can be added through translation files without changing application logic. Community-supported translations are planned where native speakers can review them.

## Product direction

Helsinki is the first implementation, not a permanent technical limitation. The longer-term direction is a reusable sports discovery platform where city-specific data providers plug into the same normalized venue model, with Espoo, Vantaa, and other municipalities as natural next steps.

## Documentation

- [Product decisions and implementation notes](docs/PRODUCT_DECISIONS.md)
- [Map engine notes](docs/map-engine.md)
- [Code-first design system](docs/design-system.md)
- [Security model](docs/security-model.md)
- [Privacy notes](docs/PRIVACY.md)
- [Reviewer workbench](docs/review-workbench.md)
- [Review pipeline](docs/review-pipeline.md)
- [Translation workflow](translations/README.md)
