import { applyRateLimit, readBoundedQueryParam, readBoundedText, readCoordinate, requestUrlOf, requireMethod, timeoutSignal } from '../server/security.mjs'
import { distanceMetres, FINLAND_LATITUDE, FINLAND_LONGITUDE, MAX_ROUTE_DISTANCE_METRES } from '../server/geo.mjs'

const ROUTING_SERVERS = {
  walk: 'routed-foot',
  bike: 'routed-bike',
  car: 'routed-car',
}

export default async function handler(request, response) {
  if (!requireMethod(request, response, 'GET')) return
  if (!applyRateLimit(request, response, { scope: 'route', limit: 10 })) return

  const requestUrl = requestUrlOf(request)
  const mode = readBoundedQueryParam(requestUrl, 'mode', { maxLength: 4, required: true })
  const originLng = readCoordinate(requestUrl, 'originLng', FINLAND_LONGITUDE)
  const originLat = readCoordinate(requestUrl, 'originLat', FINLAND_LATITUDE)
  const destinationLng = readCoordinate(requestUrl, 'destinationLng', FINLAND_LONGITUDE)
  const destinationLat = readCoordinate(requestUrl, 'destinationLat', FINLAND_LATITUDE)
  if (!mode.valid || !ROUTING_SERVERS[mode.value] || !originLng.valid || !originLat.valid || !destinationLng.valid || !destinationLat.valid) {
    response.status(400).json({ error: 'Invalid route request' })
    return
  }

  const origin = [originLng.value, originLat.value]
  const destination = [destinationLng.value, destinationLat.value]
  if (distanceMetres(origin, destination) > MAX_ROUTE_DISTANCE_METRES) {
    response.status(400).json({ error: 'route_outside_supported_area' })
    return
  }

  const coordinates = `${origin[0]},${origin[1]};${destination[0]},${destination[1]}`
  const upstreamUrl = `https://routing.openstreetmap.de/${ROUTING_SERVERS[mode.value]}/route/v1/driving/${coordinates}?overview=full&geometries=geojson`
  try {
    const upstream = await fetch(upstreamUrl, { signal: timeoutSignal(8_000) })
    const body = await readBoundedText(upstream, 2_000_000)
    if (body === undefined) {
      response.status(502).json({ error: 'Routing response was too large' })
      return
    }
    if (!upstream.ok) {
      response.status(502).json({ error: 'routing_service_unavailable' })
      return
    }
    response.status(200)
    response.setHeader('Cache-Control', 'private, no-store')
    response.setHeader('Content-Type', 'application/json')
    response.send(body)
  } catch {
    response.status(502).json({ error: 'routing_service_unavailable' })
  }
}
