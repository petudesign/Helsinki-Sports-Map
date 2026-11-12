import type { GeoPoint } from './data/types'

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

export type PlaceKind = 'area' | 'place' | 'station'
export type AddressSuggestion = { label: string; coordinates?: GeoPoint; streetName?: string; kind?: PlaceKind; detail?: string }

export type RouteFailureCode = 'unavailable' | 'no-route' | 'outside-area' | 'invalid'

export class RouteRequestError extends Error {
  readonly code: RouteFailureCode

  constructor(code: RouteFailureCode) {
    super(code)
    this.name = 'RouteRequestError'
    this.code = code
  }
}

const PAIKKATIETO_ADDRESS_PROXY = '/api/paikkatieto'
const HELSINKI_STREET_PROXY = '/api/helsinki-streets'
const GEOCODE_PROXY = '/api/geocode'
const REVERSE_GEOCODE_PROXY = '/api/reverse-geocode'
const ROUTE_PROXY = '/api/route'
const TRANSIT_ROUTE_PROXY = '/api/transit-route'
const PLACES_PROXY = '/api/places'
const MAX_STREET_SUGGESTIONS = 8

class HttpRequestError extends Error {
  readonly status: number
  readonly responseError?: string

  constructor(status: number, responseError?: string) {
    super(`Request failed (${status})`)
    this.name = 'HttpRequestError'
    this.status = status
    this.responseError = responseError
  }
}

// Bound both the request and JSON body read. A disconnected local proxy must not
// leave autocomplete or routing waiting forever. Preserve caller cancellation.
async function requestJson<T>(url: string, signal?: AbortSignal, timeoutMs = 10_000, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signal?.aborted) abort()
  else signal?.addEventListener('abort', abort, { once: true })
  const timeout = setTimeout(abort, timeoutMs)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, headers: { Accept: 'application/json', ...(init.headers ?? {}) } })
    if (!response.ok) {
      let responseError: string | undefined
      try { responseError = (await response.json() as { error?: string }).error } catch { /* Keep the HTTP status as the useful error. */ }
      throw new HttpRequestError(response.status, responseError)
    }
    return await response.json() as T
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}

type LocalizedValue = string | Record<string, string> | null | undefined
type PaikkatietoAddress = {
  street?: { name?: LocalizedValue; translations?: Record<string, string> }
  number?: string
  number_end?: string
  letter?: string
  postal_code_area?: {
    postal_code?: string
    name?: LocalizedValue
    post_office?: LocalizedValue
  }
  location?: { type?: string; coordinates?: [number, number] }
  municipality?: { name?: LocalizedValue }
}

type HelsinkiStreetFeature = {
  properties?: { katunimi?: string }
}

type NominatimResult = {
  lat: string
  lon: string
  display_name?: string
  address?: {
    road?: string
    pedestrian?: string
    house_number?: string
    postcode?: string
    city?: string
    town?: string
    municipality?: string
  }
}

function localizedValue(value: LocalizedValue) {
  if (!value) return undefined
  if (typeof value === 'string') return value
  return value.fi ?? value.sv ?? value.en
}

function parseAddressQuery(query: string) {
  const withoutCity = query.trim().replace(/\s*,\s*(?:helsinki|helsingfors)(?:\s*,\s*finland)?$/i, '')
  const match = withoutCity.match(/^(.+?)\s+(\d+\s*[A-Za-z]?)$/)
  return match
    ? { streetname: match[1].trim(), streetnumber: match[2].replace(/\s+/g, '') }
    : { streetname: withoutCity }
}

