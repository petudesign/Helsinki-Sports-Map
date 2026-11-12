// Place and area autocomplete for the starting-point field ("Kamppi", "Itäkeskus",
// "Kauppakeskus Redi"). Uses Digitransit's geocoder with the same server-only key
// as transit routing. Street addresses still come from Helsinki's own registers.
import { applyRateLimit, readBoundedQueryParam, timeoutSignal } from '../server/security.mjs'

const DIGITRANSIT_GEOCODING_URL = 'https://api.digitransit.fi/geocoding/v1/autocomplete'
// Neighbourhoods, districts, named venues and stations. Individual bus stops are
// left out: "Kamppi" would otherwise list a dozen stop codes before the district.
const LAYERS = 'neighbourhood,localadmin,venue,station'
const LANGUAGES = new Set(['fi', 'sv', 'en'])
const KIND_BY_LAYER = { neighbourhood: 'area', localadmin: 'area', venue: 'place', station: 'station' }

function compactFeature(feature) {
  const coordinates = feature?.geometry?.coordinates
  const properties = feature?.properties ?? {}
  if (!Array.isArray(coordinates) || coordinates.length !== 2 || coordinates.some((value) => !Number.isFinite(value))) return undefined
  const name = typeof properties.name === 'string' ? properties.name.trim() : ''
  const kind = KIND_BY_LAYER[properties.layer]
  if (!name || !kind) return undefined
  const street = [properties.street, properties.housenumber].filter(Boolean).join(' ')
  const area = properties.neighbourhood && properties.neighbourhood !== name ? properties.neighbourhood : undefined
  const city = properties.locality ?? properties.localadmin
  const detail = [street || area, city && city !== name ? city : undefined].filter(Boolean).join(', ')
  return { name, kind, detail, coordinates: [Number(coordinates[0].toFixed(6)), Number(coordinates[1].toFixed(6))] }
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    response.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (!applyRateLimit(request, response, { scope: 'places', limit: 60 })) return

  const apiKey = process.env.DIGITRANSIT_API_KEY
  if (!apiKey) {
    response.status(503).json({ error: 'places_service_unavailable' })
    return
  }

  const requestUrl = new URL(request.url ?? '/', 'http://localhost')
  const text = readBoundedQueryParam(requestUrl, 'text', { maxLength: 80, required: true })
  const lang = requestUrl.searchParams.get('lang') ?? 'fi'
  if (!text.valid || text.value.length < 2 || !LANGUAGES.has(lang)) {
    response.status(400).json({ error: 'Invalid place query' })
    return
  }

  const query = new URLSearchParams({
    text: text.value,
    lang,
    layers: LAYERS,
    size: '8',
    // Bias towards central Helsinki and keep results inside the capital region.
    'focus.point.lat': '60.1699',
    'focus.point.lon': '24.9384',
    'boundary.rect.min_lat': '60.05',
    'boundary.rect.max_lat': '60.40',
    'boundary.rect.min_lon': '24.50',
    'boundary.rect.max_lon': '25.30',
  })

  try {
    const upstream = await fetch(`${DIGITRANSIT_GEOCODING_URL}?${query}`, {
      headers: { Accept: 'application/json', 'digitransit-subscription-key': apiKey },
      signal: timeoutSignal(5_000),
    })
    const body = await upstream.text()
    if (!upstream.ok || body.length > 1_000_000) {
      response.status(502).json({ error: 'places_service_unavailable' })
      return
    }
    const features = JSON.parse(body)?.features
    const places = (Array.isArray(features) ? features : []).map(compactFeature).filter(Boolean)
    response.status(200)
    response.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400, stale-if-error=600')
    response.json({ places })
  } catch {
    response.status(502).json({ error: 'places_service_unavailable' })
  }
}
