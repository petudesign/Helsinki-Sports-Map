import { accessProfileForUrl, createLipasFeatures, findLipasVenue } from './lipas'
import type { GeoPoint, MapDataset, MapPoint, SportFeature, SportsVenue, StudyAreaGeoJson } from './types'
import { venueProfile } from './venueLinks'
import { serviceMapForUnit, serviceMapForUrl } from './serviceMap'
import { transitDirectionsUrl } from '../routing'
import { boundsOf } from './geometry'
import { nameKey } from './text'

function toLocalMetres([longitude, latitude]: GeoPoint, [centerLon, centerLat]: GeoPoint): MapPoint {
  return { x: (longitude - centerLon) * 111_320 * Math.cos(centerLat * Math.PI / 180), y: (latitude - centerLat) * 111_320 }
}

function estimatedHeight(id: string, explicitHeight?: number) {
  if (explicitHeight) return Math.max(5, Math.min(explicitHeight, 48))
  const hash = [...id].reduce((total, character) => total + character.charCodeAt(0), 0)
  return 9 + (hash % 5) * 2.4
}

function boundsOfRings(rings: MapPoint[][]) {
  return boundsOf(rings.flat())
}

function centerOfGeoRing(ring: GeoPoint[]): GeoPoint {
  const points = ring.slice(0, -1)
  const total = points.reduce(([longitude, latitude], [pointLongitude, pointLatitude]) => [longitude + pointLongitude, latitude + pointLatitude], [0, 0] as GeoPoint)
  return [total[0] / Math.max(points.length, 1), total[1] / Math.max(points.length, 1)]
}

function mergeVenueSources(lipasVenues: SportsVenue[], osmVenues: SportsVenue[]) {
  const venues = new Map<string, SportsVenue>()
  lipasVenues.forEach((venue) => venues.set(nameKey(venue.name), venue))
  osmVenues.forEach((venue) => {
    const key = nameKey(venue.name)
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

function needsTransitGuidance(name?: string, address?: string) {
  return /saari|saarella|saaren|suomenlinna|pihlajasaari|vallisaari|lonna|isosaari|mustasaari|korkeasaari|seurasaari/i.test(`${name ?? ''} ${address ?? ''}`)
}

export function createArea(geojson: StudyAreaGeoJson): MapDataset {
  const [west, south, east, north] = geojson.bbox
  const project = (point: GeoPoint) => toLocalMetres(point, geojson.center)
  const southWest = project([west, south])
  const northEast = project([east, north])
  const sports: SportFeature[] = geojson.features.flatMap((feature) => {
    if (feature.properties.category !== 'sport' || feature.properties.context === 'neighboring' || feature.geometry.type !== 'Polygon') return []
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
  const featuresById = new Map(lipas.features.map((feature) => [feature.id, feature]))
  const lipasVenues: SportsVenue[] = lipas.venues.map(({ id, venue }) => {
    const feature = featuresById.get(id)
    const serviceMap = serviceMapForUrl(venue.website) ?? serviceMapForUnit(venue.id)
    return {
      id,
      name: venue.name,
      sports: feature?.sports ?? [],
      facilityType: venue.typeName,
      geometry: { rings: [], bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 } },
      source: { provider: 'lipas', id: String(venue.id), url: `https://api.lipas.fi/v2/sports-sites/${venue.id}` },
      provenance: { sources: [{ provider: 'lipas', id: String(venue.id), url: `https://api.lipas.fi/v2/sports-sites/${venue.id}`, updatedAt: venue.updatedAt }] },
      officialUrl: venue.website,
      sourceUrl: `https://api.lipas.fi/v2/sports-sites/${venue.id}`,
      lipas: {
        ...venue,
        priceClass: serviceMap?.priceClass ?? venue.priceClass,
        accessStatus: serviceMap?.usageStatus ?? venue.accessStatus,
        ...accessProfileForUrl(venue.website),
        ...(feature?.center && needsTransitGuidance(venue.name, venue.address) ? {
          accessNoteFi: 'Kohde on saarella tai saaren tuntumassa. Tarkista ajantasainen julkisen liikenteen tai lautan yhteys ennen lähtöä.',
          accessNoteEn: 'This place is on or near an island. Check the current public-transport or ferry connection before leaving.',
          accessSourceUrl: transitDirectionsUrl(feature.center),
        } : {}),
      },
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
    return [{ id: feature.id ?? 'surface', kind: feature.properties.category as 'green' | 'urban' | 'water', rings, bounds: boundsOfRings(rings), context: feature.properties.context }]
  }),
  buildings: geojson.features.flatMap((feature) => {
    if (feature.properties.category !== 'building' || feature.geometry.type !== 'Polygon') return []
    const id = feature.id ?? 'building'
    const rings = feature.geometry.coordinates.map((ring) => ring.map(project))
    return [{ id, name: feature.properties.name, height: estimatedHeight(id, feature.properties.height), rings, bounds: boundsOfRings(rings), context: feature.properties.context }]
  }),
  routes: geojson.features.flatMap((feature) => {
    if (!['road', 'path', 'rail', 'waterline'].includes(feature.properties.category) || feature.geometry.type !== 'LineString') return []
    const points = feature.geometry.coordinates.map(project)
    return [{ id: feature.id ?? 'route', kind: feature.properties.category === 'path' ? 'path' as const : feature.properties.routeKind ?? 'local', points, bounds: boundsOf(points), context: feature.properties.context }]
  }),
  sports: enrichedSports,
  osmSports: sports,
  venues,
  trees: geojson.features.flatMap((feature) => feature.properties.category === 'tree' && feature.geometry.type === 'Point' ? [project(feature.geometry.coordinates)] : []),
  attribution: geojson.attribution,
  source: geojson.source,
  }
}
