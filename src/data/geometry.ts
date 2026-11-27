import type { Bounds, GeoPoint, MapPoint } from './types'

// Great-circle distance between two [longitude, latitude] points.
export function distanceMetres([lng1, lat1]: GeoPoint, [lng2, lat2]: GeoPoint) {
  const rad = Math.PI / 180
  const a = Math.sin((lat2 - lat1) * rad / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin((lng2 - lng1) * rad / 2) ** 2
  return 6_371_000 * 2 * Math.asin(Math.sqrt(a))
}

export function boundsOf(points: MapPoint[]): Bounds {
  return points.reduce((bounds, point) => ({
    minX: Math.min(bounds.minX, point.x), minY: Math.min(bounds.minY, point.y),
    maxX: Math.max(bounds.maxX, point.x), maxY: Math.max(bounds.maxY, point.y),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity })
}
