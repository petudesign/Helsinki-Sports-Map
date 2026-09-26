import type { Bounds, MapDataset, MapPoint, RouteFeature } from '../data/types'
import type { Projector } from './projection'
import type { LandmarkRenderer } from './landmarks/types'
import { editorialTheme as theme } from './theme'

type Shape = { path: Path2D; bounds: Bounds }
type Batch = Shape & { members: Bounds[] }
type Prepared = {
  surfaces: { shape: Shape; kind: MapDataset['surfaces'][number]['kind']; context: boolean }[]
  routes: { shape: Shape; kind: RouteFeature['kind']; context: boolean }[]
  buildings: { shape: Shape; context: boolean }[]
}
const cache = new WeakMap<MapDataset, Map<LandmarkRenderer[], Prepared>>()

function makeShape(rings: MapPoint[][], closed: boolean): Shape {
  const path = new Path2D()
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  for (const ring of rings) {
    ring.forEach(({ x, y }, index) => {
      if (index) path.lineTo(x, y); else path.moveTo(x, y)
      bounds.minX = Math.min(bounds.minX, x); bounds.maxX = Math.max(bounds.maxX, x)
      bounds.minY = Math.min(bounds.minY, y); bounds.maxY = Math.max(bounds.maxY, y)
    })
    if (closed && ring.length) path.closePath()
  }
  return { path, bounds }
}

// Small spatial batches bound offscreen work and reduce Canvas draw calls.
// A feature belongs to one batch; full bounds prevent clipping long roads.
function addBatch(batches: Map<string, Batch>, kind: string, shape: Shape, separateOverlaps = false) {
  const b = shape.bounds
  const cell = `${kind}:${Math.floor((b.minX + b.maxX) / 1000)}:${Math.floor((b.minY + b.maxY) / 1000)}`
  let key = cell, existing = batches.get(key), index = 0
  // Preserve even-odd holes and alpha compositing for overlapping polygons.
  while (separateOverlaps && existing?.members.some(a => a.maxX + 40 >= b.minX && a.minX - 40 <= b.maxX && a.maxY + 40 >= b.minY && a.minY - 40 <= b.maxY)) {
    key = `${cell}:${++index}`; existing = batches.get(key)
  }
  if (!existing) { batches.set(key, { ...shape, members: [b] }); return }
  existing.path.addPath(shape.path)
  existing.members.push(b)
  existing.bounds = {
    minX: Math.min(existing.bounds.minX, b.minX), minY: Math.min(existing.bounds.minY, b.minY),
    maxX: Math.max(existing.bounds.maxX, b.maxX), maxY: Math.max(existing.bounds.maxY, b.maxY),
  }
}

function prepare(area: MapDataset, renderers: LandmarkRenderer[]) {
  let variants = cache.get(area)
  if (!variants) { variants = new Map(); cache.set(area, variants) }
  const existing = variants.get(renderers)
  if (existing) return existing
  const landmarks = renderers.map(renderer => ({ renderer, features: renderer.select(area.osmSports ?? area.sports) }))
  const buildings = new Map<string, Batch>()
  for (const building of area.buildings) {
    if (!landmarks.some(({ renderer, features }) => features.length && renderer.suppressBuilding?.(building, features))) {
      addBatch(buildings, `${building.context ? 'context' : 'helsinki'}:building`, makeShape(building.rings, true), true)
    }
  }
  const routes = new Map<string, Batch>()
  for (const route of area.routes) addBatch(routes, `${route.context ? 'context' : 'helsinki'}:${route.kind}`, makeShape([route.points], false))
  const surfaces = new Map<string, Batch>()
  for (const surface of area.surfaces) addBatch(surfaces, `${surface.context ? 'context' : 'helsinki'}:${surface.kind}`, makeShape(surface.rings, true), true)
  const result: Prepared = {
    surfaces: [...surfaces].map(([key, shape]) => ({ context: key.startsWith('context:'), kind: key.split(':')[1] as MapDataset['surfaces'][number]['kind'], shape })),
    routes: [...routes].map(([key, shape]) => ({ context: key.startsWith('context:'), kind: key.split(':')[1] as RouteFeature['kind'], shape })),
    buildings: [...buildings].map(([key, shape]) => ({ context: key.startsWith('context:'), shape })),
  }
  variants.set(renderers, result)
  return result
}

