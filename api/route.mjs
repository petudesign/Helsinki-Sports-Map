import { applyRateLimit, readCoordinate, readBoundedQueryParam, timeoutSignal } from '../server/security.mjs'

const ROUTING_SERVERS = {
  walk: 'routed-foot',
  bike: 'routed-bike',
  car: 'routed-car',
}
const MAX_ROUTE_DISTANCE_METRES = 100_000

function distanceMetres([leftLng, leftLat], [rightLng, rightLat]) {
  const earthRadius = 6_371_000
  const toRadians = (value) => value * Math.PI / 180
  const deltaLat = toRadians(rightLat - leftLat)
  const deltaLng = toRadians(rightLng - leftLng)
  const latitude = toRadians((leftLat + rightLat) / 2)
  const x = deltaLng * Math.cos(latitude)
  return Math.sqrt((deltaLat * earthRadius) ** 2 + (x * earthRadius) ** 2)
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    response.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (!applyRateLimit(request, response, { scope: 'route', limit: 10 })) return

  const requestUrl = new URL(request.url ?? '/', 'http://localhost')
  const mode = readBoundedQueryParam(requestUrl, 'mode', { maxLength: 4, required: true })
  const originLng = readCoordinate(requestUrl, 'originLng', { min: 19, max: 32 })
  const originLat = readCoordinate(requestUrl, 'originLat', { min: 58, max: 71 })
  const destinationLng = readCoordinate(requestUrl, 'destinationLng', { min: 19, max: 32 })
  const destinationLat = readCoordinate(requestUrl, 'destinationLat', { min: 58, max: 71 })
  if (!mode.valid || !ROUTING_SERVERS[mode.value] || !originLng.valid || !originLat.valid || !destinationLng.valid || !destinationLat.valid) {
    response.status(400).json({ error: 'Invalid route request' })
    return
  }

  const origin = [originLng.value, originLat.value]
  const destination = [destinationLng.value, destinationLat.value]
  if (distanceMetres(origin, destination) > MAX_ROUTE_DISTANCE_METRES) {
    response.status(400).json({ error: 'Route is outside the supported area' })
    return
  }

  const coordinates = `${origin[0]},${origin[1]};${destination[0]},${destination[1]}`
  const upstreamUrl = `https://routing.openstreetmap.de/${ROUTING_SERVERS[mode.value]}/route/v1/driving/${coordinates}?overview=full&geometries=geojson`
  try {
    const upstream = await fetch(upstreamUrl, { signal: timeoutSignal(8_000) })
    const contentLength = Number(upstream.headers.get('content-length'))
    if (Number.isFinite(contentLength) && contentLength > 2_000_000) {
      response.status(502).json({ error: 'Routing response was too large' })
      return
    }
    const body = await upstream.text()
    if (body.length > 2_000_000) {
      response.status(502).json({ error: 'Routing response was too large' })
      return
    }
    if (!upstream.ok) {
      response.status(502).json({ error: 'Routing service request failed' })
      return
    }
    response.status(200)
    response.setHeader('Cache-Control', 'private, no-store')
    response.setHeader('Content-Type', 'application/json')
    response.send(body)
  } catch {
    response.status(502).json({ error: 'Routing service request failed' })
  }
}
