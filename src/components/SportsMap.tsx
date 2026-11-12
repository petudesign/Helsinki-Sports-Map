import { memo, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react'
import { AttributionControl, Map as LibreMap, LngLatBounds, NavigationControl, Popup, ScaleControl, setWorkerUrl, type ExpressionSpecification, type GeoJSONSource } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { FeatureCollection, LineString, MultiPolygon, Point, Polygon } from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'
import { activeCity } from '../config/city'
import boundary from '../data/helsinki-boundary.json'
import type { GeoPoint, MapDataset, SportFeature } from '../data/types'
import type { RouteResult } from '../routing'
import { text, type Locale } from '../i18n'
import { stressFlag } from '../dev/stress'
import { mapTheme as t } from '../design-system/mapTheme'

export type MapControls = { reset: () => void }
type Props = {
  ref?: Ref<MapControls>
  area: MapDataset
  features: SportFeature[]
  selected?: SportFeature
  onSelect: (feature: SportFeature | undefined) => void
  route?: RouteResult
  mode: '2d' | 'iso'
  locale: Locale
  /** "Near me" / "near address" origin, drawn as a position dot. */
  origin?: GeoPoint
  /** When this key changes, the camera fits fitTargets (search, filter or origin changed). */
  fitKey?: string
  fitTargets?: GeoPoint[]
}
const empty: FeatureCollection = { type: 'FeatureCollection', features: [] }
// Bundle the v6 module worker explicitly for both Vite dev and production URLs.
setWorkerUrl(workerUrl)
const stressMapError = import.meta.env.DEV && stressFlag('maperror')
const styleUrl = stressMapError ? '/__stress-missing-style.json' : import.meta.env.VITE_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/positron'
const openStreetMapFallbackStyle = {
  version: 8,
  sources: {
    openstreetmap: {
      type: 'raster',
      tiles: [stressMapError ? '/__stress-missing-tile/{z}/{x}/{y}.png' : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    },
  },
  layers: [{ id: 'openstreetmap-raster', type: 'raster', source: 'openstreetmap' }],
} as const
const appSourceIds = new Set(['helsinki', 'outside-helsinki', 'pitches', 'transit-zones', 'facilities', 'route', 'route-points', 'selected', 'origin'])
const isMobile = () => window.matchMedia('(max-width: 720px)').matches
const duration = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 420
// Camera moves are on-screen movement, so ease-in-out (the --ease-in-out curve, cubic approximation).
const easing = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
// On desktop the panel floats over the left 424 px of a full-width map, so the
// camera centres content in the visible area to its right. The default view
// then nudges 220 px east so the Espoo border stays out of the first frame.
const PANEL_INSET = 424
const DEFAULT_VIEW_EAST = 220
const defaultCameraOffset = (): [number, number] => isMobile() ? [0, 0] : [PANEL_INSET / 2 - DEFAULT_VIEW_EAST, 0]
const routeColors = { walk: '#2f7a55', bike: '#d07a2f', transit: '#4386a6', car: '#665846' } as const
const routePointColors = { start: '#245b7a', end: '#c75543', board: '#2d6e8a', alight: '#d07a2f', transfer: '#7656a8' } as const
type TransitZoneCollection = FeatureCollection<Polygon | MultiPolygon>
const emptyTransitZones: TransitZoneCollection = { type: 'FeatureCollection', features: [] }
const HSL_ZONES_URL = 'https://services1.arcgis.com/sswNXkUiRoWtrx0t/arcgis/rest/services/zones_all/FeatureServer/0/query?where=ZONE%20IN%20(%27A%27,%27B%27,%27C%27,%27D%27,%27E%27)&outFields=ZONE,NIMI_E&returnGeometry=true&outSR=4326&f=geojson'

async function loadTransitZones(): Promise<TransitZoneCollection> {
  const response = await fetch(HSL_ZONES_URL, { cache: 'force-cache', headers: { Accept: 'application/geo+json,application/json' } })
  if (!response.ok) throw new Error('HSL fare zones unavailable')
  const data = await response.json() as TransitZoneCollection
  return {
    ...data,
    features: data.features.flatMap((feature) => {
      const zone = String(feature.properties?.ZONE ?? feature.properties?.zone ?? '').trim().toUpperCase()
      return /^[A-E]$/.test(zone) ? [{ ...feature, properties: { ...(feature.properties ?? {}), zone } }] : []
    }),
  }
}

/*
 * Quiet the OpenFreeMap Positron basemap so it reads as part of the product:
 * sentence-case regular labels in the text-3 grey (no tracked uppercase or
 * italics), no road shields, white roads on a hairline casing, and names in
 * the UI language where OpenStreetMap has them (name:en / name:fi).
 */
function tuneBasemap(map: LibreMap, locale: Locale) {
  const set = (id: string, apply: () => void) => { if (map.getLayer(id)) { try { apply() } catch { /* layer shape differs in a custom style */ } } }
  const localizedName: ExpressionSpecification = ['coalesce', ['get', `name:${locale}`], ['get', 'name:latin'], ['get', 'name']]
  for (const layer of map.getStyle().layers) {
    if (layer.type !== 'symbol') continue
    const sourceLayer = 'source-layer' in layer ? layer['source-layer'] : ''
    if (sourceLayer === 'place') set(layer.id, () => {
      map.setLayoutProperty(layer.id, 'text-transform', 'none')
      map.setLayoutProperty(layer.id, 'text-letter-spacing', 0)
      map.setLayoutProperty(layer.id, 'text-font', [layer.id.includes('capital') || layer.id.includes('country') ? 'Noto Sans Bold' : 'Noto Sans Regular'])
      map.setLayoutProperty(layer.id, 'text-field', localizedName)
      map.setPaintProperty(layer.id, 'text-color', layer.id.includes('city') ? t.ink : t.label)
      map.setPaintProperty(layer.id, 'text-halo-color', t.halo)
      map.setPaintProperty(layer.id, 'text-halo-width', 1.5)
    })
    if (sourceLayer === 'water_name' || sourceLayer === 'waterway') set(layer.id, () => {
      map.setLayoutProperty(layer.id, 'text-font', ['Noto Sans Regular'])
      map.setLayoutProperty(layer.id, 'text-letter-spacing', 0)
      map.setLayoutProperty(layer.id, 'text-field', localizedName)
      map.setPaintProperty(layer.id, 'text-color', t.waterLabel)
    })
    if (sourceLayer === 'transportation_name') set(layer.id, () => {
      if (layer.id.includes('shield')) { map.setLayoutProperty(layer.id, 'visibility', 'none'); return }
      map.setPaintProperty(layer.id, 'text-color', t.labelSoft)
    })
  }
  for (const id of ['highway_major_inner', 'highway_motorway_inner', 'highway_minor']) set(id, () => map.setPaintProperty(id, 'line-color', t.road))
  for (const id of ['highway_major_casing', 'highway_motorway_casing']) set(id, () => map.setPaintProperty(id, 'line-color', t.roadCasing))
  set('building', () => map.setPaintProperty('building', 'fill-color', t.building))
  set('landuse_residential', () => map.setPaintProperty('landuse_residential', 'fill-color', t.residential))
}

// Map labels stay short; the full name is always in the panel.
const mapLabel = (name: string) => name.length > 36 ? `${name.slice(0, 34).trimEnd()}…` : name

function pointData(features: SportFeature[], locale: Locale): FeatureCollection<Point> {
  return { type: 'FeatureCollection', features: features.flatMap((feature) => feature.center ? [{
    type: 'Feature' as const, id: feature.id,
    properties: { id: feature.id, name: mapLabel(locale === 'en' ? feature.nameEn ?? feature.name ?? '' : feature.name ?? ''), sport: feature.sport },
    geometry: { type: 'Point' as const, coordinates: feature.center },
  }] : []) }
}

function transitModeLabel(locale: Locale, mode: string) {
  switch (mode.toUpperCase()) {
    case 'BUS': return text(locale, 'busMode')
    case 'TRAM': return text(locale, 'tramMode')
    case 'RAIL': return text(locale, 'trainMode')
    case 'SUBWAY': return text(locale, 'metroMode')
    case 'FERRY': return text(locale, 'ferryMode')
    default: return text(locale, 'transitMode')
  }
}

function routeLineData(route: RouteResult | undefined): FeatureCollection<LineString> {
  if (!route) return empty as FeatureCollection<LineString>
  const transitLegs = route.transit?.legs ?? []
  const transitFeatures = transitLegs.flatMap((leg, index) => {
    const fallback = [
      leg.fromCoordinates ?? (index === 0 ? route.origin : undefined),
      leg.toCoordinates ?? (index === transitLegs.length - 1 ? route.destination : undefined),
    ].filter((coordinate): coordinate is [number, number] => Boolean(coordinate))
    const coordinates = leg.geometry && leg.geometry.length > 1 ? leg.geometry : fallback
    return coordinates.length > 1 ? [{ type: 'Feature' as const, properties: { mode: leg.mode.toLowerCase() }, geometry: { type: 'LineString' as const, coordinates } }] : []
  })
  if (transitFeatures.length) return { type: 'FeatureCollection', features: transitFeatures }
  return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { mode: route.mode }, geometry: { type: 'LineString', coordinates: route.coordinates } }] }
}