function normalizeSearchText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fi-FI').replace(/\s+/g, ' ').trim()
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matchesAddressQuery(suggestion: AddressSuggestion, query: string) {
  const parsed = parseAddressQuery(query)
  const normalizedStreet = normalizeSearchText(parsed.streetname)
  const normalizedStreetName = normalizeSearchText(suggestion.streetName ?? suggestion.label.split(',')[0])
  const normalizedLabel = normalizeSearchText(suggestion.label)
  if (!normalizedStreet || !normalizedStreetName.startsWith(normalizedStreet)) return false
  if (!parsed.streetnumber) return true

  const numberMatch = parsed.streetnumber.match(/^(\d+)([A-Za-z])?$/)
  if (!numberMatch) return true
  const number = escapeRegExp(numberMatch[1])
  const letter = numberMatch[2] ? `\\s*${escapeRegExp(numberMatch[2])}` : ''
  return new RegExp(`(^|\\D)${number}${letter}(?=\\D|$)`, 'i').test(normalizedLabel)
}

function formatPaikkatietoAddress(address: PaikkatietoAddress, compact = false) {
  const streetName = localizedValue(address.street?.name ?? address.street?.translations)
  if (!streetName) return undefined
  const street = [streetName, address.number, address.letter].filter(Boolean).join(' ')
  const postalCode = address.postal_code_area?.postal_code
  const label = compact ? streetName : [address.number ? street : streetName, address.number ? postalCode : undefined].filter(Boolean).join(', ')
  const coordinates = address.location?.coordinates
  if (!coordinates || coordinates.length !== 2 || coordinates.some((value) => !Number.isFinite(value))) return undefined
  return { label, coordinates: coordinates as GeoPoint, streetName }
}

function formatNominatimAddress(result: NominatimResult) {
  const address = result.address
  const streetName = address?.road ?? address?.pedestrian
  if (!streetName) return undefined
  const street = [streetName, address?.house_number].filter(Boolean).join(' ')
  const coordinates = [Number(result.lon), Number(result.lat)] as GeoPoint
  return {
    label: address?.house_number ? [street, address?.postcode].filter(Boolean).join(', ') : streetName,
    coordinates,
    streetName,
  }
}

function dedupeSuggestions(suggestions: AddressSuggestion[]) {
  const seenLabels = new Set<string>()
  const seenCoordinates = new Set<string>()
  return suggestions.filter((suggestion) => {
    const labelKey = suggestion.label.trim().toLocaleLowerCase('fi-FI').replace(/\s+/g, ' ')
    const coordinatesKey = suggestion.coordinates?.map((value) => value.toFixed(5)).join(',')
    if (seenLabels.has(labelKey) || (coordinatesKey && seenCoordinates.has(coordinatesKey))) return false
    seenLabels.add(labelKey)
    if (coordinatesKey) seenCoordinates.add(coordinatesKey)
    return true
  })
}

async function searchPaikkatieto(query: string, signal?: AbortSignal): Promise<AddressSuggestion[]> {
  const parsed = parseAddressQuery(query)
  if (!parsed.streetname) return []
  const params = new URLSearchParams({ municipality: 'Helsinki', page_size: '25', streetname: parsed.streetname })
  if (parsed.streetnumber) params.set('streetnumber', parsed.streetnumber)
  const result = await requestJson<{ results?: PaikkatietoAddress[] }>(`${PAIKKATIETO_ADDRESS_PROXY}?${params}`, signal)
  const suggestions = dedupeSuggestions((result.results ?? []).flatMap((address) => {
    const suggestion = formatPaikkatietoAddress(address)
    return suggestion ? [suggestion] : []
  }))
  if (parsed.streetnumber || suggestions.length === 0) return suggestions
  const [first] = suggestions
  return first ? [{ ...first, label: first.streetName ?? first.label.split(',')[0] }] : []
}

async function searchHelsinkiStreetNames(prefix: string, signal?: AbortSignal) {
  const result = await requestJson<{ features?: HelsinkiStreetFeature[] }>(`${HELSINKI_STREET_PROXY}?prefix=${encodeURIComponent(prefix)}`, signal)
  const names = new Map<string, string>()
  for (const feature of result.features ?? []) {
    const name = feature.properties?.katunimi?.trim()
    if (name) names.set(normalizeSearchText(name), name)
  }
  return [...names.values()]
    .filter((name) => normalizeSearchText(name).startsWith(normalizeSearchText(prefix)))
    .sort((left, right) => left.localeCompare(right, 'fi'))
    .slice(0, MAX_STREET_SUGGESTIONS)
}

