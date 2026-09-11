export type GeoPoint = [longitude: number, latitude: number]
export type MapPoint = { x: number; y: number }
export type MapLabel = { text: string; coordinates: GeoPoint; minZoom?: number; tone?: 'primary' | 'secondary'; offset?: { x: number; y: number } }
export type Bounds = { minX: number; minY: number; maxX: number; maxY: number }
export type MapViewport = { width: number; height: number; mode: '2d' | 'iso'; zoom: number; pan: MapPoint }
export type MapChunkManifest = { name: string; center: GeoPoint; bbox: [number, number, number, number]; chunks: { id: string; file: string; row: number; column: number; bbox: [number, number, number, number] }[] }

export type SurfaceFeature = { id: string; kind: 'green' | 'water' | 'urban'; rings: MapPoint[][]; bounds?: Bounds }
export type BuildingFeature = { id: string; rings: MapPoint[][]; bounds?: Bounds; height: number; name?: string }
export type RouteFeature = { id: string; kind: 'rail' | 'waterline' | 'major' | 'street' | 'local' | 'path'; points: MapPoint[]; bounds?: Bounds }
export type VenueIcon = 'football' | 'athletics' | 'swimming' | 'ice_hockey' | 'basketball' | 'tennis' | 'fitness' | 'multi'
export type PriceClass = 'free' | 'paid' | 'mixed' | 'unknown'
export type SportFeature = { id: string; name?: string; sport: string; sports?: string[]; facilityType?: string; priceClass?: PriceClass; icon?: VenueIcon; rings: MapPoint[][]; bounds?: Bounds; center?: GeoPoint }

export type LipasVenue = {
  id: number
  name: string
  typeName?: string
  typeNameEn?: string
  website?: string
  address?: string
  updatedAt?: string
  priceClass?: PriceClass
  accessStatus?: 'open' | 'restricted' | 'booking' | 'unknown'
  accessNoteFi?: string
  accessNoteEn?: string
  accessSourceUrl?: string
}

export type SportsVenue = {
  id: string
  name?: string
  sports: string[]
  facilityType?: string
  priceClass?: PriceClass
  geometry: { rings: MapPoint[][]; bounds: Bounds }
  source: { provider: string; id: string }
  officialUrl?: string
  sourceUrl: string
  lipas?: LipasVenue
  serviceMap?: import('./serviceMap').ServiceMapDetails
}

export type MapDataset = {
  name: string
  center: GeoPoint
  bounds: Bounds
  surfaces: SurfaceFeature[]
  buildings: BuildingFeature[]
  routes: RouteFeature[]
  sports: SportFeature[]
  osmSports?: SportFeature[]
  venues: SportsVenue[]
  trees: MapPoint[]
  attribution: string
  source: string
}

export type GeoJsonFeature = {
  id?: string
  properties: {
    category: 'building' | 'road' | 'path' | 'rail' | 'waterline' | 'green' | 'urban' | 'water' | 'sport' | 'tree'
    name?: string
    sport?: string
    height?: number
    routeKind?: 'rail' | 'waterline' | 'major' | 'street' | 'local'
    osmTags?: { leisure?: string; sport?: string }
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