function routePointData(route: RouteResult | undefined, locale: Locale): FeatureCollection<Point> {
  if (!route) return empty as FeatureCollection<Point>
  const events = (route.transit?.legs ?? []).flatMap((leg) => {
    if (leg.mode.toUpperCase() === 'WALK') return []
    return [
      leg.fromCoordinates ? { kind: 'board' as const, coordinates: leg.fromCoordinates, leg } : undefined,
      leg.toCoordinates ? { kind: 'alight' as const, coordinates: leg.toCoordinates, leg } : undefined,
    ].filter((event): event is NonNullable<typeof event> => Boolean(event))
  })
  const groups = new Map<string, typeof events>()
  for (const event of events) {
    const key = event.coordinates.map((value) => value.toFixed(6)).join(',')
    const group = groups.get(key) ?? []
    group.push(event)
    groups.set(key, group)
  }
  const stopFeatures = [...groups.values()].map((group) => {
    const [first] = group
    const board = group.find((event) => event.kind === 'board')
    const isTransfer = group.length > 1
    const label = isTransfer && board
      ? text(locale, 'transitChange', { mode: transitModeLabel(locale, board.leg.mode), route: board.leg.routeName ?? '—' })
      : first.kind === 'board'
        ? text(locale, 'transitBoard', { mode: transitModeLabel(locale, first.leg.mode), route: first.leg.routeName ?? '—' })
        : text(locale, 'transitAlight', { stop: first.leg.to ?? (locale === 'fi' ? 'määränpää' : 'destination') })
    return { type: 'Feature' as const, properties: { kind: isTransfer ? 'transfer' : first.kind, label }, geometry: { type: 'Point' as const, coordinates: first.coordinates } }
  })
  return {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { kind: 'start', label: locale === 'fi' ? 'Lähtö tästä' : 'Start here' }, geometry: { type: 'Point', coordinates: route.origin } },
      { type: 'Feature', properties: { kind: 'end', label: locale === 'fi' ? 'Perille' : 'Destination' }, geometry: { type: 'Point', coordinates: route.destination } },
      ...stopFeatures,
    ],
  }
}

