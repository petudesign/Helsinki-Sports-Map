import { applyRateLimit, NOMINATIM_USER_AGENT, readBoundedText, readCoordinate, requestUrlOf, requireMethod, reserveNominatimSlot, timeoutSignal } from '../server/security.mjs'
import { FINLAND_LATITUDE, FINLAND_LONGITUDE } from '../server/geo.mjs'

const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse'

export default async function handler(request, response) {
  if (!requireMethod(request, response, 'GET')) return
  if (!applyRateLimit(request, response, { scope: 'nominatim-reverse', limit: 10 })) return

  const requestUrl = requestUrlOf(request)
  const latitude = readCoordinate(requestUrl, 'lat', FINLAND_LATITUDE)
  const longitude = readCoordinate(requestUrl, 'lon', FINLAND_LONGITUDE)
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
    const body = await readBoundedText(upstream, 100_000)
    if (body === undefined) {
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