async function searchNominatim(query: string, signal?: AbortSignal): Promise<AddressSuggestion[]> {
  const params = new URLSearchParams({ q: query })
  const results = await requestJson<NominatimResult[]>(`${GEOCODE_PROXY}?${params}`, signal)
  return dedupeSuggestions(results.flatMap((result) => {
    const suggestion = formatNominatimAddress(result)
    return suggestion ? [suggestion] : []
  }))
}

type District = { name: string; sv?: string; point: GeoPoint }
let districts: Promise<District[]> | undefined
const loadDistricts = () => (districts ??= import('./data/districts.json').then((module) => module.default as District[]).catch(() => { districts = undefined; return [] }))

// 0 = the name is the query, 1 = starts with it, 2 = a later word starts with it, -1 = no match.
// Pelias also matches on street and area, which brings in shops that merely sit in Kamppi.
function nameMatch(name: string, query: string) {
  const n = normalizeSearchText(name)
  const q = normalizeSearchText(query)
  if (n === q || n.replace(/\s*\(.*\)$/, '') === q) return 0
  if (n.startsWith(q)) return 1
  return n.split(/[\s\-/(),]+/).some((word) => word.startsWith(q)) ? 2 : -1
}

const PLACE_ORDER: Record<PlaceKind, number> = { area: 0, station: 1, place: 2 }
const metresBetween = (a: GeoPoint, b: GeoPoint) => Math.hypot((a[0] - b[0]) * 55_660, (a[1] - b[1]) * 111_320)

// Districts (bundled from Helsinki's district division, so they work without any key),
// then stations and named places from Digitransit when the server key is configured.
export async function searchPlaces(query: string, locale: 'fi' | 'en', signal?: AbortSignal): Promise<AddressSuggestion[]> {
  const text = query.trim()
  if (text.length < 2) return []
  const remoteRequest = (async () => {
    try {
      const params = new URLSearchParams({ text, lang: locale })
      const { places } = await requestJson<{ places?: { name: string; kind: PlaceKind; detail?: string; coordinates: GeoPoint }[] }>(`${PLACES_PROXY}?${params}`, signal, 5_000)
      return places ?? []
    } catch (error) {
      if (signal?.aborted) throw error
      return []
    }
  })()
  const areas = (await loadDistricts()).flatMap((district) => {
    const match = Math.min(...[district.name, district.sv].filter(Boolean).map((name) => { const m = nameMatch(name!, text); return m < 0 ? 9 : m }))
    return match < 9 ? [{ label: district.name, kind: 'area' as const, detail: 'Helsinki', coordinates: district.point, match }] : []
  })
  const remote = (await remoteRequest).flatMap((place) => {
    const match = nameMatch(place.name, text)
    return match < 0 ? [] : [{ label: place.name, kind: place.kind, detail: place.detail || undefined, coordinates: place.coordinates, match }]
  })
  const ranked = [...areas, ...remote]
    .map((place, index) => ({ ...place, index }))
    // Exact names first, then every matching district ("Töölö" → Etu- and Taka-Töölö before Töölö Gym), then the rest.
    .map((place) => ({ ...place, tier: place.match === 0 ? 0 : place.kind === 'area' ? 1 : 1 + place.match }))
    .sort((a, b) => a.tier - b.tier || PLACE_ORDER[a.kind] - PLACE_ORDER[b.kind] || a.index - b.index)
  // The same name within 500 m is one place ("Pasila" the district, the station and the venue).
  const kept: typeof ranked = []
  for (const place of ranked) {
    if (kept.some((other) => normalizeSearchText(other.label) === normalizeSearchText(place.label) && metresBetween(other.coordinates, place.coordinates) < 500)) continue
    kept.push(place)
  }
  return kept.map(({ label, kind, detail, coordinates }) => ({ label, kind, detail, coordinates }))
}

