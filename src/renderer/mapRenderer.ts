import type { BuildingFeature, MapDataset, MapPoint, SportFeature } from '../data/types'
import { createProjector, type ScreenPoint, type View } from './projection'
import { editorialTheme as theme, sportStyle } from './theme'

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

function drawSport(ctx: CanvasRenderingContext2D, feature: SportFeature, rings: ScreenPoint[][]) {
  const style = sportStyle(feature.sport)
  traceRings(ctx, rings); ctx.fillStyle = style.fill; ctx.fill('evenodd'); ctx.strokeStyle = style.stroke; ctx.lineWidth = 2; ctx.stroke()
  const outline = rings[0]; if (!outline?.length) return
  const middle = centroid(outline)
  const xs = outline.map((point) => point.x); const ys = outline.map((point) => point.y)
  const width = Math.max(...xs) - Math.min(...xs); const height = Math.max(...ys) - Math.min(...ys)
  if (width < 12 || height < 8) return
  ctx.save(); ctx.strokeStyle = style.marking; ctx.lineWidth = 1
  if (['athletics', 'running'].includes(feature.sport)) { ctx.beginPath(); ctx.ellipse(middle.x, middle.y, Math.max(5, width * .34), Math.max(3, height * .3), 0, 0, Math.PI * 2); ctx.stroke() }
  else { ctx.beginPath(); ctx.moveTo(middle.x - width * .22, middle.y); ctx.lineTo(middle.x + width * .22, middle.y); ctx.stroke(); ctx.beginPath(); ctx.arc(middle.x, middle.y, Math.min(4, Math.max(1.5, Math.min(width, height) * .08)), 0, Math.PI * 2); ctx.stroke() }
  ctx.restore()
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

export function renderMap(canvas: HTMLCanvasElement, area: MapDataset, view: View) {
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

  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = theme.ground; ctx.fillRect(0, 0, width, height)
  ctx.save(); ctx.globalAlpha = .065; ctx.strokeStyle = theme.grain; ctx.lineWidth = 1
  for (let x = -height; x < width + height; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + height, height); ctx.stroke() }
  ctx.restore()

  area.surfaces.filter((feature) => feature.kind === 'water').forEach((feature) => { const rings = feature.rings.map(projectRing); traceRings(ctx, rings); ctx.fillStyle = theme.water; ctx.fill('evenodd'); ctx.strokeStyle = theme.waterLine; ctx.lineWidth = 1; ctx.stroke() })
  area.surfaces.filter((feature) => feature.kind === 'green').forEach((feature) => { const rings = feature.rings.map(projectRing); traceRings(ctx, rings); ctx.fillStyle = theme.green; ctx.fill('evenodd'); ctx.strokeStyle = theme.greenEdge; ctx.lineWidth = .7; ctx.stroke() })
  area.sports.forEach((feature) => drawSport(ctx, feature, feature.rings.map(projectRing)))

  area.routes.forEach((route) => {
    const points = route.points.map(projector.point); ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    if (route.kind === 'path') { ctx.strokeStyle = theme.path; ctx.lineWidth = 1.05; ctx.setLineDash([3, 3]); strokeLine(ctx, points); ctx.setLineDash([]); return }
    const widthByKind = route.kind === 'major' ? [8, 5.5] : route.kind === 'street' ? [5.5, 3.4] : [3.5, 2]
    ctx.strokeStyle = theme.roadEdge; ctx.lineWidth = widthByKind[0]; strokeLine(ctx, points); ctx.strokeStyle = theme.road; ctx.lineWidth = widthByKind[1]; strokeLine(ctx, points)
  })

  const buildings = area.buildings.map((building) => ({ building, rings: building.rings.map(projectRing) })).sort((a, b) => centroid(a.rings[0]).y - centroid(b.rings[0]).y)
  buildings.forEach(({ building, rings }) => drawBuilding(ctx, building, rings, projector.height(building.height), view))
  area.trees.map(projector.point).sort((a, b) => a.y - b.y).forEach((point, index) => drawTree(ctx, point, index, view))

  const landmarkNames = ['Helsingin olympiastadion', 'Bolt Arena', 'Helsingin jäähalli']
  const landmarks = [...new Map(area.sports.filter((feature) => feature.name && landmarkNames.includes(feature.name)).map((feature) => [feature.name, feature])).values()]
  landmarks.forEach((feature) => { const point = centroid(feature.rings[0].map(projector.point)); ctx.font = '500 8px DM Mono, monospace'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(237,232,223,.9)'; ctx.strokeText(feature.name!, point.x, point.y - 9); ctx.fillStyle = theme.ink; ctx.fillText(feature.name!, point.x, point.y - 9) })
}
