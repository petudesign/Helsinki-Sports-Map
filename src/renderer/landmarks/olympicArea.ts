import { toLocalMetres } from '../projection'
import type { BuildingFeature, SportFeature } from '../../data/types'
import { editorialTheme as theme, sportStyle } from '../theme'
import { buildingCenter, ellipseRing, frameFromRing, framePoint, pointInRing, rectangleRing, type OrientedFrame } from './geometry'
import { drawMapLabel, drawVolume, fillMapRing, strokeMapLine, type VolumeStyle } from './primitives'
import type { LandmarkRenderContext, LandmarkRenderer } from './types'

const landmarkVolume: VolumeStyle = {
  top: '#ddd4c7', side: '#a99a8d', sideDark: '#8d8075', outline: theme.buildingOutline, shadow: theme.shadow,
}

function named(name: string) {
  return (features: SportFeature[]) => features.filter((feature) => feature.name === name)
}

function largest(features: SportFeature[]) {
  return [...features].sort((a, b) => frameFromRing(b.rings[0]).halfLong * frameFromRing(b.rings[0]).halfShort - frameFromRing(a.rings[0]).halfLong * frameFromRing(a.rings[0]).halfShort)[0]
}

// Containment depends on loaded geometry, never on pan, zoom or projection.
const containment = new WeakMap<BuildingFeature, WeakMap<SportFeature, boolean>>()
function suppressInside(building: BuildingFeature, features: SportFeature[]) {
  let results = containment.get(building)
  if (!results) { results = new WeakMap(); containment.set(building, results) }
  return features.some((feature) => {
    let inside = results.get(feature)
    if (inside === undefined) {
      inside = pointInRing(buildingCenter(building.rings), feature.rings[0])
      results.set(feature, inside)
    }
    return inside
  })
}

function subFrame(frame: OrientedFrame, along: number, across: number, longScale: number, shortScale: number): OrientedFrame {
  return { ...frame, center: framePoint(frame, along, across), halfLong: frame.halfLong * longScale, halfShort: frame.halfShort * shortScale }
}

function drawFootballField(context: LandmarkRenderContext, frame: OrientedFrame, elevation: number) {
  const { ctx, projector } = context; const style = sportStyle('soccer')
  const pitch = rectangleRing(frame, .68, .54)
  fillMapRing(ctx, pitch, projector, style.fill, style.stroke, elevation, 1.15)
  strokeMapLine(ctx, [framePoint(frame, 0, -.54), framePoint(frame, 0, .54)], projector, style.marking, .8, elevation)
  strokeMapLine(ctx, ellipseRing(frame, .075, .13, 24), projector, style.marking, .8, elevation)
}

const olympicStadium: LandmarkRenderer = {
  id: 'olympic-stadium',
  renderPriority: 20,
  selectionHeight: 16,
  select: named('Helsingin olympiastadion'),
  suppressBuilding: suppressInside,
  render(context) {
    const feature = largest(context.features); if (!feature) return
    const { ctx, projector, view } = context; const frame = frameFromRing(feature.rings[0]); const elevation = projector.height(16)
    // The source stadium polygon is the useful footprint here. A scaled ellipse
    // made the landmark visibly larger than the mapped venue it represents.
    drawVolume(ctx, feature.rings[0], 16, projector, view, landmarkVolume)
    fillMapRing(ctx, ellipseRing(frame, .76, .68), projector, sportStyle('athletics').fill, theme.buildingOutline, elevation, .8)
    fillMapRing(ctx, ellipseRing(frame, .57, .45), projector, sportStyle('soccer').fill, undefined, elevation)
    drawFootballField(context, frame, elevation)
    // Track lanes sit above the field, so the pitch no longer visually cuts
    // through the stadium's outer running-track geometry.
    ;[[.9, .84], [.82, .74], [.76, .68]].forEach(([long, short]) => strokeMapLine(ctx, ellipseRing(frame, long, short), projector, 'rgba(73,65,59,.34)', .7, elevation))

    const towerCenter = toLocalMetres([24.92604, 60.18633], [24.93275, 60.1875])
    const podiumFrame = { ...frame, center: towerCenter, halfLong: 8, halfShort: 7 }
    const towerFrame = { ...frame, center: towerCenter, halfLong: 10, halfShort: 7 }
    drawVolume(ctx, rectangleRing(podiumFrame), 8, projector, view, { ...landmarkVolume, top: '#c8b9aa' })
    const towerHeight = 360
    drawVolume(ctx, rectangleRing(towerFrame), towerHeight, projector, view, { ...landmarkVolume, top: '#eee7dc', side: '#a99b8d', sideDark: '#887b70' })
    const towerTop = projector.point(towerCenter); towerTop.y -= projector.height(towerHeight)
    ctx.beginPath(); ctx.moveTo(towerTop.x, towerTop.y); ctx.lineTo(towerTop.x, towerTop.y - (view.mode === 'iso' ? 18 : 7)); ctx.strokeStyle = theme.ink; ctx.lineWidth = 1.3; ctx.stroke()
    ctx.beginPath(); ctx.arc(towerTop.x, towerTop.y - (view.mode === 'iso' ? 18 : 7), 2, 0, Math.PI * 2); ctx.fillStyle = theme.accent; ctx.fill()
    if (view.zoom >= 1.4) drawMapLabel(ctx, frame.center, projector, 'OLYMPIASTADION', elevation + 11)
  },
}

