import { accessProfileForUrl, createLipasFeatures, findLipasVenue } from './lipas'
import type { Bounds, GeoJsonFeature, GeoPoint, MapChunkManifest, MapDataset, MapPoint, MapViewport, SportFeature, SportsVenue, StudyAreaGeoJson } from './types'
import { createProjector, toLocalMetres } from '../renderer/projection'
import { venueProfile } from './venueLinks'
import { serviceMapForUnit, serviceMapForUrl } from './serviceMap'

function estimatedHeight(id: string, explicitHeight?: number) {
  if (explicitHeight) return Math.max(5, Math.min(explicitHeight, 48))
  const hash = [...id].reduce((total, character) => total + character.charCodeAt(0), 0)
  return 9 + (hash % 5) * 2.4
}

function boundsOf(points: MapPoint[]): Bounds {
  return points.reduce((bounds, point) => ({
    minX: Math.min(bounds.minX, point.x), minY: Math.min(bounds.minY, point.y),
    maxX: Math.max(bounds.maxX, point.x), maxY: Math.max(bounds.maxY, point.y),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity })
}

function boundsOfRings(rings: MapPoint[][]) {
  return boundsOf(rings.flat())
}

function centerOfGeoRing(ring: GeoPoint[]): GeoPoint {
  const points = ring.slice(0, -1)
  const total = points.reduce(([longitude, latitude], [pointLongitude, pointLatitude]) => [longitude + pointLongitude, latitude + pointLatitude], [0, 0] as GeoPoint)
  return [total[0] / Math.max(points.length, 1), total[1] / Math.max(points.length, 1)]
}

function normalizedVenueName(name: string | undefined) {
  return (name ?? '').toLocaleLowerCase('fi-FI').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '')
}

function mergeVenueSources(lipasVenues: SportsVenue[], osmVenues: SportsVenue[]) {
  const venues = new Map<string, SportsVenue>()
  lipasVenues.forEach((venue) => venues.set(normalizedVenueName(venue.name), venue))
  osmVenues.forEach((venue) => {
    const key = normalizedVenueName(venue.name)
    const existing = venues.get(key)
    if (!existing || !key) { venues.set(`${key}:${venue.id}`, venue); return }
    venues.set(key, {
      ...existing,
      sports: [...new Set([...existing.sports, ...venue.sports])],
      officialUrl: existing.officialUrl ?? venue.officialUrl,
      serviceMap: existing.serviceMap ?? venue.serviceMap,
      provenance: { sources: [...(existing.provenance?.sources ?? []), ...(venue.provenance?.sources ?? [])] },
    })
  })
  return [...venues.values()]
}

