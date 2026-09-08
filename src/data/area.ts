import studyArea from './olympic-area.json'
import type { GeoPoint, MapDataset, MapPoint, StudyAreaGeoJson } from './types'

const geojson = studyArea as unknown as StudyAreaGeoJson
const [centerLon, centerLat] = geojson.center
const metresPerDegreeLat = 111_320
const metresPerDegreeLon = metresPerDegreeLat * Math.cos(centerLat * Math.PI / 180)

export function toLocalMetres([longitude, latitude]: GeoPoint): MapPoint {
  return {
    x: (longitude - centerLon) * metresPerDegreeLon,
    y: (latitude - centerLat) * metresPerDegreeLat,
  }
}

function estimatedHeight(id: string, explicitHeight?: number) {
  if (explicitHeight) return Math.max(5, Math.min(explicitHeight, 48))
  const hash = [...id].reduce((total, character) => total + character.charCodeAt(0), 0)
  return 9 + (hash % 5) * 2.4
}

const [west, south, east, north] = geojson.bbox
const southWest = toLocalMetres([west, south])
const northEast = toLocalMetres([east, north])

export const area: MapDataset = {
  name: geojson.name,
  bounds: { minX: southWest.x, minY: southWest.y, maxX: northEast.x, maxY: northEast.y },
  surfaces: geojson.features.flatMap((feature) => {
    if (!['green', 'water'].includes(feature.properties.category) || feature.geometry.type !== 'Polygon') return []
    return [{ id: feature.id ?? 'surface', kind: feature.properties.category as 'green' | 'water', rings: feature.geometry.coordinates.map((ring) => ring.map(toLocalMetres)) }]
  }),
  buildings: geojson.features.flatMap((feature) => {
    if (feature.properties.category !== 'building' || feature.geometry.type !== 'Polygon') return []
    const id = feature.id ?? 'building'
    return [{ id, name: feature.properties.name, height: estimatedHeight(id, feature.properties.height), rings: feature.geometry.coordinates.map((ring) => ring.map(toLocalMetres)) }]
  }),
  routes: geojson.features.flatMap((feature) => {
    if (!['road', 'path'].includes(feature.properties.category) || feature.geometry.type !== 'LineString') return []
    return [{ id: feature.id ?? 'route', kind: feature.properties.category === 'path' ? 'path' as const : feature.properties.routeKind ?? 'local', points: feature.geometry.coordinates.map(toLocalMetres) }]
  }),
  sports: geojson.features.flatMap((feature) => {
    if (feature.properties.category !== 'sport' || feature.geometry.type !== 'Polygon') return []
    return [{ id: feature.id ?? 'sport', name: feature.properties.name, sport: feature.properties.sport ?? 'multi', rings: feature.geometry.coordinates.map((ring) => ring.map(toLocalMetres)) }]
  }),
  trees: geojson.features.flatMap((feature) => feature.properties.category === 'tree' && feature.geometry.type === 'Point' ? [toLocalMetres(feature.geometry.coordinates)] : []),
  attribution: geojson.attribution,
  source: geojson.source,
}
