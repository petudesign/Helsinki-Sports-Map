import { applyRateLimit, NOMINATIM_USER_AGENT, readBoundedQueryParam, readBoundedText, requestUrlOf, requireMethod, reserveNominatimSlot, timeoutSignal } from '../server/security.mjs'
import { HELSINKI_VIEWBOX } from '../server/geo.mjs'

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'

function safeResult(result) {
  return {
    lat: result?.lat,
    lon: result?.lon,
    display_name: result?.display_name,
    address: {
      road: result?.address?.road,
      pedestrian: result?.address?.pedestrian,
      house_number: result?.address?.house_number,
      postcode: result?.address?.postcode,
    },
  }
}

export default async function handler(request, response) {
  if (!requireMethod(request, response, 'GET')) return
  if (!applyRateLimit(request, response, { scope: 'nominatim-geocode', limit: 10 })) return

  const requestUrl = requestUrlOf(request)
  const query = readBoundedQueryParam(requestUrl, 'q', { maxLength: 128, required: true })
  if (!query.valid) {
    response.status(400).json({ error: 'Invalid geocoding query' })
    return
  }
  const retryAfter = reserveNominatimSlot()
  if (retryAfter > 0) {
    response.setHeader('Retry-After', String(retryAfter))
    response.status(429).json({ error: 'Geocoding is temporarily busy' })
    return
  }
  const params = new URLSearchParams({
    format: 'jsonv2',
    limit: '1',
    addressdetails: '1',
    countrycodes: 'fi',
    'accept-language': 'fi,en',
    viewbox: HELSINKI_VIEWBOX,
    bounded: '1',
    q: query.value,
  })

  try {
    const upstream = await fetch(`${NOMINATIM_SEARCH_URL}?${params}`, {
      headers: { Accept: 'application/json', 'User-Agent': NOMINATIM_USER_AGENT },
      signal: timeoutSignal(5_000),
    })
    if (!upstream.ok) {
      response.status(502).json({ error: 'Geocoding service request failed' })
      return
    }
    const body = await readBoundedText(upstream, 500_000)
    if (body === undefined) {
      response.status(502).json({ error: 'Geocoding response was too large' })
      return
    }
    const results = JSON.parse(body)
    response.status(200)
    response.setHeader('Cache-Control', 'private, no-store')
    response.setHeader('Content-Type', 'application/json')
    response.json(Array.isArray(results) ? results.map(safeResult) : [])
  } catch {
    response.status(502).json({ error: 'Geocoding service request failed' })
  }
}