export function createArea(geojson: StudyAreaGeoJson): MapDataset {
  const [west, south, east, north] = geojson.bbox
  const project = (point: GeoPoint) => toLocalMetres(point, geojson.center)
  const southWest = project([west, south])
  const northEast = project([east, north])
  const sports: SportFeature[] = geojson.features.flatMap((feature) => {
    if (feature.properties.category !== 'sport' || feature.geometry.type !== 'Polygon') return []
    const facilityType = feature.properties.osmTags?.leisure
    const sourceSports = feature.properties.osmTags?.sport?.split(';').map((value) => value.trim()).filter((value) => value && !['multi', 'sports_centre'].includes(value)) ?? []
    const rawSport = feature.properties.sport && !['multi', 'sports_centre'].includes(feature.properties.sport) ? feature.properties.sport : undefined
    const sport = rawSport ?? sourceSports[0] ?? (facilityType === 'pitch' ? 'multi' : facilityType === 'fitness_station' ? 'outdoor_fitness' : 'multi')
    const rings = feature.geometry.coordinates.map((ring) => ring.map(project))
    return [{ id: feature.id ?? 'sport', name: feature.properties.name, sport, sports: sourceSports.length > 0 ? sourceSports : sport === 'multi' ? [] : [sport], facilityType, rings, bounds: boundsOfRings(rings), center: centerOfGeoRing(feature.geometry.coordinates[0]) }]
  })
  const osmVenues: SportsVenue[] = sports.map((feature) => {
    const profile = venueProfile(feature.id)
    const lipasMatch = feature.center ? findLipasVenue(feature.name, feature.center) : undefined
    return {
      id: feature.id,
      name: feature.name,
      sports: profile?.sports ?? feature.sports ?? (feature.sport === 'multi' ? [] : [feature.sport]),
      facilityType: feature.facilityType,
      geometry: { rings: feature.rings, bounds: feature.bounds ?? boundsOfRings(feature.rings) },
      source: { provider: 'openstreetmap', id: feature.id, url: `https://www.openstreetmap.org/${feature.id}` },
      provenance: { sources: [{ provider: 'openstreetmap', id: feature.id, url: `https://www.openstreetmap.org/${feature.id}` }, ...(lipasMatch ? [{ provider: 'lipas', id: String(lipasMatch.id), url: `https://api.lipas.fi/v2/sports-sites/${lipasMatch.id}`, updatedAt: lipasMatch.updatedAt }] : [])] },
      officialUrl: profile?.officialUrl ?? lipasMatch?.website,
      sourceUrl: `https://www.openstreetmap.org/${feature.id}`,
      lipas: lipasMatch,
      serviceMap: serviceMapForUnit(profile?.serviceMapId ?? lipasMatch?.id),
    }
  })
  const lipas = createLipasFeatures(project)
  const lipasVenues: SportsVenue[] = lipas.venues.map(({ id, venue }) => {
    const serviceMap = serviceMapForUrl(venue.website) ?? serviceMapForUnit(venue.id)
    return {
      id,
      name: venue.name,
      sports: lipas.features.find((feature) => feature.id === id)?.sports ?? [],
      facilityType: venue.typeName,
      geometry: { rings: [], bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 } },
      source: { provider: 'lipas', id: String(venue.id), url: `https://api.lipas.fi/v2/sports-sites/${venue.id}` },
      provenance: { sources: [{ provider: 'lipas', id: String(venue.id), url: `https://api.lipas.fi/v2/sports-sites/${venue.id}`, updatedAt: venue.updatedAt }] },
      officialUrl: venue.website,
      sourceUrl: `https://api.lipas.fi/v2/sports-sites/${venue.id}`,
      lipas: { ...venue, priceClass: serviceMap?.priceClass ?? venue.priceClass, accessStatus: serviceMap?.usageStatus ?? venue.accessStatus, ...accessProfileForUrl(venue.website) },
      serviceMap,
    }
  })
  const venues = mergeVenueSources(lipasVenues, osmVenues)
  const venueById = new Map(venues.map((venue) => [venue.id, venue]))
  const enrichedSports = lipas.features.map((feature) => {
    const venue = venueById.get(feature.id)
    return { ...feature, priceClass: venue?.serviceMap?.priceClass ?? feature.priceClass }
  })
  return {
  name: geojson.name,
  center: geojson.center,
  bounds: { minX: southWest.x, minY: southWest.y, maxX: northEast.x, maxY: northEast.y },
  surfaces: geojson.features.flatMap((feature) => {
    if (!['green', 'urban', 'water'].includes(feature.properties.category) || feature.geometry.type !== 'Polygon') return []
    const rings = feature.geometry.coordinates.map((ring) => ring.map(project))
    return [{ id: feature.id ?? 'surface', kind: feature.properties.category as 'green' | 'urban' | 'water', rings, bounds: boundsOfRings(rings) }]
  }),
  buildings: geojson.features.flatMap((feature) => {
    if (feature.properties.category !== 'building' || feature.geometry.type !== 'Polygon') return []
    const id = feature.id ?? 'building'
    const rings = feature.geometry.coordinates.map((ring) => ring.map(project))
    return [{ id, name: feature.properties.name, height: estimatedHeight(id, feature.properties.height), rings, bounds: boundsOfRings(rings) }]
  }),
  routes: geojson.features.flatMap((feature) => {
    if (!['road', 'path', 'rail', 'waterline'].includes(feature.properties.category) || feature.geometry.type !== 'LineString') return []
    const points = feature.geometry.coordinates.map(project)
    return [{ id: feature.id ?? 'route', kind: feature.properties.category === 'path' ? 'path' as const : feature.properties.routeKind ?? 'local', points, bounds: boundsOf(points) }]
  }),
  sports: enrichedSports,
  osmSports: sports,
  venues,
  trees: geojson.features.flatMap((feature) => feature.properties.category === 'tree' && feature.geometry.type === 'Point' ? [project(feature.geometry.coordinates)] : []),
  attribution: geojson.attribution,
  source: geojson.source,
  }
}

