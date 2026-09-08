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
  if (feature.sport === 'tennis') {
    ;[-.46, .46].forEach((along) => strokeMapLine(ctx, [framePoint(frame, along, -.76), framePoint(frame, along, .76)], projector, marking, .65))
    strokeMapLine(ctx, [framePoint(frame, -.46, 0), framePoint(frame, .46, 0)], projector, marking, .65)
  } else {
    strokeMapLine(ctx, ellipseRing(frame, .12, .2, 24), projector, marking, .8)
  }
}

function swimmingMarkings(ctx: CanvasRenderingContext2D, feature: SportFeature, projector: Projector, marking: string) {
  const frame = frameFromRing(feature.rings[0])
  strokeMapLine(ctx, rectangleRing(frame, .86, .78), projector, marking, .8)
  ;[-.52, -.26, 0, .26, .52].forEach((across) => strokeMapLine(ctx, [framePoint(frame, -.86, across), framePoint(frame, .86, across)], projector, marking, .55))
}

export function drawSport(ctx: CanvasRenderingContext2D, feature: SportFeature, projector: Projector, emphasis: 'default' | 'dimmed' | 'selected' = 'default') {
  const style = sportStyle(feature.sport)
  ctx.save(); ctx.globalAlpha = emphasis === 'dimmed' ? .2 : 1
  if (emphasis === 'selected') { ctx.shadowColor = 'rgba(150,62,42,.48)'; ctx.shadowBlur = 12 }
  fillMapRings(ctx, feature.rings, projector, style.fill, emphasis === 'selected' ? '#8f3d2c' : style.stroke, 0, emphasis === 'selected' ? 2.8 : 1.6)
  ctx.shadowBlur = 0
  const size = projectedSize(feature, projector)
  if (size.width < 14 || size.height < 9) return
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  if (['soccer', 'football'].includes(feature.sport)) footballMarkings(ctx, feature, projector, style.marking)
  else if (['athletics', 'running'].includes(feature.sport)) athleticsMarkings(ctx, feature, projector, style.marking)
  else if (feature.sport === 'swimming') swimmingMarkings(ctx, feature, projector, style.marking)
  else if (['tennis', 'basketball', 'ice_hockey'].includes(feature.sport)) courtMarkings(ctx, feature, projector, style.marking)
  else courtMarkings(ctx, feature, projector, style.marking)
  ctx.restore()
}
