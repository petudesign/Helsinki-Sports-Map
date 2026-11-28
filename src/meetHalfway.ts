import { distanceMetres } from './data/geometry'
import type { GeoPoint } from './data/types'

export type HalfwayPoint = {
  coordinates: GeoPoint
  label: string
}

export type HalfwayPair = {
  a: HalfwayPoint
  b: HalfwayPoint
}

export type HalfwayMetrics = {
  distanceA: number
  distanceB: number
  /** Lower is fairer: minimizes the longer trip while gently penalizing lopsided splits. */
  fairnessScore: number
}

export function computeHalfwayMetrics(pointA: GeoPoint, pointB: GeoPoint, target: GeoPoint): HalfwayMetrics {
  const distanceA = distanceMetres(pointA, target)
  const distanceB = distanceMetres(pointB, target)
  const fairnessScore = Math.max(distanceA, distanceB) + 0.35 * Math.abs(distanceA - distanceB)
  return { distanceA, distanceB, fairnessScore }
}

export function midpoint(a: GeoPoint, b: GeoPoint): GeoPoint {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
}
