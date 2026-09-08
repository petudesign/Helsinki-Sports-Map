import type { BuildingFeature, MapDataset, MapPoint, SportFeature } from '../data/types'
import { createProjector, type ScreenPoint, type View } from './projection'
import type { LandmarkRenderer } from './landmarks/types'
import { drawSport } from './sportRenderer'
import { editorialTheme as theme } from './theme'

function traceRing(ctx: CanvasRenderingContext2D, points: ScreenPoint[]) {
  points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y))
  ctx.closePath()
}

function traceRings(ctx: CanvasRenderingContext2D, rings: ScreenPoint[][]) {
  ctx.beginPath()
  rings.forEach((ring) => traceRing(ctx, ring))
}

function strokeLine(ctx: CanvasRenderingContext2D, points: ScreenPoint[]) {
  ctx.beginPath()
  points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y))
  ctx.stroke()
}

function centroid(points: ScreenPoint[]) {
  return points.reduce((result, point) => ({ x: result.x + point.x / points.length, y: result.y + point.y / points.length }), { x: 0, y: 0 })
}

function pointInScreenRing(point: ScreenPoint, ring: ScreenPoint[]) {
  let inside = false
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const a = ring[index]; const b = ring[previous]
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

function ringArea(ring: ScreenPoint[]) {
  return Math.abs(ring.reduce((area, point, index) => {
    const next = ring[(index + 1) % ring.length]
    return area + point.x * next.y - next.x * point.y
  }, 0) / 2)
}

function drawBuilding(ctx: CanvasRenderingContext2D, building: BuildingFeature, bottomRings: ScreenPoint[][], elevation: number, view: View) {
  const bottom = bottomRings[0]; if (!bottom?.length) return
  if (view.mode === '2d') { traceRings(ctx, bottomRings); ctx.fillStyle = theme.buildingTop; ctx.fill('evenodd'); ctx.strokeStyle = theme.buildingOutline; ctx.lineWidth = .7; ctx.stroke(); return }
  const top = bottom.map((point) => ({ x: point.x, y: point.y - elevation }))
  ctx.save(); ctx.translate(10 * view.zoom, 12 * view.zoom); ctx.beginPath(); traceRing(ctx, bottom); ctx.fillStyle = theme.shadow; ctx.fill(); ctx.restore()
  for (let index = 0; index < bottom.length - 1; index++) {
    const next = index + 1
    const dx = bottom[next].x - bottom[index].x
    ctx.beginPath(); traceRing(ctx, [bottom[index], bottom[next], top[next], top[index]])
    ctx.fillStyle = dx > 0 ? theme.buildingSide : theme.buildingSideDark; ctx.fill(); ctx.strokeStyle = theme.buildingOutline; ctx.lineWidth = .55; ctx.stroke()
  }
  ctx.beginPath(); traceRing(ctx, top); ctx.fillStyle = theme.buildingTop; ctx.fill(); ctx.strokeStyle = theme.buildingOutline; ctx.lineWidth = .8; ctx.stroke()
}

function drawTree(ctx: CanvasRenderingContext2D, point: ScreenPoint, index: number, view: View) {
  const size = (index % 3 === 0 ? 5.5 : 4.5) * Math.min(view.zoom, 1.35)
  ctx.beginPath(); ctx.ellipse(point.x + 3, point.y + 4, size * 1.2, size * .38, 0, 0, Math.PI * 2); ctx.fillStyle = theme.shadow; ctx.fill()
  if (view.mode === 'iso') { ctx.fillStyle = '#776b5f'; ctx.fillRect(point.x - .7, point.y - size, 1.4, size) }
  ctx.beginPath(); ctx.ellipse(point.x, point.y - size * .7, size, size * .8, 0, 0, Math.PI * 2); ctx.fillStyle = index % 2 ? theme.tree : theme.treeLight; ctx.fill()
}

export type MapVisualState = {
  visibleSportIds?: ReadonlySet<string>
  selectedSportIds?: ReadonlySet<string>
}

export function pickSportFeature(canvas: HTMLCanvasElement, area: MapDataset, view: View, point: ScreenPoint, landmarkRenderers: LandmarkRenderer[] = [], visibleSportIds?: ReadonlySet<string>) {
  const rect = canvas.getBoundingClientRect()
  const projector = createProjector(area, rect.width, rect.height, view)
  const candidates = area.sports.filter(({ id }) => !visibleSportIds || visibleSportIds.has(id)).flatMap((feature) => {
    const landmark = landmarkRenderers.find((renderer) => renderer.select([feature]).length)
    const elevation = projector.height(landmark?.selectionHeight ?? 0)
    const rings = feature.rings.map((ring) => ring.map((mapPoint) => { const screen = projector.point(mapPoint); return { x: screen.x, y: screen.y - elevation } }))
    const hit = pointInScreenRing(point, rings[0]) && rings.slice(1).every((ring) => !pointInScreenRing(point, ring))
    return hit ? [{ feature, area: ringArea(rings[0]) }] : []
  })
  return candidates.sort((a, b) => a.area - b.area)[0]?.feature
}

export function renderMap(canvas: HTMLCanvasElement, area: MapDataset, view: View, landmarkRenderers: LandmarkRenderer[] = [], visualState: MapVisualState = {}) {
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  const targetWidth = Math.round(rect.width * dpr)
  const targetHeight = Math.round(rect.height * dpr)
  if (canvas.width !== targetWidth) canvas.width = targetWidth
  if (canvas.height !== targetHeight) canvas.height = targetHeight
  const ctx = canvas.getContext('2d')!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const { width, height } = rect
  const projector = createProjector(area, width, height, view)
  const projectRing = (ring: MapPoint[]) => ring.map(projector.point)
  const visibleSports = area.sports.filter(({ id }) => !visualState.visibleSportIds || visualState.visibleSportIds.has(id))
  const selectedIds = visualState.selectedSportIds ?? new Set<string>()
  const hasSelection = selectedIds.size > 0

  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = theme.ground; ctx.fillRect(0, 0, width, height)
  ctx.save(); ctx.globalAlpha = .065; ctx.strokeStyle = theme.grain; ctx.lineWidth = 1
  for (let x = -height; x < width + height; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + height, height); ctx.stroke() }
  ctx.restore()

  ctx.save(); ctx.globalAlpha = hasSelection ? .48 : .78
  area.surfaces.filter((feature) => feature.kind === 'water').forEach((feature) => { const rings = feature.rings.map(projectRing); traceRings(ctx, rings); ctx.fillStyle = theme.water; ctx.fill('evenodd'); ctx.strokeStyle = theme.waterLine; ctx.lineWidth = .8; ctx.stroke() })
  area.surfaces.filter((feature) => feature.kind === 'green').forEach((feature) => { const rings = feature.rings.map(projectRing); traceRings(ctx, rings); ctx.fillStyle = theme.green; ctx.fill('evenodd'); ctx.strokeStyle = theme.greenEdge; ctx.lineWidth = .55; ctx.stroke() })
  ctx.restore()
  const landmarks = landmarkRenderers
    .map((renderer) => ({ renderer, features: renderer.select(visibleSports) }))
    .filter(({ features }) => features.length)
  const landmarkFeatureIds = new Set(landmarks.flatMap(({ features }) => features.map(({ id }) => id)))

  ctx.save(); ctx.globalAlpha = hasSelection ? .34 : view.mode === '2d' ? .58 : .72
  area.routes.forEach((route) => {
    const points = route.points.map(projector.point); ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    if (route.kind === 'path') { ctx.strokeStyle = theme.path; ctx.lineWidth = .8; ctx.setLineDash([3, 4]); strokeLine(ctx, points); ctx.setLineDash([]); return }
    const widthByKind = route.kind === 'major' ? [6.5, 4.4] : route.kind === 'street' ? [4.5, 2.8] : [2.8, 1.5]
    ctx.strokeStyle = theme.roadEdge; ctx.lineWidth = widthByKind[0]; strokeLine(ctx, points); ctx.strokeStyle = theme.road; ctx.lineWidth = widthByKind[1]; strokeLine(ctx, points)
  })
  ctx.restore()

  ctx.save(); ctx.globalAlpha = hasSelection ? .3 : view.mode === '2d' ? .48 : .68
  const buildings = area.buildings
    .filter((building) => !landmarks.some(({ renderer, features }) => renderer.suppressBuilding?.(building, features)))
    .map((building) => ({ building, rings: building.rings.map(projectRing) }))
    .sort((a, b) => centroid(a.rings[0]).y - centroid(b.rings[0]).y)
  buildings.forEach(({ building, rings }) => drawBuilding(ctx, building, rings, projector.height(building.height), view))
  ctx.restore()

  ctx.save(); ctx.globalAlpha = hasSelection ? .35 : .64
  area.trees.map(projector.point).sort((a, b) => a.y - b.y).forEach((point, index) => drawTree(ctx, point, index, view))
  ctx.restore()

  visibleSports.filter(({ id }) => !landmarkFeatureIds.has(id)).forEach((feature) => drawSport(ctx, feature, projector, hasSelection ? selectedIds.has(feature.id) ? 'selected' : 'dimmed' : 'default'))
  landmarks.forEach(({ renderer, features }) => {
    const selected = features.some(({ id }) => selectedIds.has(id))
    ctx.save(); ctx.globalAlpha = hasSelection && !selected ? .2 : 1
    renderer.render({ ctx, area, features, projector, view }); ctx.restore()
  })

  if (hasSelection) {
    const landmarkHeights = new Map(landmarks.flatMap(({ renderer, features }) => features.map(({ id }) => [id, renderer.selectionHeight ?? 0] as const)))
    visibleSports.filter(({ id }) => selectedIds.has(id)).forEach((feature) => {
      const elevation = projector.height(landmarkHeights.get(feature.id) ?? 0)
      const rings = feature.rings.map((ring) => ring.map((mapPoint) => { const point = projector.point(mapPoint); return { x: point.x, y: point.y - elevation } }))
      ctx.save(); ctx.shadowColor = 'rgba(150,62,42,.68)'; ctx.shadowBlur = 13; traceRings(ctx, rings); ctx.fillStyle = 'rgba(196,95,70,.12)'; ctx.fill('evenodd'); ctx.strokeStyle = '#903d2c'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore()
    })
  }
}
