import type { GeoPoint } from './data/types'
import { HttpRequestError, requestJson } from './http'

export type TravelMode = 'walk' | 'bike' | 'transit' | 'car'
export type TransitLeg = {
  mode: string
  routeName?: string
  headsign?: string
  from?: string
  to?: string
  fromCoordinates?: GeoPoint
  toCoordinates?: GeoPoint
  geometry?: GeoPoint[]
  durationSeconds: number
  zones: string[]
}
export type TransitDetails = {
  zones: string[]
  legs: TransitLeg[]
  transfers: number
  walkDurationSeconds: number
}
export type RouteResult = {
  mode: TravelMode
  origin: GeoPoint
  destination: GeoPoint
  coordinates: GeoPoint[]
  distanceMetres: number
  durationSeconds: number
  transit?: TransitDetails
}

export type RouteFailureCode = 'unavailable' | 'no-route' | 'outside-area' | 'invalid'

export class RouteRequestError extends Error {
  readonly code: RouteFailureCode

  constructor(code: RouteFailureCode) {
    super(code)
    this.name = 'RouteRequestError'
    this.code = code
  }
}

const ROUTE_PROXY = '/api/route'
const TRANSIT_ROUTE_PROXY = '/api/transit-route'

export async function routeByMode(origin: GeoPoint, destination: GeoPoint, mode: Exclude<TravelMode, 'transit'>): Promise<RouteResult> {
  const params = new URLSearchParams({ mode, originLng: String(origin[0]), originLat: String(origin[1]), destinationLng: String(destination[0]), destinationLat: String(destination[1]) })
  let result: { code: string; routes?: { distance: number; duration: number; geometry?: { coordinates: GeoPoint[] } }[] }
  try {
    result = await requestJson(`${ROUTE_PROXY}?${params}`, undefined, 12_000)
  } catch (error) {
    if (error instanceof HttpRequestError) {
      if (error.status >= 500 || error.responseError === 'routing_service_unavailable') throw new RouteRequestError('unavailable')
      if (error.responseError === 'route_outside_supported_area') throw new RouteRequestError('outside-area')
      throw new RouteRequestError('invalid')
    }
    throw new RouteRequestError('unavailable')
  }
  // A missing or non-object body is a service failure, not "no route".
  if (!result || typeof result !== 'object') throw new RouteRequestError('unavailable')
  const route = result.routes?.[0]
  if (result.code === 'NoRoute' || !route?.geometry?.coordinates?.length) throw new RouteRequestError('no-route')
  if (result.code !== 'Ok') throw new RouteRequestError('unavailable')
  return { mode, origin, destination, coordinates: route.geometry.coordinates, distanceMetres: route.distance, durationSeconds: route.duration }
}

type TransitRouteResponse = {
  code: string
  route?: {
    coordinates: GeoPoint[]
    distanceMetres: number
    durationSeconds: number
    transit: TransitDetails
  }
}

export async function routeByTransit(origin: GeoPoint, destination: GeoPoint, locale: 'fi' | 'en' = 'en'): Promise<RouteResult> {
  let result: TransitRouteResponse
  try {
    result = await requestJson<TransitRouteResponse>(TRANSIT_ROUTE_PROXY, undefined, 15_000, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination, locale }),
    })
  } catch (error) {
    if (error instanceof HttpRequestError) {
      if (error.responseError === 'transit_no_route') throw new RouteRequestError('no-route')
      if (error.status === 401 || error.status === 403 || error.status >= 500 || error.responseError === 'transit_service_unavailable') throw new RouteRequestError('unavailable')
      throw new RouteRequestError('invalid')
    }
    throw new RouteRequestError('unavailable')
  }
  if (!result || typeof result !== 'object') throw new RouteRequestError('unavailable')
  if (result.code === 'NoRoute' || !result.route?.coordinates?.length) throw new RouteRequestError('no-route')
  if (result.code !== 'Ok') throw new RouteRequestError('unavailable')
  return { mode: 'transit', origin, destination, ...result.route }
}

export function transitDirectionsUrl(destination: GeoPoint, origin?: GeoPoint) {
  const params = new URLSearchParams({ api: '1', destination: `${destination[1]},${destination[0]}`, travelmode: 'transit' })
  if (origin) params.set('origin', `${origin[1]},${origin[0]}`)
  return `https://www.google.com/maps/dir/?${params.toString()}`
}
