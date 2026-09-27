import { applyRateLimit, timeoutSignal } from '../server/security.mjs'

const DIGITRANSIT_URL = 'https://api.digitransit.fi/routing/v2/hsl/gtfs/v1'
const MAX_ROUTE_DISTANCE_METRES = 100_000

const TRANSIT_QUERY = `
  query TransitPlan($origin: PlanLabeledLocationInput!, $destination: PlanLabeledLocationInput!, $locale: Locale) {
    planConnection(
      first: 1
      origin: $origin
      destination: $destination
      locale: $locale
      searchWindow: "PT1H"
      modes: {
        transitOnly: true
        transit: { access: [WALK], egress: [WALK], transfer: [WALK] }
      }
    ) {
      edges {
        node {
          duration
          walkTime
          numberOfTransfers
          legs {
            mode
            transitLeg
            duration
            distance
            headsign
            legGeometry { points }
            from { name lat lon stop { zoneId } }
            to { name lat lon stop { zoneId } }
            route { shortName mode }
          }
        }
      }
      routingErrors { code description inputField }
    }
  }
`

function distanceMetres([leftLng, leftLat], [rightLng, rightLat]) {
  const earthRadius = 6_371_000
  const toRadians = (value) => value * Math.PI / 180
  const deltaLat = toRadians(rightLat - leftLat)
  const deltaLng = toRadians(rightLng - leftLng)
  const latitude = toRadians((leftLat + rightLat) / 2)
  const x = deltaLng * Math.cos(latitude)
  return Math.sqrt((deltaLat * earthRadius) ** 2 + (x * earthRadius) ** 2)
}

function normalizeZone(zoneId) {
  const zone = String(zoneId ?? '').split(':').pop()?.trim().toUpperCase()
  return /^[A-E]$/.test(zone ?? '') ? zone : undefined
}

function decodePolyline(encoded) {
  if (!encoded) return []
  const coordinates = []
  let index = 0
  let latitude = 0
  let longitude = 0
  while (index < encoded.length) {
    let result = 0
    let shift = 0
    let byte
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20 && index < encoded.length)
    latitude += result & 1 ? ~(result >> 1) : result >> 1
    result = 0
    shift = 0
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20 && index < encoded.length)
    longitude += result & 1 ? ~(result >> 1) : result >> 1
    coordinates.push([longitude / 1e5, latitude / 1e5])
  }
  return coordinates
}

function appendCoordinates(target, coordinates) {
  coordinates.forEach((coordinate) => {
    const previous = target[target.length - 1]
    if (!previous || previous[0] !== coordinate[0] || previous[1] !== coordinate[1]) target.push(coordinate)
  })
}

async function readJsonBody(request) {
  if (request.body && typeof request.body === 'object') return request.body
  if (typeof request.body === 'string') return JSON.parse(request.body)
  let body = ''
  for await (const chunk of request) body += chunk
  return body ? JSON.parse(body) : undefined
}

function validCoordinatePair(value) {
  return Array.isArray(value) && value.length === 2 && value.every((part) => typeof part === 'number' && Number.isFinite(part)) && value[0] >= 19 && value[0] <= 32 && value[1] >= 58 && value[1] <= 71
}

function routeFromItinerary(itinerary, origin, destination) {
  const coordinates = []
  const zones = new Set()
  const distanceMetres = (itinerary.legs ?? []).reduce((total, leg) => total + (Number(leg.distance) || 0), 0)
  const legs = (itinerary.legs ?? []).map((leg) => {
    const legZones = [normalizeZone(leg.from?.stop?.zoneId), normalizeZone(leg.to?.stop?.zoneId)].filter(Boolean)
    legZones.forEach((zone) => zones.add(zone))
    const geometry = decodePolyline(leg.legGeometry?.points)
    if (geometry.length) appendCoordinates(coordinates, geometry)
    else {
      if (Number.isFinite(leg.from?.lon) && Number.isFinite(leg.from?.lat)) appendCoordinates(coordinates, [[leg.from.lon, leg.from.lat]])
      if (Number.isFinite(leg.to?.lon) && Number.isFinite(leg.to?.lat)) appendCoordinates(coordinates, [[leg.to.lon, leg.to.lat]])
    }
    return {
      mode: leg.mode,
      routeName: leg.route?.shortName ?? undefined,
      headsign: leg.headsign ?? undefined,
      from: leg.from?.name ?? undefined,
      to: leg.to?.name ?? undefined,
      fromCoordinates: Number.isFinite(leg.from?.lon) && Number.isFinite(leg.from?.lat) ? [leg.from.lon, leg.from.lat] : undefined,
      toCoordinates: Number.isFinite(leg.to?.lon) && Number.isFinite(leg.to?.lat) ? [leg.to.lon, leg.to.lat] : undefined,
      geometry: geometry.length > 1 ? geometry : undefined,
      durationSeconds: Math.max(0, Number(leg.duration) || 0),
      zones: legZones,
    }
  })
  if (!coordinates.length) appendCoordinates(coordinates, [origin, destination])
  return {
    code: 'Ok',
    route: {
      coordinates,
      distanceMetres,
      durationSeconds: Math.max(0, Number(itinerary.duration) || 0),
      transit: {
        zones: [...zones].sort(),
        legs,
        transfers: Math.max(0, Number(itinerary.numberOfTransfers) || 0),
        walkDurationSeconds: Math.max(0, Number(itinerary.walkTime) || 0),
      },
    },
  }
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    response.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (!applyRateLimit(request, response, { scope: 'transit-route', limit: 8 })) return

  const apiKey = process.env.DIGITRANSIT_API_KEY
  if (!apiKey) {
    response.status(503).json({ error: 'transit_service_unavailable' })
    return
  }

  let body
  try { body = await readJsonBody(request) } catch {
    response.status(400).json({ error: 'Invalid transit request' })
    return
  }
  const origin = body?.origin
  const destination = body?.destination
  if (!validCoordinatePair(origin) || !validCoordinatePair(destination) || distanceMetres(origin, destination) > MAX_ROUTE_DISTANCE_METRES) {
    response.status(400).json({ error: 'Invalid transit request' })
    return
  }

  const locale = body?.locale === 'fi' ? 'FI' : 'EN'
  try {
    const upstream = await fetch(DIGITRANSIT_URL, {
      method: 'POST',
      signal: timeoutSignal(10_000),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'digitransit-subscription-key': apiKey,
      },
      body: JSON.stringify({
        query: TRANSIT_QUERY,
        variables: {
          locale,
          origin: { location: { coordinate: { latitude: origin[1], longitude: origin[0] } } },
          destination: { location: { coordinate: { latitude: destination[1], longitude: destination[0] } } },
        },
      }),
    })
    const result = await upstream.json()
    if (!upstream.ok || result.errors?.length) {
      response.status(502).json({ error: 'transit_service_unavailable' })
      return
    }
    const itinerary = result.data?.planConnection?.edges?.[0]?.node
    if (!itinerary) {
      response.status(404).json({ error: 'transit_no_route' })
      return
    }
    response.status(200)
    response.setHeader('Cache-Control', 'private, no-store')
    response.json(routeFromItinerary(itinerary, origin, destination))
  } catch {
    response.status(502).json({ error: 'transit_service_unavailable' })
  }
}
