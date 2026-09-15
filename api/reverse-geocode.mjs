import { applyRateLimit, readCoordinate, reserveNominatimSlot, timeoutSignal } from '../server/security.mjs'

const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse'
const NOMINATIM_USER_AGENT = 'Helsinki-Sports-Map/0.0.1 (+https://helsinki-sports-map.vercel.app/)'

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    response.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (!applyRateLimit(request, response, { scope: 'nominatim-reverse', limit: 10 })) return

  const requestUrl = new URL(request.url ?? '/', 'http://localhost')
  const latitude = readCoordinate(requestUrl, 'lat', { min: 58, max: 71 })
  const longitude = readCoordinate(requestUrl, 'lon', { min: 19, max: 32 })
  if (!latitude.valid || !longitude.valid) {
    response.status(400).json({ error: 'Invalid coordinates' })
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
    zoom: '18',
    addressdetails: '1',
    'accept-language': 'fi,en',
    lat: String(latitude.value),
    lon: String(longitude.value),
  })

  try {
    const upstream = await fetch(`${NOMINATIM_REVERSE_URL}?${params}`, {
      headers: { Accept: 'application/json', 'User-Agent': NOMINATIM_USER_AGENT },
      signal: timeoutSignal(5_000),
    })
    if (!upstream.ok) {
      response.status(502).json({ error: 'Reverse geocoding service request failed' })
      return
    }
    const contentLength = Number(upstream.headers.get('content-length'))
    if (Number.isFinite(contentLength) && contentLength > 100_000) {
      response.status(502).json({ error: 'Reverse geocoding response was too large' })
      return
    }
    const body = await upstream.text()
    if (body.length > 100_000) {
      response.status(502).json({ error: 'Reverse geocoding response was too large' })
      return
    }
    const result = JSON.parse(body)
    response.status(200)
    response.setHeader('Cache-Control', 'private, no-store')
    response.setHeader('Content-Type', 'application/json')
    response.json({ display_name: typeof result?.display_name === 'string' ? result.display_name : undefined })
  } catch {
    response.status(502).json({ error: 'Reverse geocoding service request failed' })
  }
}