function areaBoundsFromBbox(bbox: [number, number, number, number], center: GeoPoint): Bounds {
  const southWest = toLocalMetres([bbox[0], bbox[1]], center)
  const northEast = toLocalMetres([bbox[2], bbox[3]], center)
  return { minX: southWest.x, minY: southWest.y, maxX: northEast.x, maxY: northEast.y }
}

function chunkIsVisible(chunk: MapChunkManifest['chunks'][number], manifest: MapChunkManifest, viewport: MapViewport) {
  const area = { bounds: areaBoundsFromBbox(manifest.bbox, manifest.center) } as MapDataset
  const projector = createProjector(area, viewport.width, viewport.height, viewport)
  const [west, south, east, north] = chunk.bbox
  const points = [[west, south], [west, north], [east, south], [east, north]].map((coordinate) => projector.point(toLocalMetres(coordinate as GeoPoint, manifest.center)))
  const minX = Math.min(...points.map(({ x }) => x)); const maxX = Math.max(...points.map(({ x }) => x))
  const minY = Math.min(...points.map(({ y }) => y)); const maxY = Math.max(...points.map(({ y }) => y))
  const margin = 220
  return maxX >= -margin && minX <= viewport.width + margin && maxY >= -margin && minY <= viewport.height + margin
}

async function createAreaFromChunks(chunks: StudyAreaGeoJson[]) {
  const firstChunk = chunks[0]
  const uniqueFeatures = new Map<string, GeoJsonFeature>()
  chunks.flatMap(({ features }) => features).forEach((feature, index) => uniqueFeatures.set(feature.id ?? `${feature.properties.category}-${index}-${JSON.stringify(feature.geometry)}`, feature))
  return createArea({ ...firstChunk, features: [...uniqueFeatures.values()] })
}

export type ChunkedMapSource = {
  loadManifest: () => Promise<MapChunkManifest>
  loadOverview: () => Promise<StudyAreaGeoJson>
  loadChunk: (file: string) => Promise<StudyAreaGeoJson>
}

export function createChunkedAreaLoader(source: ChunkedMapSource) {
  const chunkCache = new Map<string, Promise<StudyAreaGeoJson>>()
  const datasetCache = new Map<string, Promise<MapDataset>>()
  const datasetFor = (key: string, chunks: () => Promise<StudyAreaGeoJson[]>) => {
    const cached = datasetCache.get(key)
    if (cached) return cached
    const pending = chunks().then(createAreaFromChunks).catch((error) => {
      datasetCache.delete(key)
      throw error
    })
    datasetCache.set(key, pending)
    // Bound retained geometry while reusing recent viewport combinations.
    if (datasetCache.size > 4) datasetCache.delete(datasetCache.keys().next().value!)
    return pending
  }
  let overviewCache: Promise<StudyAreaGeoJson> | undefined
  let manifestCache: Promise<MapChunkManifest> | undefined
  const loadManifest = () => { manifestCache ??= source.loadManifest(); return manifestCache }
  const loadOverview = () => { overviewCache ??= source.loadOverview(); return overviewCache }
  const loadChunk = (file: string) => {
    const cached = chunkCache.get(file)
    if (cached) return cached
    const promise = source.loadChunk(file).catch((error) => { chunkCache.delete(file); throw error })
    chunkCache.set(file, promise)
    return promise
  }
  return {
    loadDataset: () => datasetFor('overview', async () => [await loadOverview()]),
    loadDatasetForViewport: async (viewport: MapViewport) => {
      if (viewport.zoom < 1.45) return datasetFor('overview', async () => [await loadOverview()])
      const manifest = await loadManifest()
      const visible = manifest.chunks.filter((chunk) => chunkIsVisible(chunk, manifest, viewport))
      if (!visible.length) return datasetFor('overview', async () => [await loadOverview()])
      return datasetFor(visible.map(({ file }) => file).join('|'), () => Promise.all(visible.map(({ file }) => loadChunk(file))))
    },
  }
}
