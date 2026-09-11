import type { SportFeature } from '../data/types'
import type { Projector } from './projection'
import { ellipseRing, frameFromRing, framePoint, rectangleRing } from './landmarks/geometry'
import { fillMapRings, strokeMapLine } from './landmarks/primitives'
import { sportStyle } from './theme'

function projectedSize(feature: SportFeature, projector: Projector) {
  const points = feature.rings[0].map(projector.point)
  const xs = points.map(({ x }) => x); const ys = points.map(({ y }) => y)
  return { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }
}

function footballMarkings(ctx: CanvasRenderingContext2D, feature: SportFeature, projector: Projector, marking: string) {
  const frame = frameFromRing(feature.rings[0])
  strokeMapLine(ctx, rectangleRing(frame, .84, .76), projector, marking, 1)
  strokeMapLine(ctx, [framePoint(frame, 0, -.76), framePoint(frame, 0, .76)], projector, marking, 1)
  strokeMapLine(ctx, ellipseRing(frame, .105, .18, 24), projector, marking, 1)
  ;[-1, 1].forEach((end) => {
    const goalArea = [
      framePoint(frame, end * .84, -.32), framePoint(frame, end * .66, -.32),
      framePoint(frame, end * .66, .32), framePoint(frame, end * .84, .32),
    ]
    strokeMapLine(ctx, goalArea, projector, marking, .8)
  })
}

function athleticsMarkings(ctx: CanvasRenderingContext2D, feature: SportFeature, projector: Projector, marking: string) {
  const frame = frameFromRing(feature.rings[0])
  ;[[.86, .78], [.76, .66], [.66, .54]].forEach(([long, short]) => strokeMapLine(ctx, ellipseRing(frame, long, short), projector, marking, .75))
}

function courtMarkings(ctx: CanvasRenderingContext2D, feature: SportFeature, projector: Projector, marking: string) {
  const frame = frameFromRing(feature.rings[0])
  strokeMapLine(ctx, rectangleRing(frame, .82, .76), projector, marking, .9)
  strokeMapLine(ctx, [framePoint(frame, 0, -.76), framePoint(frame, 0, .76)], projector, marking, .9)
  if (['tennis', 'padel'].includes(feature.sport)) {
    ;[-.46, .46].forEach((along) => strokeMapLine(ctx, [framePoint(frame, along, -.76), framePoint(frame, along, .76)], projector, marking, .65))
    strokeMapLine(ctx, [framePoint(frame, -.46, 0), framePoint(frame, .46, 0)], projector, marking, .65)
  } else if (feature.sport === 'basketball') {
    strokeMapLine(ctx, ellipseRing(frame, .12, .2, 24), projector, marking, .8)
    ;[-.52, .52].forEach((along) => strokeMapLine(ctx, [framePoint(frame, along, -.76), framePoint(frame, along, .76)], projector, marking, .65))
  }
}

function swimmingMarkings(ctx: CanvasRenderingContext2D, feature: SportFeature, projector: Projector, marking: string) {
  const frame = frameFromRing(feature.rings[0])
  strokeMapLine(ctx, rectangleRing(frame, .86, .78), projector, marking, .8)
  ;[-.52, -.26, 0, .26, .52].forEach((across) => strokeMapLine(ctx, [framePoint(frame, -.86, across), framePoint(frame, .86, across)], projector, marking, .55))
}