export async function searchAddresses(query: string, signal?: AbortSignal, locale: 'fi' | 'en' = 'fi'): Promise<AddressSuggestion[]> {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) return []
  const parsed = parseAddressQuery(trimmedQuery)

  if (!parsed.streetnumber) {
    // A visitor often knows only the district or the landmark, so places come first, then streets.
    const placesRequest = searchPlaces(trimmedQuery, locale, signal)
    let streets: AddressSuggestion[] = []
    let streetsFailed = false
    try {
      const streetNames = await searchHelsinkiStreetNames(parsed.streetname, signal)
      streets = streetNames
        .map((streetName) => ({ label: streetName, streetName }))
        .filter((suggestion) => matchesAddressQuery(suggestion, trimmedQuery))
    } catch (error) {
      if (signal?.aborted) throw error
      streetsFailed = true
    }
    const places = await placesRequest
    const streetLabels = new Set(streets.map((street) => normalizeSearchText(street.label)))
    const placeRows = places.filter((place) => !streetLabels.has(normalizeSearchText(place.label))).slice(0, 5)
    // Typing a whole street name ("Mannerheimintie") means the street, not a landmark named after it.
    const streetFirst = streetLabels.has(normalizeSearchText(parsed.streetname))
    const merged = streetFirst ? [...streets, ...placeRows] : [...placeRows, ...streets]
    if (merged.length || !streetsFailed) return merged.slice(0, MAX_STREET_SUGGESTIONS)
  }

  // Only a successful empty response means no matches. Let failures reach the UI.
  return (await searchPaikkatieto(trimmedQuery, signal)).filter((suggestion) => matchesAddressQuery(suggestion, trimmedQuery))
}

export async function geocodeAddress(query: string, locale: 'fi' | 'en' = 'fi'): Promise<GeoPoint> {
  let first: AddressSuggestion | undefined
  // A bare name ("Kamppi") is more likely a district or landmark than a street.
  if (!parseAddressQuery(query).streetnumber) {
    const [place] = await searchPlaces(query, locale)
    if (place?.coordinates && normalizeSearchText(place.label) === normalizeSearchText(query)) return place.coordinates
  }
  try {
    [first] = await searchPaikkatieto(query)
  } catch {
    // The explicit final lookup can still use the bounded Nominatim fallback
    // when the optional Paikkatieto key is not configured.
  }
  if (!first) {
    const [fallback] = await searchNominatim(query)
    first = fallback
  }
  const coordinates = first?.coordinates
  if (!coordinates) throw new Error('Address not found')
  return coordinates
}

export async function reverseGeocode(coordinates: GeoPoint, signal?: AbortSignal): Promise<AddressSuggestion> {
  const params = new URLSearchParams({ lat: String(coordinates[1]), lon: String(coordinates[0]) })
  const result = await requestJson<{ display_name?: string }>(`${REVERSE_GEOCODE_PROXY}?${params}`, signal)
  return { label: result.display_name ?? `${coordinates[1].toFixed(5)}, ${coordinates[0].toFixed(5)}`, coordinates }
}

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
  if (result.code === 'NoRoute' || !result.route?.coordinates?.length) throw new RouteRequestError('no-route')
  if (result.code !== 'Ok') throw new RouteRequestError('unavailable')
  return { mode: 'transit', origin, destination, ...result.route }
}

export function transitDirectionsUrl(destination: GeoPoint, origin?: GeoPoint) {
  const params = new URLSearchParams({ api: '1', destination: `${destination[1]},${destination[0]}`, travelmode: 'transit' })
  if (origin) params.set('origin', `${origin[1]},${origin[0]}`)
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

export const routeWalking = (origin: GeoPoint, destination: GeoPoint) => routeByMode(origin, destination, 'walk')
