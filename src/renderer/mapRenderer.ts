import { drawVectorBackground } from './vectorBackground'
import type { Bounds, BuildingFeature, MapDataset, MapPoint, MapLabel, SportFeature } from '../data/types'
import { createProjector, toLocalMetres, type ScreenPoint, type View } from './projection'
import type { LandmarkRenderer } from './landmarks/types'
import { drawSport, drawVenueMarker } from './sportRenderer'
import { editorialTheme as theme } from './theme'
import type { TrendingSignal } from '../data/trending'
import type { RouteResult } from '../routing'

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

function projectedBounds(bounds: Bounds, projector: ReturnType<typeof createProjector>) {
  return [
    projector.point({ x: bounds.minX, y: bounds.minY }),
    projector.point({ x: bounds.minX, y: bounds.maxY }),
    projector.point({ x: bounds.maxX, y: bounds.minY }),
    projector.point({ x: bounds.maxX, y: bounds.maxY }),
  ]
}

function isBoundsVisible(bounds: Bounds | undefined, projector: ReturnType<typeof createProjector>, width: number, height: number, margin = 160) {
  if (!bounds) return true
  const points = projectedBounds(bounds, projector)
  const minX = Math.min(...points.map(({ x }) => x)); const maxX = Math.max(...points.map(({ x }) => x))
  const minY = Math.min(...points.map(({ y }) => y)); const maxY = Math.max(...points.map(({ y }) => y))
  return maxX >= -margin && minX <= width + margin && maxY >= -margin && minY <= height + margin
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

function drawMapLabels(ctx: CanvasRenderingContext2D, labels: MapLabel[], projector: ReturnType<typeof createProjector>, area: MapDataset, visibleSports: SportFeature[], width: number, height: number, hasSelection: boolean, view: View) {
  if (!labels.length) return
  ctx.save()
  ctx.globalAlpha = hasSelection ? .62 : .92
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle';
  ([...labels])
    .filter((label) => view.zoom >= (label.minZoom ?? 0))
    .sort((a, b) => (a.tone === 'secondary' ? 1 : 0) - (b.tone === 'secondary' ? 1 : 0))
    .forEach((label) => {
    const secondary = label.tone === 'secondary'
    ctx.font = secondary ? '600 7px DM Mono, monospace' : '600 9px DM Mono, monospace'
    const anchor = projector.point(toLocalMetres(label.coordinates, area.center))
    if (anchor.x < -100 || anchor.x > width + 100 || anchor.y < -60 || anchor.y > height + 60) return
    const textWidth = ctx.measureText(label.text).width
    const baseBox = { width: textWidth + (secondary ? 8 : 10), height: secondary ? 15 : 18 }
    const offset = label.offset ?? { x: 0, y: 0 }
    const box = { x: anchor.x + offset.x - baseBox.width / 2, y: anchor.y + offset.y - baseBox.height / 2, ...baseBox }
    if (box.x < 4 || box.x + box.width > width - 4 || box.y < 4 || box.y + box.height > height - 4) return
    if (offset.x || offset.y) { ctx.strokeStyle = 'rgba(117,109,101,.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(anchor.x, anchor.y); ctx.lineTo(anchor.x + offset.x, anchor.y + offset.y); ctx.stroke() }
    ctx.fillStyle = secondary ? 'rgba(242,238,230,.72)' : 'rgba(242,238,230,.9)'; ctx.fillRect(box.x, box.y, box.width, box.height)
    ctx.strokeStyle = secondary ? 'rgba(117,109,101,.22)' : 'rgba(117,109,101,.35)'; ctx.lineWidth = .6; ctx.strokeRect(box.x, box.y, box.width, box.height)
    ctx.fillStyle = secondary ? '#747b82' : '#5c6670'; ctx.fillText(label.text, anchor.x + offset.x, anchor.y + offset.y)
  })
  ctx.restore()
}

export type MapVisualState = {
  visibleSportIds?: ReadonlySet<string>
  selectedSportIds?: ReadonlySet<string>
  trendingEnabled?: boolean
  trendingSignals?: ReadonlyMap<string, TrendingSignal>
}

export type BackgroundFrame = { bitmap: ImageBitmap; origin: ScreenPoint; scale: number; width: number; height: number; padding: number; mode: View['mode']; zoom: number; view: View; fallback?: BackgroundFrame }
type MapRenderOptions = {
  mapLabels?: MapLabel[]
  route?: RouteResult
  background?: BackgroundFrame | null
  backgroundOnly?: boolean
  size?: { width: number; height: number; dpr: number; padding: number }
}

type MarkerCluster = { features: SportFeature[]; point: ScreenPoint; mapPoint: MapPoint }

function featureScreenCenter(feature: SportFeature, projector: ReturnType<typeof createProjector>) {
  return centroid(feature.rings[0].map(projector.point))
}

function featureMapCenter(feature: SportFeature) {
  return centroid(feature.rings[0])
}

function createMarkerClusters(features: SportFeature[], projector: ReturnType<typeof createProjector>, view: View, selectedIds: ReadonlySet<string> = new Set()) {
  // Keep the marker layer readable at overview zoom without an O(n²) search.
  const radius = view.zoom < 1.35 ? 28 : view.zoom < 2.2 ? 20 : 0
  const clusters: MarkerCluster[] = []
  const grid = new Map<string, MarkerCluster[]>()
  // Index in map space, not screen space. A screen-space grid changes cluster
  // membership whenever a pan crosses a cell boundary, which makes clusters
  // appear to wobble even though all venues moved by the same amount.
  const mapRadius = radius ? radius / Math.max(projector.scale, 0.0001) : 1
  const cell = Math.max(mapRadius, 1)
  const keyFor = (point: MapPoint) => `${Math.floor(point.x / cell)}:${Math.floor(point.y / cell)}`

  features.forEach((feature) => {
    const mapPoint = featureMapCenter(feature)
    const point = featureScreenCenter(feature, projector)
    if (!radius || selectedIds.has(feature.id)) { clusters.push({ features: [feature], point, mapPoint }); return }
    const [column, row] = keyFor(mapPoint).split(':').map(Number)
    let target: MarkerCluster | undefined
    for (let y = row - 1; y <= row + 1 && !target; y++) for (let x = column - 1; x <= column + 1 && !target; x++) {
      target = (grid.get(`${x}:${y}`) ?? []).find((candidate) => Math.hypot(candidate.mapPoint.x - mapPoint.x, candidate.mapPoint.y - mapPoint.y) <= mapRadius)
    }
    if (!target) {
      target = { features: [feature], point, mapPoint }
      clusters.push(target)
      const gridKey = keyFor(mapPoint)
      grid.set(gridKey, [...(grid.get(gridKey) ?? []), target])
      return
    }
    target.features.push(feature)
    target.mapPoint = {
      x: target.mapPoint.x + (mapPoint.x - target.mapPoint.x) / target.features.length,
      y: target.mapPoint.y + (mapPoint.y - target.mapPoint.y) / target.features.length,
    }
    target.point = {
      x: target.point.x + (point.x - target.point.x) / target.features.length,
      y: target.point.y + (point.y - target.point.y) / target.features.length,
    }
  })
  return clusters
}

function drawMarkerCluster(ctx: CanvasRenderingContext2D, cluster: MarkerCluster, emphasis: 'default' | 'dimmed' = 'default') {
  const count = cluster.features.length
  const radius = Math.min(20, 10 + Math.log10(count) * 4)
  ctx.save(); ctx.globalAlpha = emphasis === 'dimmed' ? .5 : 1
  ctx.beginPath(); ctx.arc(cluster.point.x, cluster.point.y, radius + 3, 0, Math.PI * 2); ctx.fillStyle = 'rgba(23,107,123,.14)'; ctx.fill()
  ctx.beginPath(); ctx.arc(cluster.point.x, cluster.point.y, radius, 0, Math.PI * 2); ctx.fillStyle = '#176b7b'; ctx.fill(); ctx.strokeStyle = '#fffdf9'; ctx.lineWidth = 2; ctx.stroke()
  ctx.fillStyle = '#fffdf9'; ctx.font = '700 10px Manrope, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(count), cluster.point.x, cluster.point.y)
  ctx.restore()
}

export type MapPick = { feature: SportFeature; cluster: boolean }

export function pickMapTarget(canvas: HTMLCanvasElement, area: MapDataset, view: View, point: ScreenPoint, landmarkRenderers: LandmarkRenderer[] = [], visibleSportIds?: ReadonlySet<string>): MapPick | undefined {
  const rect = canvas.getBoundingClientRect()
  const projector = createProjector(area, rect.width, rect.height, view)
  const markerFeatures = area.sports.filter((feature) => Boolean(feature.icon) && (!visibleSportIds || visibleSportIds.has(feature.id)))
  const markerCluster = createMarkerClusters(markerFeatures, projector, view).find((cluster) => cluster.features.length > 1 && Math.hypot(point.x - cluster.point.x, point.y - cluster.point.y) <= 26)
  if (markerCluster) return { feature: markerCluster.features[0], cluster: true }
  const candidates = area.sports.filter(({ id, bounds }) => (!visibleSportIds || visibleSportIds.has(id)) && isBoundsVisible(bounds, projector, rect.width, rect.height, 0)).flatMap((feature) => {
    const landmark = landmarkRenderers.find((renderer) => renderer.select([feature]).length)
    const elevation = projector.height(landmark?.selectionHeight ?? 0)
    const rings = feature.rings.map((ring) => ring.map((mapPoint) => { const screen = projector.point(mapPoint); return { x: screen.x, y: screen.y - elevation } }))
    const center = centroid(rings[0])
    const markerHit = Boolean(feature.icon) && Math.hypot(point.x - center.x, point.y - center.y) <= 24
    const hit = markerHit || (pointInScreenRing(point, rings[0]) && rings.slice(1).every((ring) => !pointInScreenRing(point, ring)))
    return hit ? [{ feature, area: ringArea(rings[0]) }] : []
  })
  const feature = candidates.sort((a, b) => a.area - b.area)[0]?.feature
  return feature ? { feature, cluster: false } : undefined
}

export function pickSportFeature(canvas: HTMLCanvasElement, area: MapDataset, view: View, point: ScreenPoint, landmarkRenderers: LandmarkRenderer[] = [], visibleSportIds?: ReadonlySet<string>) {
  return pickMapTarget(canvas, area, view, point, landmarkRenderers, visibleSportIds)?.feature
}

export function renderMap(canvas: HTMLCanvasElement | OffscreenCanvas, area: MapDataset, view: View, landmarkRenderers: LandmarkRenderer[] = [], visualState: MapVisualState = {}, options: MapRenderOptions = {}) {
  const dpr = options.size?.dpr ?? (window.devicePixelRatio || 1)
  const rect = options.size ?? (canvas as HTMLCanvasElement).getBoundingClientRect()
  const padding = options.size?.padding ?? 0
  const targetWidth = Math.round((rect.width + padding * 2) * dpr)
  const targetHeight = Math.round((rect.height + padding * 2) * dpr)
  if (canvas.width !== targetWidth) canvas.width = targetWidth
  if (canvas.height !== targetHeight) canvas.height = targetHeight
  const { width, height } = rect
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  ctx.setTransform(dpr, 0, 0, dpr, padding * dpr, padding * dpr)
  const projector = createProjector(area, width, height, view)
  const projectRing = (ring: MapPoint[]) => ring.map(projector.point)
  const visibleSports = area.sports.filter(({ id, bounds }) => (!visualState.visibleSportIds || visualState.visibleSportIds.has(id)) && isBoundsVisible(bounds, projector, width, height))
  const selectedIds = visualState.selectedSportIds ?? new Set<string>()
  const hasSelection = selectedIds.size > 0

  ctx.clearRect(-padding, -padding, width + padding * 2, height + padding * 2)
  ctx.fillStyle = theme.ground; ctx.fillRect(-padding, -padding, width + padding * 2, height + padding * 2)
  ctx.save(); ctx.globalAlpha = .065; ctx.strokeStyle = theme.grain; ctx.lineWidth = 1
  for (let x = -height; x < width + height; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + height, height); ctx.stroke() }
  ctx.restore()

  const landmarkSource = area.osmSports ?? area.sports
  const landmarks = landmarkRenderers
    .map((renderer) => ({ renderer, features: renderer.select(landmarkSource.filter(({ bounds }) => isBoundsVisible(bounds, projector, width, height, 160 + padding))) }))
    .filter(({ features }) => features.length)
    .sort((a, b) => (a.renderer.renderPriority ?? 0) - (b.renderer.renderPriority ?? 0))
  const landmarkFeatureIds = new Set(landmarks.flatMap(({ features }) => features.map(({ id }) => id)))
  if (options.background !== undefined) {
    const background = options.background
    const layers = background ? [background.fallback, background] : []
    for (const layer of layers) {
      if (!layer || layer.mode !== view.mode) continue
      const ratio = projector.scale / layer.scale
      const origin = projector.point({ x: 0, y: 0 })
      ctx.drawImage(layer.bitmap,
        origin.x - (layer.origin.x + layer.padding) * ratio,
        origin.y - (layer.origin.y + layer.padding) * ratio,
        (layer.width + layer.padding * 2) * ratio,
        (layer.height + layer.padding * 2) * ratio)
    }
  } else {
  if (view.mode === '2d') {
    drawVectorBackground(ctx, area, landmarkRenderers, projector, width, height, hasSelection)
  } else {
  ctx.save(); ctx.globalAlpha = hasSelection ? .6 : 1
  area.surfaces.filter((feature) => feature.kind === 'water' && isBoundsVisible(feature.bounds, projector, width, height)).forEach((feature) => { traceRings(ctx, feature.rings.map(projectRing)); ctx.fillStyle = theme.water; ctx.fill('evenodd'); ctx.strokeStyle = theme.waterLine; ctx.lineWidth = 1; ctx.stroke() })
  ctx.globalAlpha = hasSelection ? .52 : .82
  area.surfaces.filter((feature) => feature.kind === 'urban' && isBoundsVisible(feature.bounds, projector, width, height)).forEach((feature) => { traceRings(ctx, feature.rings.map(projectRing)); ctx.fillStyle = theme.urban; ctx.fill('evenodd'); ctx.strokeStyle = theme.urbanEdge; ctx.lineWidth = .45; ctx.stroke() })
  area.surfaces.filter((feature) => feature.kind === 'green' && isBoundsVisible(feature.bounds, projector, width, height)).forEach((feature) => { traceRings(ctx, feature.rings.map(projectRing)); ctx.fillStyle = theme.green; ctx.fill('evenodd'); ctx.strokeStyle = theme.greenEdge; ctx.lineWidth = .55; ctx.stroke() })
  ctx.restore()

  ctx.save(); ctx.globalAlpha = hasSelection ? .34 : .72
  area.routes.filter((route) => isBoundsVisible(route.bounds, projector, width, height)).forEach((route) => {
    const points = route.points.map(projector.point)
    const stroke = () => strokeLine(ctx, points)
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    if (route.kind === 'rail') { ctx.strokeStyle = theme.rail; ctx.lineWidth = 2.8; stroke(); ctx.strokeStyle = theme.railTie; ctx.lineWidth = .8; ctx.setLineDash([1, 7]); stroke(); ctx.setLineDash([]); return }
    if (route.kind === 'waterline') { ctx.strokeStyle = theme.waterline; ctx.lineWidth = 2; ctx.setLineDash([7, 5]); stroke(); ctx.setLineDash([]); return }
    if (route.kind === 'path') { ctx.strokeStyle = theme.path; ctx.lineWidth = .8; ctx.setLineDash([3, 4]); stroke(); ctx.setLineDash([]); return }
    const widthByKind = route.kind === 'major' ? [6.5, 4.4] : route.kind === 'street' ? [4.5, 2.8] : [2.8, 1.5]
    ctx.strokeStyle = theme.roadEdge; ctx.lineWidth = widthByKind[0]; stroke(); ctx.strokeStyle = theme.road; ctx.lineWidth = widthByKind[1]; stroke()
  })
  ctx.restore()

  ctx.save(); ctx.globalAlpha = hasSelection ? .28 : .62
  const buildings = area.buildings
    .filter((building) => isBoundsVisible(building.bounds, projector, width, height) && !landmarks.some(({ renderer, features }) => renderer.suppressBuilding?.(building, features)))
    .map((building) => {
      const rings = building.rings.map(projectRing)
      return { building, rings, depth: view.mode === 'iso' ? centroid(rings[0]).y : 0 }
    })
  if (view.mode === 'iso') buildings.sort((a, b) => a.depth - b.depth)
  buildings.forEach(({ building, rings }) => drawBuilding(ctx, building, rings, projector.height(building.height), view))
  ctx.restore()

  }
  ctx.save(); ctx.globalAlpha = hasSelection ? .35 : .64
  area.trees.map(projector.point).sort((a, b) => a.y - b.y).forEach((point, index) => drawTree(ctx, point, index, view))
  ctx.restore()

  landmarks.forEach(({ renderer, features }) => {
    const selected = features.some(({ id }) => selectedIds.has(id))
    ctx.save(); ctx.globalAlpha = hasSelection && !selected ? .52 : 1
    renderer.render({ ctx, area, features, projector, view }); ctx.restore()
  })
  }
  if (options.backgroundOnly) return
  drawMapLabels(ctx, options.mapLabels ?? [], projector, area, visibleSports, width, height, hasSelection, view)
  // LIPAS venue markers are interactive points, so keep them above landmark art.
  const markerClusters = createMarkerClusters(visibleSports.filter(({ id, icon }) => Boolean(icon) && !landmarkFeatureIds.has(id)), projector, view, selectedIds)
  markerClusters.forEach((cluster) => {
    if (cluster.features.length > 1) {
      drawMarkerCluster(ctx, cluster, hasSelection ? 'dimmed' : 'default')
      return
    }
    const feature = cluster.features[0]
    drawVenueMarker(ctx, feature, projector, hasSelection ? selectedIds.has(feature.id) ? 'selected' : 'dimmed' : 'default')
  })
  visibleSports.filter(({ id, icon }) => !icon && !landmarkFeatureIds.has(id)).forEach((feature) => drawSport(ctx, feature, projector, hasSelection ? selectedIds.has(feature.id) ? 'selected' : 'dimmed' : 'default'))

  if (visualState.trendingEnabled) {
    const trending = visibleSports
      .map((feature) => ({ feature, signal: visualState.trendingSignals?.get(feature.id) }))
      .filter((item): item is { feature: SportFeature; signal: TrendingSignal } => Boolean(item.signal))
      .sort((a, b) => b.signal.interestScore - a.signal.interestScore)
      .slice(0, 8)
    trending.forEach(({ feature, signal }) => {
      const point = centroid(feature.rings[0].map(projector.point))
      const radius = 6 + (signal.interestScore - 46) * .11
      const color = signal.stage === 'new' ? '#4b8fa3' : signal.stage === 'rising' ? '#d58a42' : '#b9543e'
      ctx.save()
      ctx.globalAlpha = .18
      ctx.fillStyle = color
      ctx.beginPath(); ctx.arc(point.x, point.y, radius * 2.25, 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = .84
      ctx.fillStyle = color
      ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = 1
      ctx.strokeStyle = '#fff8ed'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, Math.PI * 2); ctx.stroke()
      ctx.restore()
    })
  }

  if (options.route) {
    const routePoints = options.route.coordinates.map((coordinate) => projector.point(toLocalMetres(coordinate, area.center)))
    const routeColor = options.route.mode === 'bike' ? '#4b8fa3' : options.route.mode === 'car' ? '#756d65' : '#b9543e'
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(255,248,237,.92)'; ctx.lineWidth = 6; strokeLine(ctx, routePoints); ctx.strokeStyle = routeColor; ctx.lineWidth = 3; strokeLine(ctx, routePoints)
    const origin = projector.point(toLocalMetres(options.route.origin, area.center)); const destination = projector.point(toLocalMetres(options.route.destination, area.center))
    ctx.fillStyle = '#f9f5ed'; ctx.strokeStyle = '#b9543e'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(origin.x, origin.y, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    ctx.beginPath(); ctx.arc(destination.x, destination.y, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    ctx.restore()
  }

  if (hasSelection) {
    const landmarkHeights = new Map(landmarks.flatMap(({ renderer, features }) => features.map(({ id }) => [id, renderer.selectionHeight ?? 0] as const)))
    visibleSports.filter(({ id }) => selectedIds.has(id)).forEach((feature) => {
      const elevation = projector.height(landmarkHeights.get(feature.id) ?? 0)
      const rings = feature.rings.map((ring) => ring.map((mapPoint) => { const point = projector.point(mapPoint); return { x: point.x, y: point.y - elevation } }))
      ctx.save(); ctx.shadowColor = 'rgba(150,62,42,.68)'; ctx.shadowBlur = 13; traceRings(ctx, rings); ctx.fillStyle = 'rgba(196,95,70,.12)'; ctx.fill('evenodd'); ctx.strokeStyle = '#903d2c'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore()
    })
  }

}