function drawMarkerGlyph(ctx: CanvasRenderingContext2D, icon: NonNullable<SportFeature['icon']>, x: number, y: number) {
  ctx.strokeStyle = '#fff8ed'; ctx.fillStyle = '#fff8ed'; ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  if (icon === 'football' || icon === 'basketball' || icon === 'tennis' || icon === 'ice_hockey') {
    ctx.beginPath(); ctx.arc(x, y, 4.4, 0, Math.PI * 2); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(x - 3.5, y - 1.5); ctx.quadraticCurveTo(x, y, x + 3.5, y + 1.5); ctx.stroke()
    if (icon === 'ice_hockey') { ctx.beginPath(); ctx.moveTo(x - 5, y + 4); ctx.lineTo(x + 5, y + 4); ctx.stroke() }
    return
  }
  if (icon === 'athletics') { ctx.beginPath(); ctx.ellipse(x, y, 5, 3.5, 0, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.ellipse(x, y, 2.6, 1.6, 0, 0, Math.PI * 2); ctx.stroke(); return }
  if (icon === 'swimming') { ctx.beginPath(); ctx.moveTo(x - 6, y - 2); ctx.quadraticCurveTo(x - 3, y - 5, x, y - 2); ctx.quadraticCurveTo(x + 3, y + 1, x + 6, y - 2); ctx.moveTo(x - 6, y + 3); ctx.quadraticCurveTo(x - 3, y, x, y + 3); ctx.quadraticCurveTo(x + 3, y + 6, x + 6, y + 3); ctx.stroke(); return }
  if (icon === 'fitness') { ctx.beginPath(); ctx.arc(x, y - 4, 1.8, 0, Math.PI * 2); ctx.fill(); ctx.moveTo(x, y - 2); ctx.lineTo(x, y + 4); ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y); ctx.moveTo(x, y + 4); ctx.lineTo(x - 3, y + 7); ctx.moveTo(x, y + 4); ctx.lineTo(x + 3, y + 7); ctx.stroke(); return }
  ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y); ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5); ctx.stroke()
}

export function drawVenueMarker(ctx: CanvasRenderingContext2D, feature: SportFeature, projector: Projector, emphasis: 'default' | 'dimmed' | 'selected' = 'default') {
  if (!feature.icon) return drawSport(ctx, feature, projector, emphasis)
  const point = feature.rings[0].reduce((total, mapPoint) => ({ x: total.x + mapPoint.x / feature.rings[0].length, y: total.y + mapPoint.y / feature.rings[0].length }), { x: 0, y: 0 })
  const screen = projector.point(point)
  const style = sportStyle(feature.sport)
  const radius = emphasis === 'selected' ? 11 : 9
  ctx.save(); ctx.globalAlpha = emphasis === 'dimmed' ? .45 : 1
  if (emphasis === 'selected') { ctx.shadowColor = 'rgba(150,62,42,.55)'; ctx.shadowBlur = 12 }
  ctx.beginPath(); ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2); ctx.fillStyle = style.fill; ctx.fill(); ctx.strokeStyle = emphasis === 'selected' ? '#8f3d2c' : '#fff8ed'; ctx.lineWidth = emphasis === 'selected' ? 2.5 : 1.5; ctx.stroke()
  ctx.shadowBlur = 0; drawMarkerGlyph(ctx, feature.icon, screen.x, screen.y); ctx.restore()
}

export function drawSport(ctx: CanvasRenderingContext2D, feature: SportFeature, projector: Projector, emphasis: 'default' | 'dimmed' | 'selected' = 'default') {
  const style = sportStyle(feature.sport)
  ctx.save(); ctx.globalAlpha = emphasis === 'dimmed' ? .48 : 1
  if (emphasis === 'selected') { ctx.shadowColor = 'rgba(150,62,42,.48)'; ctx.shadowBlur = 12 }
  fillMapRings(ctx, feature.rings, projector, style.fill, emphasis === 'selected' ? '#8f3d2c' : style.stroke, 0, emphasis === 'selected' ? 2.8 : 1.6)
  ctx.shadowBlur = 0
  const size = projectedSize(feature, projector)
  if (size.width < 14 || size.height < 9) { ctx.restore(); return }
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  if (['soccer', 'football'].includes(feature.sport) || feature.facilityType === 'pitch') footballMarkings(ctx, feature, projector, style.marking)
  else if (['athletics', 'running'].includes(feature.sport)) athleticsMarkings(ctx, feature, projector, style.marking)
  else if (feature.sport === 'swimming') swimmingMarkings(ctx, feature, projector, style.marking)
  else if (['tennis', 'padel', 'basketball', 'ice_hockey'].includes(feature.sport)) courtMarkings(ctx, feature, projector, style.marking)
  ctx.restore()
  ctx.restore()
}
