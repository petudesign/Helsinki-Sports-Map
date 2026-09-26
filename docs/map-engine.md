# Map engine

The main map uses MapLibre GL JS with the OpenFreeMap Positron vector style. Set `VITE_MAP_STYLE_URL` at build time to use another compatible style/provider. Keep attribution enabled. Default styles, tiles and glyphs require a network connection; this is not an offline map.

The old custom renderer and source extracts are retained for reference, but are not imported by the application. `src/config/city.ts` loads the facility dataset once. Panning and zooming are handled inside MapLibre, not in React state. Facilities are a clustered GeoJSON layer, not hundreds of DOM markers. Selected facilities and routes use separate sources so they do not rebuild clusters. The tile cache is bounded and canvas pixel ratio is capped at 2.

`SportsMap.tsx` imports the MapLibre v6 worker through Vite's `?worker&url` loader. Do not remove this: the default relative worker path does not survive dependency prebundling.

After OSM data imports run `npm run data:venue-map`. After LIPAS imports run `npm run data:lipas:runtime`. Full LIPAS geometries remain in the source snapshot; runtime data retains the exact anchor consumed by the app. The basemap now covers more than the current facility dataset: keep the coverage notice until the dataset is expanded.

Verification: `npm run build`, `npm run check:map`, `npm run check:lipas`, and `npm run check:lipas:classification`. In a browser also check pinch in/out, one-finger pan, cluster expansion, point selection, filtering, list paging, card scrolling, keyboard navigation, small screens, tile failure/retry and production worker loading. A touch-emulated browser test is not a substitute for a real iPhone/Android hardware check.
