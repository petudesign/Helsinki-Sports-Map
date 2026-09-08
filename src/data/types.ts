export type GeoPoint = [longitude: number, latitude: number]
export type MapPoint = { x: number; y: number }
export type Bounds = { minX: number; minY: number; maxX: number; maxY: number }

export type SurfaceFeature = { id: string; kind: 'green' | 'water'; rings: MapPoint[][] }
export type BuildingFeature = { id: string; rings: MapPoint[][]; height: number; name?: string }
export type RouteFeature = { id: string; kind: 'major' | 'street' | 'local' | 'path'; points: MapPoint[] }
export type SportFeature = { id: string; name?: string; sport: string; rings: MapPoint[][] }

export type MapDataset = {
  name: string
  bounds: Bounds
  surfaces: SurfaceFeature[]
  buildings: BuildingFeature[]
  routes: RouteFeature[]
  sports: SportFeature[]
  trees: MapPoint[]
  attribution: string
  source: string
}

export type GeoJsonFeature = {
  id?: string
  properties: {
    category: 'building' | 'road' | 'path' | 'green' | 'water' | 'sport' | 'tree'
    name?: string
    sport?: string
    height?: number
    routeKind?: 'major' | 'street' | 'local'
  }
  geometry:
    | { type: 'Point'; coordinates: GeoPoint }
    | { type: 'LineString'; coordinates: GeoPoint[] }
    | { type: 'Polygon'; coordinates: GeoPoint[][] }
}

export type StudyAreaGeoJson = {
  type: 'FeatureCollection'
  name: string
  attribution: string
  source: string
  center: GeoPoint
  bbox: [number, number, number, number]
  features: GeoJsonFeature[]
}
