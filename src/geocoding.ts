import type { GeoPoint } from './data/types'
import districtsData from './data/districts.json'
import { requestJson } from './http'

export type PlaceKind = 'area' | 'place' | 'station'
export type AddressSuggestion = { label: string; coordinates?: GeoPoint; streetName?: string; kind?: PlaceKind; detail?: string }

const PAIKKATIETO_ADDRESS_PROXY = '/api/paikkatieto'
const HELSINKI_STREET_PROXY = '/api/helsinki-streets'
const GEOCODE_PROXY = '/api/geocode'
const REVERSE_GEOCODE_PROXY = '/api/reverse-geocode'
const PLACES_PROXY = '/api/places'
const MAX_STREET_SUGGESTIONS = 8

// Upstream bodies are not trusted to have the documented shape: a null body or a
// non-list field reads as "no results" instead of a TypeError.
const listOf = <T>(value: T[] | null | undefined): T[] => Array.isArray(value) ? value : []

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
  const suggestions = dedupeSuggestions(listOf(result?.results).flatMap((address) => {
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
  for (const feature of listOf(result?.features)) {
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
  return dedupeSuggestions(listOf(results).flatMap((result) => {
    const suggestion = formatNominatimAddress(result)
    return suggestion ? [suggestion] : []
  }))
}

type District = { name: string; sv?: string; point: GeoPoint }
const loadDistricts = async (): Promise<District[]> => (typeof districtsData !== 'undefined' ? (districtsData as District[]) : [])

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
      const result = await requestJson<{ places?: { name: string; kind: PlaceKind; detail?: string; coordinates: GeoPoint }[] }>(`${PLACES_PROXY}?${params}`, signal, 5_000)
      return listOf(result?.places).filter((place) => typeof place?.name === 'string' && Array.isArray(place.coordinates))
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
    // If the street lookup throws first (for example on cancellation) this promise is
    // never awaited; mark it handled so its rejection is not reported as uncaught.
    placesRequest.catch(() => undefined)
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
  return { label: (typeof result?.display_name === 'string' ? result.display_name : undefined) ?? `${coordinates[1].toFixed(5)}, ${coordinates[0].toFixed(5)}`, coordinates }
}
