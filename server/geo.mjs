// Geographic limits shared by the lookup and routing handlers.

// Coordinates outside this box are not in Finland and are rejected up front.
export const FINLAND_LONGITUDE = { min: 19, max: 32 }
export const FINLAND_LATITUDE = { min: 58, max: 71 }

// Helsinki's coverage as west,north,east,south for Nominatim's viewbox.
// Same box as `coverage` in src/config/city.ts; change both together.
export const HELSINKI_VIEWBOX = '24.7828026,60.2978497,25.2545116,59.922486'

export const MAX_ROUTE_DISTANCE_METRES = 100_000

export function isFinnishCoordinatePair(value) {
  return Array.isArray(value) && value.length === 2
    && value.every((part) => typeof part === 'number' && Number.isFinite(part))
    && value[0] >= FINLAND_LONGITUDE.min && value[0] <= FINLAND_LONGITUDE.max
    && value[1] >= FINLAND_LATITUDE.min && value[1] <= FINLAND_LATITUDE.max
}

// Equirectangular approximation: accurate enough for the route length guard.
export function distanceMetres([leftLng, leftLat], [rightLng, rightLat]) {
  const earthRadius = 6_371_000
  const toRadians = (value) => value * Math.PI / 180
  const deltaLat = toRadians(rightLat - leftLat)
  const deltaLng = toRadians(rightLng - leftLng)
  const latitude = toRadians((leftLat + rightLat) / 2)
  const x = deltaLng * Math.cos(latitude)
  return Math.sqrt((deltaLat * earthRadius) ** 2 + (x * earthRadius) ** 2)
}
