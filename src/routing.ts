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

export type AddressSuggestion = { label: string; coordinates?: GeoPoint; streetName?: string }

const PAIKKATIETO_ADDRESS_PROXY = '/api/paikkatieto'
const HELSINKI_STREET_PROXY = '/api/helsinki-streets'
const GEOCODE_PROXY = '/api/geocode'
const REVERSE_GEOCODE_PROXY = '/api/reverse-geocode'
const ROUTE_PROXY = '/api/route'
const MAX_STREET_SUGGESTIONS = 8

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
  const response = await fetch(`${PAIKKATIETO_ADDRESS_PROXY}?${params}`, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('Paikkatieto address request failed')
  const result = await response.json() as { results?: PaikkatietoAddress[] }
  const suggestions = dedupeSuggestions((result.results ?? []).flatMap((address) => {
    const suggestion = formatPaikkatietoAddress(address)
    return suggestion ? [suggestion] : []
  }))
  if (parsed.streetnumber || suggestions.length === 0) return suggestions
  const [first] = suggestions
  return first ? [{ ...first, label: first.streetName ?? first.label.split(',')[0] }] : []
}

async function searchHelsinkiStreetNames(prefix: string, signal?: AbortSignal) {
  const response = await fetch(`${HELSINKI_STREET_PROXY}?prefix=${encodeURIComponent(prefix)}`, { signal })
  if (!response.ok) throw new Error('Helsinki street lookup failed')
  const result = await response.json() as { features?: HelsinkiStreetFeature[] }
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
  const response = await fetch(`${GEOCODE_PROXY}?${params}`, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('Geocoding request failed')
  const results = await response.json() as NominatimResult[]
  return dedupeSuggestions(results.flatMap((result) => {
    const suggestion = formatNominatimAddress(result)
    return suggestion ? [suggestion] : []
  }))
}

export async function searchAddresses(query: string, signal?: AbortSignal): Promise<AddressSuggestion[]> {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) return []
  const parsed = parseAddressQuery(trimmedQuery)

  if (!parsed.streetnumber) {
    try {
      const streetNames = await searchHelsinkiStreetNames(parsed.streetname, signal)
      const prefixResults = streetNames
        .map((streetName) => ({ label: streetName, streetName }))
        .filter((suggestion) => matchesAddressQuery(suggestion, trimmedQuery))
      if (prefixResults.length > 0) return prefixResults
    } catch (error) {
      if (signal?.aborted) throw error
    }
  }

  try {
    const paikkatietoResults = (await searchPaikkatieto(trimmedQuery, signal)).filter((suggestion) => matchesAddressQuery(suggestion, trimmedQuery))
    if (paikkatietoResults.length > 0) return paikkatietoResults
  } catch (error) {
    if (signal?.aborted) throw error
  }
  return []
}

export async function geocodeAddress(query: string): Promise<GeoPoint> {
  let first: AddressSuggestion | undefined
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
  const response = await fetch(`${REVERSE_GEOCODE_PROXY}?${params}`, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('Reverse geocoding request failed')
  const result = await response.json() as { display_name?: string }
  return { label: result.display_name ?? `${coordinates[1].toFixed(5)}, ${coordinates[0].toFixed(5)}`, coordinates }
}

export async function routeByMode(origin: GeoPoint, destination: GeoPoint, mode: Exclude<TravelMode, 'transit'>): Promise<RouteResult> {
  const params = new URLSearchParams({ mode, originLng: String(origin[0]), originLat: String(origin[1]), destinationLng: String(destination[0]), destinationLat: String(destination[1]) })
  const response = await fetch(`${ROUTE_PROXY}?${params}`)
  if (!response.ok) throw new Error('Routing request failed')
  const result = await response.json() as { code: string; routes?: { distance: number; duration: number; geometry?: { coordinates: GeoPoint[] } }[] }
  const route = result.routes?.[0]
  if (result.code !== 'Ok' || !route?.geometry?.coordinates?.length) throw new Error('No walking route found')
  return { mode, origin, destination, coordinates: route.geometry.coordinates, distanceMetres: route.distance, durationSeconds: route.duration }
}

export const routeWalking = (origin: GeoPoint, destination: GeoPoint) => routeByMode(origin, destination, 'walk')
