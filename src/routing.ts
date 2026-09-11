import type { GeoPoint } from './data/types'

export type TravelMode = 'walk' | 'bike' | 'transit' | 'car'
export type RouteResult = {
  mode: Exclude<TravelMode, 'transit'>
  origin: GeoPoint
  destination: GeoPoint
  coordinates: GeoPoint[]
  distanceMetres: number
  durationSeconds: number
}

export type AddressSuggestion = { label: string; coordinates: GeoPoint }

// Keep address lookup aligned with the current central-Helsinki map chunk:
// west, north, east, south. The previous box only covered the first, smaller
// Olympic-area prototype and excluded streets such as Eläinlääkärinkatu.
const HELSINKI_VIEWBOX = '24.89,60.215,24.98,60.165'

function cityScopedQuery(query: string) {
  return /\bhelsinki\b/i.test(query) ? query : `${query}, Helsinki, Finland`
}

export async function searchAddresses(query: string, signal?: AbortSignal): Promise<AddressSuggestion[]> {
  const scopedQuery = cityScopedQuery(query)
  const fetchResults = async (bounded: boolean) => {
    const params = new URLSearchParams({ format: 'jsonv2', limit: '5', countrycodes: 'fi', 'accept-language': 'fi,en', q: scopedQuery })
    if (bounded) {
      params.set('viewbox', HELSINKI_VIEWBOX)
      params.set('bounded', '1')
    }
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { signal })
    if (!response.ok) throw new Error('Geocoding request failed')
    return await response.json() as { lat: string; lon: string }[]
  }
  const results = await fetchResults(true)
  const fallbackResults = results.length > 0 ? results : await fetchResults(false)
  return fallbackResults.map((result) => ({ label: (result as { display_name?: string }).display_name ?? query, coordinates: [Number(result.lon), Number(result.lat)] as GeoPoint }))
}

export async function geocodeAddress(query: string): Promise<GeoPoint> {
  const [first] = await searchAddresses(query)
  if (!first) throw new Error('Address not found')
  return first.coordinates
}

export async function reverseGeocode(coordinates: GeoPoint, signal?: AbortSignal): Promise<AddressSuggestion> {
  const params = new URLSearchParams({ format: 'jsonv2', zoom: '18', addressdetails: '1', 'accept-language': 'fi,en', lat: String(coordinates[1]), lon: String(coordinates[0]) })
  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, { signal })
  if (!response.ok) throw new Error('Reverse geocoding request failed')
  const result = await response.json() as { display_name?: string }
  return { label: result.display_name ?? `${coordinates[1].toFixed(5)}, ${coordinates[0].toFixed(5)}`, coordinates }
}

export async function routeByMode(origin: GeoPoint, destination: GeoPoint, mode: Exclude<TravelMode, 'transit'>): Promise<RouteResult> {
  const coordinates = `${origin[0]},${origin[1]};${destination[0]},${destination[1]}`
  const server = mode === 'walk' ? 'routed-foot' : mode === 'bike' ? 'routed-bike' : 'routed-car'
  const response = await fetch(`https://routing.openstreetmap.de/${server}/route/v1/driving/${coordinates}?overview=full&geometries=geojson`)
  if (!response.ok) throw new Error('Routing request failed')
  const result = await response.json() as { code: string; routes?: { distance: number; duration: number; geometry?: { coordinates: GeoPoint[] } }[] }
  const route = result.routes?.[0]
  if (result.code !== 'Ok' || !route?.geometry?.coordinates?.length) throw new Error('No walking route found')
  return { mode, origin, destination, coordinates: route.geometry.coordinates, distanceMetres: route.distance, durationSeconds: route.duration }
}

export const routeWalking = (origin: GeoPoint, destination: GeoPoint) => routeByMode(origin, destination, 'walk')
