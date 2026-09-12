# Helsinki-Sports-Map

An accessible sports discovery map for Helsinki, built on public data to help people find places to move by sport, location, travel time, price, accessibility, and other practical details.

> Work in progress — the map is currently being expanded toward full Helsinki coverage.

## Live demo

https://helsinki-sports-map.vercel.app/

## Why

Helsinki has a large amount of sports infrastructure, but information about facilities, access, pricing, routes, and availability is spread across different datasets and services.

Helsinki Sports Map aims to bring that information into one place and make it easier to answer practical questions such as:

- Where can I play basketball near me?
- What sports facilities can I reach in 10–20 minutes?
- Is a venue free or paid?
- Is it accessible?
- How long does it take to get there?
- Can I use or reserve the facility at the time I need it?

The long-term goal is to make the underlying system reusable beyond Helsinki as well.

## Current features

- 2D and isometric map views
- Sports facility browsing
- Sport and facility filtering
- Address search
- Optional current-location lookup
- Walking, cycling, and driving routes
- Travel time and distance estimates
- Finnish and English localization
- Keyboard-accessible facility list
- Privacy controls for analytics
- Public sports facility data from LIPAS
- Custom map rendering and chunked map data

## Current status

The project is under active development.

Current work includes:

- Expanding coverage across all of Helsinki
- Improving zoom performance
- Reducing duplicate and overlapping venue markers
- Improving filters and information hierarchy
- Adding richer venue metadata
- Improving accessibility information
- Preparing better search and discovery flows

## Planned features

Some of the planned directions include:

- Public transport routing
- Travel-time areas such as “within 10 / 20 / 30 minutes”
- Meet-halfway search for two or more starting points
- Better accessibility filters
- Venue pricing and access information
- Helsinki sports facility reservation / availability links
- Trending and sports-density map layers
- Venue pages designed for search engines and AI search
- Additional languages through community-supported translations
- Architecture that can later support other cities

## Accessibility

Accessibility is treated as a core part of the product rather than a separate mode.

Current and planned work includes:

- Keyboard-accessible facility browsing
- Screen-reader-friendly facility lists and controls
- Optional location access
- Avoiding reliance on color alone
- Accessible venue information where reliable data is available
- Filters for accessibility-related facility attributes

The goal is to make the map useful for people with different needs, devices, and ways of navigating the interface.

## Privacy

Analytics is optional.

The product is being designed so that precise location, entered addresses, searches, and route endpoints are not used as analytics data.

Location access is only requested when the user explicitly chooses to use their current location.

## Data

The application combines and normalizes public geographic and sports facility data.

Current sources and services include:

- **LIPAS** — sports facility data
- **OpenStreetMap ecosystem**
  - Nominatim for geocoding and reverse geocoding
  - OpenStreetMap-based routing for walking, cycling, and driving
- Additional City of Helsinki data sources are being explored

The data layer is intentionally kept separate from the UI so that additional sources, municipalities, and providers can be added later.

## Tech

- React
- TypeScript
- Vite
- HTML Canvas 2D
- Custom 2D and isometric map rendering
- Custom geographic projection layer
- Chunked map datasets
- LIPAS data import and validation scripts
- Nominatim geocoding
- OpenStreetMap-based routing
- Vercel

The project does not currently use Leaflet as its map renderer. The map is drawn through a custom Canvas-based renderer so that the same normalized geographic data can support both the 2D and isometric views while each view retains control over its own projection and visual treatment.

## Architecture

The project separates sports facility data from map rendering.

The same normalized venue and geographic data can be used by different map views, while rendering-specific behavior remains inside the renderer layer.

The repository currently contains dedicated modules for:

- map rendering
- projection
- sport rendering
- landmarks
- routing
- localization
- privacy
- data import and validation

This keeps the product flexible enough to add new data providers or cities without tying the UI directly to one source.

## Performance

The map uses chunked geographic data so that only relevant parts of the map need to be loaded and rendered.

Performance work is currently focused especially on zooming, where roads, buildings, surfaces, and markers may need to be reprojected and redrawn.

## Localization

The interface currently supports:

- Finnish
- English

The localization structure is designed so that additional languages can be added through translation files without changing the application logic.

Community-supported translations are planned for languages where native speakers are available to review them.

## Product direction

Helsinki is the first implementation, not intended to be a permanent technical limitation.

The longer-term direction is a reusable sports discovery platform where city-specific data providers can plug into the same normalized venue model.

Potential future cities include Espoo, Vantaa, and other municipalities.

## Documentation

- [Product decisions and implementation notes](docs/PRODUCT_DECISIONS.md)
- [Reviewer workbench](docs/review-workbench.md)
- [Review pipeline](docs/review-pipeline.md)
- [Code-first design system](docs/design-system.md)
- [Security model](docs/security-model.md)
- [Translation workflow](translations/README.md)

The reviewer workbench prototype is available locally at `/?review=1`. It is intentionally local-only and does not publish or mutate map data.

The component and state preview is available locally at `/?design-system=1`.