const boltArena: LandmarkRenderer = {
  id: 'bolt-arena',
  renderPriority: 5,
  selectionHeight: 12,
  select: named('Bolt Arena'),
  suppressBuilding: suppressInside,
  render(context) {
    const feature = context.features.find(({ facilityType }) => facilityType === 'stadium') ?? largest(context.features); if (!feature) return
    const { ctx, projector, view } = context; const frame = frameFromRing(feature.rings[0]); const elevation = projector.height(12)
    drawVolume(ctx, rectangleRing(frame, .94, .88), 12, projector, view, { ...landmarkVolume, top: '#d1c7b9' })
    drawFootballField(context, frame, elevation)
    ;[-.77, .77].forEach((across) => fillMapRing(ctx, rectangleRing(subFrame(frame, 0, across, .72, .1)), projector, '#b4a79a', theme.buildingOutline, elevation, .6))
    if (view.zoom >= 1.4) drawMapLabel(ctx, frame.center, projector, 'BOLT ARENA', elevation + 9)
  },
}

const iceHall: LandmarkRenderer = {
  id: 'helsinki-ice-hall',
  renderPriority: 5,
  selectionHeight: 22,
  select: named('Helsingin jäähalli'),
  suppressBuilding: suppressInside,
  render(context) {
    const feature = largest(context.features); if (!feature) return
    const { ctx, projector, view } = context; const frame = frameFromRing(feature.rings[0]); const elevation = projector.height(22)
    drawVolume(ctx, rectangleRing(frame, .92, .86), 22, projector, view, { ...landmarkVolume, top: '#d8d7d0' })
    ;[-.38, 0, .38].forEach((across) => strokeMapLine(ctx, [framePoint(frame, -.78, across), framePoint(frame, .78, across)], projector, 'rgba(69,76,74,.26)', .9, elevation))
    if (view.zoom >= 1.4) drawMapLabel(ctx, frame.center, projector, 'HELSINGIN JÄÄHALLI', elevation + 9)
  },
}

const swimmingStadium: LandmarkRenderer = {
  id: 'swimming-stadium',
  renderPriority: 5,
  selectionHeight: 4,
  select: named('Uimastadion'),
  suppressBuilding: suppressInside,
  render(context) {
    const feature = context.features.find(({ facilityType }) => facilityType === 'sports_centre') ?? largest(context.features); if (!feature) return
    const { ctx, projector, view } = context; const frame = frameFromRing(feature.rings[0]); const elevation = projector.height(4)
    drawVolume(ctx, rectangleRing(frame, .9, .82), 4, projector, view, { ...landmarkVolume, top: '#aeba9a' })
    const pools = [subFrame(frame, -.1, -.2, .55, .19), subFrame(frame, .1, .33, .36, .13)]
    pools.forEach((pool) => {
      fillMapRing(ctx, rectangleRing(pool), projector, theme.water, theme.waterLine, elevation, .9)
      ;[-.5, -.25, 0, .25, .5].forEach((across) => strokeMapLine(ctx, [framePoint(pool, -.88, across), framePoint(pool, .88, across)], projector, 'rgba(241,239,228,.72)', .55, elevation))
    })
    fillMapRing(ctx, ellipseRing(subFrame(frame, .52, -.4, .16, .16), 1, 1, 28), projector, theme.water, theme.waterLine, elevation, .8)
    if (view.zoom >= 1.4) drawMapLabel(ctx, frame.center, projector, 'UIMASTADION', elevation + 9)
  },
}

export const olympicAreaLandmarks: LandmarkRenderer[] = [olympicStadium, boltArena, iceHall, swimmingStadium]
