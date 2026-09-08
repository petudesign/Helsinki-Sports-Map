import type { MapPoint } from '../../data/types'
import type { Projector, ScreenPoint, View } from '../projection'

export type VolumeStyle = { top: string; side: string; sideDark: string; outline: string; shadow: string }

function traceRing(ctx: CanvasRenderingContext2D, ring: ScreenPoint[]) {
  ring.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y))
  ctx.closePath()
}

export function projectRing(ring: MapPoint[], projector: Projector, elevation = 0) {
  return ring.map((point) => { const screen = projector.point(point); return { x: screen.x, y: screen.y - elevation } })
}

export function fillMapRing(ctx: CanvasRenderingContext2D, ring: MapPoint[], projector: Projector, fill: string, stroke?: string, elevation = 0, lineWidth = 1) {
  fillMapRings(ctx, [ring], projector, fill, stroke, elevation, lineWidth)
}

export function fillMapRings(ctx: CanvasRenderingContext2D, rings: MapPoint[][], projector: Projector, fill: string, stroke?: string, elevation = 0, lineWidth = 1) {
  ctx.beginPath(); rings.forEach((ring) => traceRing(ctx, projectRing(ring, projector, elevation))); ctx.fillStyle = fill; ctx.fill('evenodd')
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke() }
}

export function strokeMapLine(ctx: CanvasRenderingContext2D, points: MapPoint[], projector: Projector, stroke: string, lineWidth = 1, elevation = 0) {
  const screen = projectRing(points, projector, elevation)
  ctx.beginPath(); screen.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke()
}

export function drawVolume(ctx: CanvasRenderingContext2D, ring: MapPoint[], heightMetres: number, projector: Projector, view: View, style: VolumeStyle) {
  const bottom = projectRing(ring, projector)
  const elevation = projector.height(heightMetres)
  if (view.mode === '2d') { ctx.beginPath(); traceRing(ctx, bottom); ctx.fillStyle = style.top; ctx.fill(); ctx.strokeStyle = style.outline; ctx.lineWidth = .8; ctx.stroke(); return }
  const top = bottom.map((point) => ({ x: point.x, y: point.y - elevation }))
  ctx.save(); ctx.translate(10 * view.zoom, 12 * view.zoom); ctx.beginPath(); traceRing(ctx, bottom); ctx.fillStyle = style.shadow; ctx.fill(); ctx.restore()
  const last = ring[ring.length - 1]
  const edgeCount = ring[0].x === last.x && ring[0].y === last.y ? bottom.length - 1 : bottom.length
  for (let index = 0; index < edgeCount; index++) {
    const next = (index + 1) % edgeCount
    ctx.beginPath(); traceRing(ctx, [bottom[index], bottom[next], top[next], top[index]])
    ctx.fillStyle = bottom[next].x - bottom[index].x > 0 ? style.side : style.sideDark; ctx.fill(); ctx.strokeStyle = style.outline; ctx.lineWidth = .55; ctx.stroke()
  }
  ctx.beginPath(); traceRing(ctx, top); ctx.fillStyle = style.top; ctx.fill(); ctx.strokeStyle = style.outline; ctx.lineWidth = .8; ctx.stroke()
}

export function drawMapLabel(ctx: CanvasRenderingContext2D, point: MapPoint, projector: Projector, text: string, elevation = 0) {
  const screen = projector.point(point); const y = screen.y - elevation
  ctx.font = '600 8px DM Mono, monospace'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(237,232,223,.94)'; ctx.strokeText(text, screen.x, y); ctx.fillStyle = '#2f3330'; ctx.fillText(text, screen.x, y)
}