export function drawVectorBackground(ctx: CanvasRenderingContext2D, area: MapDataset, renderers: LandmarkRenderer[], projector: Projector, width: number, height: number, selected: boolean) {
  const prepared = prepare(area, renderers)
  const origin = projector.point({ x: 0, y: 0 })
  const scale = projector.scale
  const left = (-160 - origin.x) / scale, right = (width + 160 - origin.x) / scale
  const bottom = (origin.y - height - 160) / scale, top = (origin.y + 160) / scale
  const visible = ({ bounds: b }: Shape) => b.maxX >= left && b.minX <= right && b.maxY >= bottom && b.minY <= top
  ctx.save()
  ctx.translate(origin.x, origin.y)
  ctx.scale(scale, -scale)
  // The context transforms vectors directly; widths and dashes stay in screen pixels.
  for (const kind of ['water', 'urban', 'green'] as const) {
    ctx.globalAlpha = kind === 'water' ? selected ? .6 : 1 : selected ? .52 : .82
    ctx.lineWidth = (kind === 'water' ? 1 : kind === 'urban' ? .45 : .55) / scale
    for (const feature of prepared.surfaces) {
      if (feature.kind !== kind || !visible(feature.shape)) continue
      ctx.fillStyle = feature.context ? kind === 'water' ? theme.contextWater : kind === 'urban' ? theme.contextUrban : theme.contextGreen : kind === 'water' ? theme.water : kind === 'urban' ? theme.urban : theme.green
      ctx.strokeStyle = feature.context ? kind === 'water' ? theme.contextWaterLine : kind === 'urban' ? theme.contextUrbanEdge : theme.contextGreenEdge : kind === 'water' ? theme.waterLine : kind === 'urban' ? theme.urbanEdge : theme.greenEdge
      ctx.fill(feature.shape.path, 'evenodd'); ctx.stroke(feature.shape.path)
    }
  }
  ctx.globalAlpha = selected ? .34 : .58
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  for (const { shape, kind, context } of prepared.routes) {
    if (!visible(shape)) continue
    const stroke = (color: string, width: number, dash: number[] = []) => {
      ctx.strokeStyle = color; ctx.lineWidth = width / scale
      ctx.setLineDash(dash.map(value => value / scale)); ctx.stroke(shape.path)
    }
    if (kind === 'rail') { stroke(context ? theme.contextRail : theme.rail, 2.2); stroke(context ? theme.contextRailTie : theme.railTie, .8, [1, 7]) }
    else if (kind === 'waterline') stroke(context ? theme.contextWaterline : theme.waterline, 2, [7, 5])
    else if (kind === 'path') stroke(context ? theme.contextPath : theme.path, .8, [3, 4])
    else {
      const widths = kind === 'major' ? [6.5, 4.4] : kind === 'street' ? [4.5, 2.8] : [2.8, 1.5]
      stroke(context ? theme.contextRoadEdge : theme.roadEdge, widths[0]); stroke(context ? theme.contextRoad : theme.road, widths[1])
    }
  }
  ctx.setLineDash([])
  ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'
  ctx.globalAlpha = selected ? .28 : .52
  for (const { shape, context } of prepared.buildings) {
    if (!visible(shape)) continue
    ctx.fillStyle = context ? theme.contextBuildingTop : theme.buildingTop; ctx.strokeStyle = context ? theme.contextBuildingOutline : theme.buildingOutline; ctx.lineWidth = .7 / scale
    ctx.fill(shape.path, 'evenodd'); ctx.stroke(shape.path)
  }
  ctx.restore()
}
