import type { MapPoint } from '../../data/types'

export type OrientedFrame = {
  center: MapPoint
  longAxis: MapPoint
  shortAxis: MapPoint
  halfLong: number
  halfShort: number
}

function openRing(ring: MapPoint[]) {
  const last = ring[ring.length - 1]
  if (ring.length > 1 && ring[0].x === last.x && ring[0].y === last.y) return ring.slice(0, -1)
  return ring
}

// Loaded map geometry is immutable; camera changes do not change these frames.
const frames = new WeakMap<MapPoint[], OrientedFrame>()
export function frameFromRing(source: MapPoint[]): OrientedFrame {
  const cached = frames.get(source)
  if (cached) return cached
  const ring = openRing(source)
  const mean = ring.reduce((sum, point) => ({ x: sum.x + point.x / ring.length, y: sum.y + point.y / ring.length }), { x: 0, y: 0 })
  const covariance = ring.reduce((sum, point) => {
    const x = point.x - mean.x; const y = point.y - mean.y
    return { xx: sum.xx + x * x, xy: sum.xy + x * y, yy: sum.yy + y * y }
  }, { xx: 0, xy: 0, yy: 0 })
  const angle = .5 * Math.atan2(2 * covariance.xy, covariance.xx - covariance.yy)
  let longAxis = { x: Math.cos(angle), y: Math.sin(angle) }
  let shortAxis = { x: -longAxis.y, y: longAxis.x }
  const extents = (axis: MapPoint) => ring.map((point) => (point.x - mean.x) * axis.x + (point.y - mean.y) * axis.y)
  let longValues = extents(longAxis); let shortValues = extents(shortAxis)
  if (Math.max(...longValues) - Math.min(...longValues) < Math.max(...shortValues) - Math.min(...shortValues)) {
    ;[longAxis, shortAxis] = [shortAxis, longAxis]
    ;[longValues, shortValues] = [shortValues, longValues]
  }
  const longMin = Math.min(...longValues); const longMax = Math.max(...longValues)
  const shortMin = Math.min(...shortValues); const shortMax = Math.max(...shortValues)
  const longOffset = (longMin + longMax) / 2; const shortOffset = (shortMin + shortMax) / 2
  const frame = {
    center: { x: mean.x + longAxis.x * longOffset + shortAxis.x * shortOffset, y: mean.y + longAxis.y * longOffset + shortAxis.y * shortOffset },
    longAxis,
    shortAxis,
    halfLong: (longMax - longMin) / 2,
    halfShort: (shortMax - shortMin) / 2,
  }
  frames.set(source, frame)
  return frame
}

export function framePoint(frame: OrientedFrame, along: number, across: number): MapPoint {
  return {
    x: frame.center.x + frame.longAxis.x * frame.halfLong * along + frame.shortAxis.x * frame.halfShort * across,
    y: frame.center.y + frame.longAxis.y * frame.halfLong * along + frame.shortAxis.y * frame.halfShort * across,
  }
}

export function rectangleRing(frame: OrientedFrame, longScale = 1, shortScale = 1): MapPoint[] {
  const ring = [framePoint(frame, -longScale, -shortScale), framePoint(frame, longScale, -shortScale), framePoint(frame, longScale, shortScale), framePoint(frame, -longScale, shortScale)]
  return [...ring, ring[0]]
}

export function ellipseRing(frame: OrientedFrame, longScale = 1, shortScale = 1, steps = 44): MapPoint[] {
  const ring = Array.from({ length: steps }, (_, index) => {
    const angle = index / steps * Math.PI * 2
    return framePoint(frame, Math.cos(angle) * longScale, Math.sin(angle) * shortScale)
  })
  return [...ring, ring[0]]
}

export function buildingCenter(rings: MapPoint[][]): MapPoint {
  const ring = openRing(rings[0])
  return ring.reduce((sum, point) => ({ x: sum.x + point.x / ring.length, y: sum.y + point.y / ring.length }), { x: 0, y: 0 })
}

export function pointInRing(point: MapPoint, source: MapPoint[]) {
  const ring = openRing(source)
  let inside = false
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const a = ring[index]; const b = ring[previous]
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}
