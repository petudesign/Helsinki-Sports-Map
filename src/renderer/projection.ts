import type { MapDataset, MapPoint } from '../data/types'

export type ScreenPoint = { x: number; y: number }
export type View = { mode: '2d' | 'iso'; zoom: number; pan: ScreenPoint }

export function createProjector(area: MapDataset, width: number, height: number, view: View) {
  const { minX, minY, maxX, maxY } = area.bounds
  const spanX = maxX - minX
  const spanY = maxY - minY
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const portrait = height > width * 1.1
  const fit2d = Math.min(width * (portrait ? 1.28 : .78) / spanX, height * (portrait ? .72 : .76) / spanY)
  const fitIso = Math.min(width * (portrait ? 1.8 : .74) / ((spanX + spanY) * .72), height * (portrait ? .82 : .62) / ((spanX + spanY) * .34))
  const scale = view.mode === '2d' ? fit2d : fitIso

  const applyView = (point: ScreenPoint): ScreenPoint => ({
    x: width / 2 + (point.x - width / 2) * view.zoom + view.pan.x,
    y: height / 2 + (point.y - height / 2) * view.zoom + view.pan.y,
  })

  return {
    point(point: MapPoint): ScreenPoint {
      const east = point.x - centerX
      const north = point.y - centerY
      if (view.mode === '2d') return applyView({ x: width / 2 + east * scale, y: height / 2 - north * scale })
      return applyView({ x: width / 2 + (east + north) * scale * .72, y: height * .53 + (east - north) * scale * .34 })
    },
    height(metres: number) { return view.mode === 'iso' ? metres * scale * .72 * view.zoom : 0 },
    scale: scale * view.zoom,
  }
}