export const SportsMap = memo(function SportsMap({ ref, area, features, selected, onSelect, route, mode, locale, origin, fitKey, fitTargets }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LibreMap | null>(null)
  const latest = useRef({ features, selected, onSelect, locale })
  latest.current = { features, selected, onSelect, locale }
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [usingOsmFallback, setUsingOsmFallback] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [transitZoneData, setTransitZoneData] = useState<TransitZoneCollection>(emptyTransitZones)
  const points = useMemo(() => pointData(features, locale), [features, locale])
  const polygons = useMemo<FeatureCollection<Polygon>>(() => ({
    type: 'FeatureCollection',
    features: (area.osmSports ?? []).map((feature) => ({
      type: 'Feature', properties: {}, geometry: { type: 'Polygon',
        coordinates: feature.rings.map((ring) => ring.map(({ x, y }) => [
          area.center[0] + x / (111_320 * Math.cos(area.center[1] * Math.PI / 180)),
          area.center[1] + y / 111_320,
        ])),
      },
    })),
  }), [area])

  useEffect(() => {
    const requestedZones = new Set(route?.transit?.zones ?? [])
    if (!requestedZones.size) {
      setTransitZoneData(emptyTransitZones)
      return
    }
    let cancelled = false
    loadTransitZones().then((data) => {
      if (!cancelled) setTransitZoneData({ ...data, features: data.features.filter((feature) => requestedZones.has(String(feature.properties?.zone ?? '').toUpperCase())) })
    }).catch(() => { if (!cancelled) setTransitZoneData(emptyTransitZones) })
    return () => { cancelled = true }
  }, [route?.transit?.zones?.join('|')])

  useImperativeHandle(ref, () => ({ reset() {
    mapRef.current?.easeTo({ center: activeCity.center, zoom: 11.7, bearing: 0, pitch: mode === 'iso' ? 45 : 0, offset: defaultCameraOffset(), padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: duration(), easing })
  } }), [mode])

  useEffect(() => {
    if (!container.current) return
    setReady(false)
    setFailed(false)
    let map: LibreMap
    try {
      map = new LibreMap({
        container: container.current, style: usingOsmFallback ? openStreetMapFallbackStyle : styleUrl, center: activeCity.center, zoom: 11.7,
        minZoom: 9, maxZoom: 19, maxBounds: [[24.35, 59.85], [25.65, 60.65]],
        renderWorldCopies: false, maxTileCacheSize: 512, cancelPendingTileRequestsWhileZooming: false, fadeDuration: 150, pixelRatio: Math.min(window.devicePixelRatio, 2),
        dragRotate: false, touchPitch: false, pitchWithRotate: false,
        attributionControl: false,
        canvasContextAttributes: { antialias: false },
      })
    } catch {
      setFailed(true)
      return
    }
    mapRef.current = map
    map.touchZoomRotate.disableRotation()
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new AttributionControl({ compact: true }), 'bottom-right')
    // MapLibre opens the compact attribution on load. That text block became the page's largest paint (LCP 7 s on
    // mobile), so the credit stays behind its "i" button until the user opens it (data-attrib-open, see ui.css).
    const attributionRoot = container.current
    const attributionBox = () => attributionRoot.querySelector('.maplibregl-ctrl-attrib')
    // Follow MapLibre's own open state after its click handler has run.
    const toggleAttribution = (event: Event) => { if ((event.target as HTMLElement).closest('.maplibregl-ctrl-attrib-button')) window.setTimeout(() => attributionRoot.toggleAttribute('data-attrib-open', Boolean(attributionBox()?.classList.contains('maplibregl-compact-show')))) }
    attributionRoot.addEventListener('click', toggleAttribution)
    map.addControl(new ScaleControl({ unit: 'metric', maxWidth: 90 }), 'bottom-left')
    const timeout = window.setTimeout(() => setFailed(true), 20000)
    const observer = new ResizeObserver(() => map.resize())
    observer.observe(container.current)
    let fallbackClusterCountOverlay: HTMLElement | undefined
    let updateFallbackClusterCounts: (() => void) | undefined
    // Native gestures animate the camera without any React state updates.
    // Once the raster fallback's own tiles fail too, the basemap stays marked as
    // broken: 'idle' fires even when every tile errored, so it must not clear it.
    let fallbackTilesBroken = false
    map.on('error', (event) => {
      const sourceId = 'sourceId' in event ? String(event.sourceId) : undefined
      if (!usingOsmFallback && (!sourceId || !appSourceIds.has(sourceId))) {
        setUsingOsmFallback(true)
        setFailed(false)
        return
      }
      if (usingOsmFallback && sourceId === 'openstreetmap') fallbackTilesBroken = true
      setFailed(true)
    })
    map.on('idle', () => { if (map.isStyleLoaded() && !fallbackTilesBroken) setFailed(false) })
    map.on('load', () => {
      window.clearTimeout(timeout)
      attributionBox()?.classList.remove('maplibregl-compact-show') // start closed, so the first tap opens it
      map.easeTo({ center: activeCity.center, zoom: 11.7, offset: defaultCameraOffset(), duration: 0 })
      // Keep the quiet basemap; make water/parks match the product palette.
      for (const layer of map.getStyle().layers) {
        if (layer.type === 'background') map.setPaintProperty(layer.id, 'background-color', t.ground)
        if (layer.type === 'fill' && 'source-layer' in layer && layer['source-layer'] === 'water') map.setPaintProperty(layer.id, 'fill-color', t.water)
        if (layer.type === 'fill' && 'source-layer' in layer && layer['source-layer'] === 'park') map.setPaintProperty(layer.id, 'fill-color', t.park)
      }
      if (!usingOsmFallback) tuneBasemap(map, latest.current.locale)
      map.addSource('helsinki', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: boundary[0].geojson as Polygon } })
      map.addSource('outside-helsinki', { type: 'geojson', data: {
        type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [
          [[20, 58], [30, 58], [30, 63], [20, 63], [20, 58]], boundary[0].geojson.coordinates[0],
        ] },
      } })
      map.addLayer({ id: 'outside-helsinki', type: 'fill', source: 'outside-helsinki', paint: { 'fill-color': t.outside, 'fill-opacity': 0.07 } })
      map.addLayer({ id: 'helsinki-boundary', type: 'line', source: 'helsinki', paint: { 'line-color': t.boundary, 'line-width': 1.25, 'line-dasharray': [3, 3] } })
      map.addSource('pitches', { type: 'geojson', data: polygons })
      map.addLayer({ id: 'pitches', type: 'fill', source: 'pitches', minzoom: 13, paint: { 'fill-color': '#82966f', 'fill-opacity': 0.3 } })
      map.addSource('transit-zones', { type: 'geojson', data: emptyTransitZones })
      map.addLayer({ id: 'transit-zone-fill', type: 'fill', source: 'transit-zones', paint: {
        'fill-color': ['match', ['get', 'zone'], 'A', '#84b9e5', 'B', '#63a6dc', 'C', '#4a91c7', 'D', '#347cb2', 'E', '#236b9d', '#75a9d0'],
        'fill-opacity': 0.18,
      } })
      map.addLayer({ id: 'transit-zone-boundary', type: 'line', source: 'transit-zones', paint: { 'line-color': '#2f73a7', 'line-width': 1.4, 'line-opacity': 0.68, 'line-dasharray': [2, 2] } })
      if (!usingOsmFallback) map.addLayer({ id: 'transit-zone-labels', type: 'symbol', source: 'transit-zones', layout: { 'text-field': ['get', 'zone'], 'text-font': ['Noto Sans Bold'], 'text-size': 18, 'text-allow-overlap': true }, paint: { 'text-color': '#235b87', 'text-halo-color': '#fffdf9', 'text-halo-width': 2 } })
      map.addSource('facilities', { type: 'geojson', data: pointData(latest.current.features, latest.current.locale), cluster: true, clusterMaxZoom: 14, clusterRadius: 42, attribution: 'LIPAS, University of Jyväskylä · CC BY 4.0' })
      // Clusters and places are one family: the accent, a white ring and a soft halo. Size carries the count.
      map.addLayer({ id: 'cluster-shadow', type: 'circle', source: 'facilities', filter: ['has', 'point_count'], paint: {
        'circle-color': t.shadow, 'circle-radius': ['step', ['get', 'point_count'], 16, 20, 19, 80, 22], 'circle-blur': 0.6, 'circle-translate': [0, 1.5],
      } })
      map.addLayer({ id: 'cluster-halo', type: 'circle', source: 'facilities', filter: ['has', 'point_count'], paint: {
        'circle-color': t.accentHalo, 'circle-radius': ['step', ['get', 'point_count'], 20, 20, 24, 80, 28], 'circle-blur': 0.4,
      } })
      map.addLayer({ id: 'clusters', type: 'circle', source: 'facilities', filter: ['has', 'point_count'], paint: {
        'circle-color': t.accent, 'circle-radius': ['step', ['get', 'point_count'], 15, 20, 18, 80, 21], 'circle-stroke-color': t.onAccent, 'circle-stroke-width': 2,
      } })
      if (usingOsmFallback) {
        // The raster fallback has no glyph source. Draw count labels in HTML so
        // clusters keep their numbers even when the vector style is unavailable.
        fallbackClusterCountOverlay = document.createElement('div')
        fallbackClusterCountOverlay.className = 'cluster-count-overlay'
        fallbackClusterCountOverlay.setAttribute('aria-hidden', 'true')
        map.getCanvasContainer().append(fallbackClusterCountOverlay)
        const labels = new Map<string, HTMLSpanElement>()
        updateFallbackClusterCounts = () => {
          const visible = new Set<string>()
          for (const feature of map.queryRenderedFeatures({ layers: ['clusters'] })) {
            if (feature.geometry.type !== 'Point' || feature.properties?.cluster_id == null) continue
            const clusterId = String(feature.properties.cluster_id)
            visible.add(clusterId)
            let label = labels.get(clusterId)
            if (!label) {
              label = document.createElement('span')
              label.className = 'cluster-count-label'
              labels.set(clusterId, label)
              fallbackClusterCountOverlay?.append(label)
            }
            label.textContent = String(feature.properties.point_count_abbreviated ?? feature.properties.point_count ?? '')
            const [longitude, latitude] = feature.geometry.coordinates as [number, number]
            const { x, y } = map.project([longitude, latitude])
            label.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
          }
          for (const [clusterId, label] of labels) {
            if (visible.has(clusterId)) continue
            label.remove()
            labels.delete(clusterId)
          }
        }
        map.on('render', updateFallbackClusterCounts)
      }
      if (!usingOsmFallback) map.addLayer({ id: 'cluster-count', type: 'symbol', source: 'facilities', filter: ['has', 'point_count'], layout: {
        'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-allow-overlap': true,
      }, paint: { 'text-color': t.onAccent } })
      map.addLayer({ id: 'facility-hit-area', type: 'circle', source: 'facilities', filter: ['!', ['has', 'point_count']], paint: { 'circle-radius': 22, 'circle-opacity': 0 } })
      map.addLayer({ id: 'facility-points', type: 'circle', source: 'facilities', filter: ['!', ['has', 'point_count']], paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 5, 16, 7],
        'circle-color': t.accent, 'circle-stroke-color': t.onAccent, 'circle-stroke-width': 2,
      } })
      if (!usingOsmFallback) map.addLayer({ id: 'facility-labels', type: 'symbol', source: 'facilities', minzoom: 15, filter: ['!', ['has', 'point_count']], layout: {
        'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-anchor': 'top', 'text-offset': [0, 1.2], 'text-max-width': 12,
      }, paint: { 'text-color': t.ink, 'text-halo-color': t.halo, 'text-halo-width': 1.5 } })
      map.addSource('route', { type: 'geojson', data: empty })
      map.addLayer({ id: 'route-casing', type: 'line', source: 'route', paint: { 'line-color': '#fffdf9', 'line-width': 8 } })
      map.addLayer({ id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': ['match', ['get', 'mode'], 'walk', routeColors.walk, 'bike', routeColors.bike, 'car', routeColors.car, routeColors.transit], 'line-width': 4 } })
      map.addSource('route-points', { type: 'geojson', data: empty })
      map.addLayer({ id: 'route-start', type: 'circle', source: 'route-points', filter: ['==', ['get', 'kind'], 'start'], paint: { 'circle-radius': 9, 'circle-color': routePointColors.start, 'circle-stroke-color': '#fffdf9', 'circle-stroke-width': 3 } })
      map.addLayer({ id: 'route-end', type: 'circle', source: 'route-points', filter: ['==', ['get', 'kind'], 'end'], paint: { 'circle-radius': 10, 'circle-color': routePointColors.end, 'circle-stroke-color': '#fffdf9', 'circle-stroke-width': 3 } })
      map.addLayer({ id: 'route-stop-points', type: 'circle', source: 'route-points', filter: ['match', ['get', 'kind'], ['board', 'alight', 'transfer'], true, false], paint: { 'circle-radius': 7, 'circle-color': ['match', ['get', 'kind'], 'board', routePointColors.board, 'alight', routePointColors.alight, 'transfer', routePointColors.transfer, routePointColors.board], 'circle-stroke-color': '#fffdf9', 'circle-stroke-width': 2 } })
      if (!usingOsmFallback) {
        map.addLayer({ id: 'route-point-labels', type: 'symbol', source: 'route-points', filter: ['match', ['get', 'kind'], ['start', 'end'], true, false], layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-anchor': 'top', 'text-offset': [0, 1.25], 'text-allow-overlap': true }, paint: { 'text-color': '#283b3e', 'text-halo-color': '#fffdf9', 'text-halo-width': 2 } })
        map.addLayer({ id: 'route-stop-labels', type: 'symbol', source: 'route-points', filter: ['match', ['get', 'kind'], ['board', 'alight', 'transfer'], true, false], layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Regular'], 'text-size': 10, 'text-anchor': 'top', 'text-offset': [0, 1.1], 'text-max-width': 16 }, paint: { 'text-color': '#283b3e', 'text-halo-color': '#fffdf9', 'text-halo-width': 2 } })
      }
      map.addSource('origin', { type: 'geojson', data: empty })
      // "You are here / near here": ink, not accent, so it never reads as a place.
      map.addLayer({ id: 'origin-halo', type: 'circle', source: 'origin', paint: { 'circle-radius': 16, 'circle-color': t.ink, 'circle-opacity': 0.1 } })
      map.addLayer({ id: 'origin-dot', type: 'circle', source: 'origin', paint: { 'circle-radius': 6, 'circle-color': t.ink, 'circle-stroke-color': t.halo, 'circle-stroke-width': 3 } })
      map.addSource('selected', { type: 'geojson', data: empty })
      // Selection is shown by size and a ring, not by a second colour.
      map.addLayer({ id: 'selected-halo', type: 'circle', source: 'selected', paint: { 'circle-radius': 22, 'circle-color': t.accentHalo } })
      map.addLayer({ id: 'selected-point', type: 'circle', source: 'selected', paint: { 'circle-radius': 10, 'circle-color': t.accent, 'circle-stroke-color': t.onAccent, 'circle-stroke-width': 3 } })
      if (!usingOsmFallback) map.addLayer({ id: 'selected-label', type: 'symbol', source: 'selected', layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': 13, 'text-anchor': 'top', 'text-offset': [0, 1.4], 'text-max-width': 14, 'text-allow-overlap': true }, paint: { 'text-color': t.ink, 'text-halo-color': t.halo, 'text-halo-width': 2 } })
      map.on('click', async (event) => {
        const hit = map.queryRenderedFeatures(event.point, { layers: ['selected-point', 'clusters', 'facility-hit-area'] })[0]
        if (hit?.properties?.cluster_id !== undefined && hit.geometry.type === 'Point') {
          try {
            const zoom = await (map.getSource('facilities') as GeoJSONSource).getClusterExpansionZoom(Number(hit.properties.cluster_id))
            if (mapRef.current === map) map.easeTo({ center: hit.geometry.coordinates as [number, number], zoom, duration: duration(), easing })
          } catch { /* A filter may replace the cluster while the click resolves. */ }
        } else if (hit) {
          // Tapping the selected place again deselects it.
          const id = hit.properties.id
          latest.current.onSelect(latest.current.selected?.id === id ? undefined : latest.current.features.find((feature) => feature.id === id))
        } else latest.current.onSelect(undefined)
      })
      for (const layer of ['clusters', 'facility-hit-area', 'selected-point']) {
        map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = '' })
      }
      // Hover tooltip (mouse only): the place's name, in the same surface as the panel.
      if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        const tooltip = new Popup({ closeButton: false, closeOnClick: false, offset: 12, className: 'map-tooltip', maxWidth: '240px' })
        map.on('mousemove', 'facility-hit-area', (event) => {
          const hit = event.features?.[0]
          if (!hit || hit.geometry.type !== 'Point') return
          tooltip.setLngLat(hit.geometry.coordinates as [number, number]).setText(String(hit.properties?.name || '')).addTo(map)
        })
        map.on('mouseleave', 'facility-hit-area', () => tooltip.remove())
      }
      setReady(true)
      setFailed(false)
    })
    return () => {
      attributionRoot.removeEventListener('click', toggleAttribution)
      window.clearTimeout(timeout)
      observer.disconnect()
      if (updateFallbackClusterCounts) map.off('render', updateFallbackClusterCounts)
      fallbackClusterCountOverlay?.remove()
      mapRef.current = null
      map.remove()
    }
  }, [attempt, polygons, usingOsmFallback])

  useEffect(() => {
    if (ready) (mapRef.current?.getSource('facilities') as GeoJSONSource)?.setData(points)
  }, [points, ready])

  useEffect(() => {
    if (ready) (mapRef.current?.getSource('transit-zones') as GeoJSONSource | undefined)?.setData(transitZoneData)
  }, [transitZoneData, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const visibility = route ? 'none' : 'visible'
    for (const layer of ['cluster-shadow', 'cluster-halo', 'clusters', 'cluster-count', 'facility-hit-area', 'facility-points', 'facility-labels']) {
      if (map.getLayer(layer)) map.setLayoutProperty(layer, 'visibility', visibility)
    }
  }, [route, ready])

  // The view before a place was opened, restored when the place is closed so the
  // user gets back the overview they were comparing, not a 100 m zoom.
  const cameraBeforeSelection = useRef<{ center: [number, number]; zoom: number } | undefined>(undefined)
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    ;(map.getSource('selected') as GeoJSONSource | undefined)?.setData(pointData(selected && !route ? [selected] : [], locale))
    if (selected?.center) {
      if (!cameraBeforeSelection.current) cameraBeforeSelection.current = { center: map.getCenter().toArray() as [number, number], zoom: map.getZoom() }
      // On a phone the detail sheet covers the lower ~55 % of the map, so the place is centred in the strip above it.
      map.easeTo({ center: selected.center, zoom: Math.max(map.getZoom(), 14.5),
        offset: isMobile() ? [0, -map.getContainer().clientHeight * 0.28] : defaultCameraOffset(), duration: duration(), easing,
      })
    } else if (!selected && !route && cameraBeforeSelection.current) {
      map.easeTo({ ...cameraBeforeSelection.current, duration: duration(), easing })
      cameraBeforeSelection.current = undefined
    }
  }, [selected, route, ready])

  useEffect(() => {
    if (ready) (mapRef.current?.getSource('origin') as GeoJSONSource | undefined)?.setData(origin ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: origin } }] } : empty)
  }, [origin, ready])

  const latestFitTargets = useRef(fitTargets)
  latestFitTargets.current = fitTargets
  const lastFitKey = useRef<string | undefined>(undefined)
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || fitKey === undefined) return
    const firstRun = lastFitKey.current === undefined
    lastFitKey.current = fitKey
    if (firstRun || latestFitTargets.current === undefined) return
    const targets = latestFitTargets.current
    if (!targets.length || latestFitTargets.current.length === area.sports.length) return
    cameraBeforeSelection.current = undefined
    const bounds = new LngLatBounds(targets[0], targets[0])
    targets.forEach((point) => bounds.extend(point))
    const mobile = isMobile()
    map.fitBounds(bounds, { padding: mobile ? { top: 140, right: 56, bottom: 96, left: 24 } : { top: 64, right: 72, bottom: 48, left: PANEL_INSET + 48 }, maxZoom: 15, duration: duration(), easing })
  }, [fitKey, ready, area.sports.length])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    ;(map.getSource('route') as GeoJSONSource | undefined)?.setData(routeLineData(route))
    ;(map.getSource('route-points') as GeoJSONSource | undefined)?.setData(routePointData(route, locale))
    if (route?.coordinates.length) {
      const bounds = new LngLatBounds(route.origin, route.destination)
      route.coordinates.forEach((coordinate) => bounds.extend(coordinate))
      const mobile = window.matchMedia('(max-width: 720px)').matches
      map.resize()
      const mapHeight = map.getContainer().clientHeight
      const mobileTopPadding = Math.min(60, Math.max(24, Math.round(mapHeight * 0.14)))
      const mobileBottomPadding = Math.min(150, Math.max(40, mapHeight - mobileTopPadding - 32))
      map.fitBounds(bounds, {
        padding: mobile
          ? { top: mobileTopPadding, left: 28, right: 65, bottom: mobileBottomPadding }
          : { top: 80, left: PANEL_INSET + 40, right: 80, bottom: 65 },
        maxZoom: 15, duration: duration(), easing,
      })
    }
  }, [route, ready, locale])

  useEffect(() => { if (ready) mapRef.current?.easeTo({ pitch: mode === 'iso' ? 45 : 0, duration: duration(), easing }) }, [mode, ready])
  useEffect(() => { if (ready && !usingOsmFallback && mapRef.current) tuneBasemap(mapRef.current, locale) }, [locale, ready, usingOsmFallback])

  // MapLibre's own buttons are labelled in English; keep them in the UI language.
  useEffect(() => {
    const root = container.current
    if (!ready || !root) return
    const labels: Record<string, [string, string]> = { '.maplibregl-ctrl-zoom-in': ['Zoom in', 'Lähennä'], '.maplibregl-ctrl-zoom-out': ['Zoom out', 'Loitonna'], '.maplibregl-ctrl-attrib-button': ['Show map attribution', 'Näytä kartan lähdetiedot'] }
    for (const [selector, [en, fi]] of Object.entries(labels)) root.querySelectorAll<HTMLElement>(selector).forEach((button) => { const label = locale === 'fi' ? fi : en; button.setAttribute('aria-label', label); button.title = label })
  }, [locale, ready])

  useEffect(() => {
    const canvas = mapRef.current?.getCanvas()
    canvas?.setAttribute('aria-label', locale === 'fi' ? 'Liikuntapaikkakartta. Liiku nuolinäppäimillä ja zoomaa plus- ja miinusnäppäimillä. Kohteet löytyvät myös listasta.' : 'Sports map. Use arrow keys to pan and plus or minus to zoom. Facilities are also available in the list.')
  }, [locale, ready])

  return <>
    <div ref={container} className="sports-map" data-ready={ready} />
    {(!ready || failed) && <div className={`map-status ${failed ? 'is-error' : ''}`} role="status">
      {failed ? <>
        <span><strong>{locale === 'fi' ? 'Taustakartta ei latautunut.' : 'The background map didn’t load.'}</strong> {ready ? (locale === 'fi' ? 'Paikat näkyvät silti, ja lista toimii.' : 'Places are still shown and the list works.') : (locale === 'fi' ? 'Paikat löytyvät listasta.' : 'You can still browse places in the list.')}</span>
        <button type="button" onClick={() => { setFailed(false); setUsingOsmFallback(false); setAttempt((value) => value + 1) }}>{locale === 'fi' ? 'Yritä uudelleen' : 'Try again'}</button>
      </> : (locale === 'fi' ? 'Ladataan karttaa…' : 'Loading map…')}
    </div>}
  </>
})
