import { memo, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react'
import { AttributionControl, Map as LibreMap, LngLatBounds, NavigationControl, ScaleControl, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { FeatureCollection, LineString, MultiPolygon, Point, Polygon } from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'
import { activeCity } from '../config/city'
import boundary from '../data/helsinki-boundary.json'
import type { MapDataset, SportFeature } from '../data/types'
import type { RouteResult } from '../routing'
import { text, type Locale } from '../i18n'

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
}
const empty: FeatureCollection = { type: 'FeatureCollection', features: [] }
// Bundle the v6 module worker explicitly for both Vite dev and production URLs.
setWorkerUrl(workerUrl)
const styleUrl = import.meta.env.VITE_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/positron'
const openStreetMapFallbackStyle = {
  version: 8,
  sources: {
    openstreetmap: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    },
  },
  layers: [{ id: 'openstreetmap-raster', type: 'raster', source: 'openstreetmap' }],
} as const
const appSourceIds = new Set(['helsinki', 'outside-helsinki', 'pitches', 'transit-zones', 'facilities', 'route', 'route-points', 'selected'])
const duration = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 350
const defaultCameraOffset = (): [number, number] => window.matchMedia('(min-width: 721px)').matches ? [-220, 0] : [0, 0]
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

function pointData(features: SportFeature[], locale: Locale): FeatureCollection<Point> {
  return { type: 'FeatureCollection', features: features.flatMap((feature) => feature.center ? [{
    type: 'Feature' as const, id: feature.id,
    properties: { id: feature.id, name: locale === 'en' ? feature.nameEn ?? feature.name ?? '' : feature.name ?? '', sport: feature.sport },
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

export const SportsMap = memo(function SportsMap({ ref, area, features, selected, onSelect, route, mode, locale }: Props) {
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
    mapRef.current?.easeTo({ center: activeCity.center, zoom: 11.7, bearing: 0, pitch: mode === 'iso' ? 45 : 0, offset: defaultCameraOffset(), padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: duration() })
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
        renderWorldCopies: false, maxTileCacheSize: 128, pixelRatio: Math.min(window.devicePixelRatio, 2),
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
    map.addControl(new ScaleControl({ unit: 'metric', maxWidth: 90 }), 'bottom-left')
    const timeout = window.setTimeout(() => setFailed(true), 20000)
    const observer = new ResizeObserver(() => map.resize())
    observer.observe(container.current)
    // Native gestures animate the camera without any React state updates.
    map.on('error', (event) => {
      const sourceId = 'sourceId' in event ? String(event.sourceId) : undefined
      if (!usingOsmFallback && (!sourceId || !appSourceIds.has(sourceId))) {
        setUsingOsmFallback(true)
        setFailed(false)
        return
      }
      setFailed(true)
    })
    map.on('idle', () => { if (map.isStyleLoaded()) setFailed(false) })
    map.on('load', () => {
      window.clearTimeout(timeout)
      map.easeTo({ center: activeCity.center, zoom: 11.7, offset: defaultCameraOffset(), duration: 0 })
      const attributionButton = container.current?.querySelector<HTMLElement>('.maplibregl-ctrl-attrib-button')
      if (attributionButton?.parentElement?.classList.contains('maplibregl-compact-show')) attributionButton.click()
      // Keep the quiet basemap; make water/parks match the product palette.
      for (const layer of map.getStyle().layers) {
        if (layer.type === 'background') map.setPaintProperty(layer.id, 'background-color', '#f4f1e9')
        if (layer.type === 'fill' && 'source-layer' in layer && layer['source-layer'] === 'water') map.setPaintProperty(layer.id, 'fill-color', '#bedade')
        if (layer.type === 'fill' && 'source-layer' in layer && layer['source-layer'] === 'park') map.setPaintProperty(layer.id, 'fill-color', '#dce3d2')
      }
      map.addSource('helsinki', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: boundary[0].geojson as Polygon } })
      map.addSource('outside-helsinki', { type: 'geojson', data: {
        type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [
          [[20, 58], [30, 58], [30, 63], [20, 63], [20, 58]], boundary[0].geojson.coordinates[0],
        ] },
      } })
      map.addLayer({ id: 'outside-helsinki', type: 'fill', source: 'outside-helsinki', paint: { 'fill-color': '#737b82', 'fill-opacity': 0.24 } })
      map.addLayer({ id: 'helsinki-boundary', type: 'line', source: 'helsinki', paint: { 'line-color': '#68797b', 'line-width': 1.5, 'line-dasharray': [4, 3] } })
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
      map.addLayer({ id: 'clusters', type: 'circle', source: 'facilities', filter: ['has', 'point_count'], paint: {
        'circle-color': '#0755a0', 'circle-radius': ['step', ['get', 'point_count'], 18, 20, 23, 80, 28], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2,
      } })
      if (!usingOsmFallback) map.addLayer({ id: 'cluster-count', type: 'symbol', source: 'facilities', filter: ['has', 'point_count'], layout: {
        'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Regular'], 'text-size': 12,
      }, paint: { 'text-color': '#ffffff' } })
      map.addLayer({ id: 'facility-hit-area', type: 'circle', source: 'facilities', filter: ['!', ['has', 'point_count']], paint: { 'circle-radius': 22, 'circle-opacity': 0 } })
      map.addLayer({ id: 'facility-points', type: 'circle', source: 'facilities', filter: ['!', ['has', 'point_count']], paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 6, 16, 9],
        'circle-color': '#b9543e', 'circle-stroke-color': '#fffdf9', 'circle-stroke-width': 2,
      } })
      if (!usingOsmFallback) map.addLayer({ id: 'facility-labels', type: 'symbol', source: 'facilities', minzoom: 15, filter: ['!', ['has', 'point_count']], layout: {
        'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-anchor': 'top', 'text-offset': [0, 1.2], 'text-max-width': 12,
      }, paint: { 'text-color': '#283b3e', 'text-halo-color': '#fffdf9', 'text-halo-width': 2 } })
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
      map.addSource('selected', { type: 'geojson', data: empty })
      map.addLayer({ id: 'selected-point', type: 'circle', source: 'selected', paint: { 'circle-radius': 12, 'circle-color': '#b9543e', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 4 } })
      map.on('click', async (event) => {
        const hit = map.queryRenderedFeatures(event.point, { layers: ['selected-point', 'clusters', 'facility-hit-area'] })[0]
        if (hit?.properties?.cluster_id !== undefined && hit.geometry.type === 'Point') {
          try {
            const zoom = await (map.getSource('facilities') as GeoJSONSource).getClusterExpansionZoom(Number(hit.properties.cluster_id))
            if (mapRef.current === map) map.easeTo({ center: hit.geometry.coordinates as [number, number], zoom, duration: duration() })
          } catch { /* A filter may replace the cluster while the click resolves. */ }
        } else if (hit) {
          latest.current.onSelect(latest.current.features.find((feature) => feature.id === hit.properties.id))
        } else latest.current.onSelect(undefined)
      })
      for (const layer of ['clusters', 'facility-hit-area', 'selected-point']) {
        map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = '' })
      }
      setReady(true)
      setFailed(false)
    })
    return () => { window.clearTimeout(timeout); observer.disconnect(); mapRef.current = null; map.remove() }
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
    for (const layer of ['clusters', 'cluster-count', 'facility-hit-area', 'facility-points', 'facility-labels']) {
      if (map.getLayer(layer)) map.setLayoutProperty(layer, 'visibility', visibility)
    }
  }, [route, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    ;(map.getSource('selected') as GeoJSONSource | undefined)?.setData(pointData(selected && !route ? [selected] : [], locale))
    if (selected?.center) {
      const mobile = window.matchMedia('(max-width: 720px)').matches
      map.easeTo({ center: selected.center, zoom: Math.max(map.getZoom(), 15),
        offset: mobile ? [0, -map.getContainer().clientHeight * 0.2] : [-100, 0], duration: duration(),
      })
    }
  }, [selected, route, ready])

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
          : { top: 80, left: 40, right: 350, bottom: 65 },
        maxZoom: 15, duration: duration(),
      })
    }
  }, [route, ready, locale])

  useEffect(() => { if (ready) mapRef.current?.easeTo({ pitch: mode === 'iso' ? 45 : 0, duration: duration() }) }, [mode, ready])
  useEffect(() => {
    const canvas = mapRef.current?.getCanvas()
    canvas?.setAttribute('aria-label', locale === 'fi' ? 'Liikuntapaikkakartta. Liiku nuolinäppäimillä ja zoomaa plus- ja miinusnäppäimillä. Kohteet löytyvät myös listasta.' : 'Sports map. Use arrow keys to pan and plus or minus to zoom. Facilities are also available in the list.')
  }, [locale, ready])

  return <>
    <div ref={container} className="sports-map" data-ready={ready} />
    {(!ready || failed) && <div className="map-status" role="status">
      {failed ? <>{locale === 'fi' ? 'Taustakarttaa ei voitu ladata. Voit käyttää kohdelistaa.' : 'The basemap could not load. You can still use the facility list.'}<button onClick={() => { setFailed(false); setUsingOsmFallback(false); setAttempt((value) => value + 1) }}>{locale === 'fi' ? 'Yritä uudelleen' : 'Retry'}</button></> : (locale === 'fi' ? 'Ladataan karttaa…' : 'Loading map…')}
    </div>}
  </>
})
