import { readFile, writeFile } from 'node:fs/promises'

const [inputPath = 'tmp/olympic-area-osm.json', outputPath = 'src/data/olympic-area.json'] = process.argv.slice(2)
const source = JSON.parse(await readFile(inputPath, 'utf8'))
const center = [24.92725, 60.18725]
const metresPerLon = 111_320 * Math.cos(center[1] * Math.PI / 180)
const metresPerLat = 111_320

const toMetres = ([lon, lat]) => [(lon - center[0]) * metresPerLon, (lat - center[1]) * metresPerLat]
const distanceToSegment = (point, start, end) => {
  const dx = end[0] - start[0]; const dy = end[1] - start[1]
  if (!dx && !dy) return Math.hypot(point[0] - start[0], point[1] - start[1])
  const t = Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(point[0] - (start[0] + t * dx), point[1] - (start[1] + t * dy))
}
const simplify = (coordinates, tolerance) => {
  if (coordinates.length <= 3) return coordinates
  const metres = coordinates.map(toMetres)
  const keep = new Set([0, coordinates.length - 1])
  const visit = (first, last) => {
    let furthest = 0; let index = -1
    for (let i = first + 1; i < last; i++) { const distance = distanceToSegment(metres[i], metres[first], metres[last]); if (distance > furthest) { furthest = distance; index = i } }
    if (furthest > tolerance && index > -1) { keep.add(index); visit(first, index); visit(index, last) }
  }
  visit(0, coordinates.length - 1)
  return coordinates.filter((_, index) => keep.has(index))
}
const area = (ring) => { const points = ring.map(toMetres); return Math.abs(points.reduce((sum, point, index) => { const next = points[(index + 1) % points.length]; return sum + point[0] * next[1] - next[0] * point[1] }, 0) / 2) }
const length = (line) => { const points = line.map(toMetres); return points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point[0] - points[index][0], point[1] - points[index][1]), 0) }
const isClosed = (coordinates) => coordinates.length > 3 && coordinates[0][0] === coordinates.at(-1)[0] && coordinates[0][1] === coordinates.at(-1)[1]
const number = (value) => { const parsed = Number.parseFloat(value); return Number.isFinite(parsed) ? parsed : undefined }
const height = (tags) => number(tags.height) ?? (number(tags['building:levels']) ? number(tags['building:levels']) * 3.2 : undefined)
const sport = (tags) => tags.sport?.split(';')[0] ?? (tags.leisure === 'pitch' ? 'multi' : tags.leisure)
const category = (tags, closed) => {
  if (closed && (tags.sport || ['pitch', 'stadium', 'track', 'sports_centre'].includes(tags.leisure))) return 'sport'
  if (closed && tags.building) return 'building'
  if (closed && (tags.natural === 'water' || tags.waterway === 'riverbank')) return 'water'
  if (closed && (['park', 'garden'].includes(tags.leisure) || ['grass', 'meadow', 'recreation_ground'].includes(tags.landuse) || tags.natural === 'wood')) return 'green'
  if (tags.highway) return ['pedestrian', 'footway', 'cycleway', 'path'].includes(tags.highway) ? 'path' : 'road'
  return undefined
}
const routeKind = (highway) => ['primary', 'secondary'].includes(highway) ? 'major' : highway === 'tertiary' ? 'street' : 'local'
const features = []

const addGeometry = (element, geometry, suffix = '') => {
  if (!geometry?.length) return
  const coordinates = geometry.map(({ lon, lat }) => [lon, lat])
  const closed = isClosed(coordinates)
  const kind = category(element.tags ?? {}, closed)
  if (!kind) return
  const tolerance = kind === 'sport' ? 0.75 : kind === 'building' ? 1.1 : kind === 'path' ? 3.5 : 2
  const simplified = simplify(coordinates, tolerance)
  const polygonArea = closed ? area(simplified) : 0
  const lineLength = closed ? 0 : length(simplified)
  if ((kind === 'building' && polygonArea < 110) || (kind === 'green' && polygonArea < 600) || (kind === 'path' && lineLength < 90) || (kind === 'road' && element.tags?.highway === 'service' && lineLength < 70) || (closed && simplified.length < 4)) return
  features.push({
    type: 'Feature',
    id: `${element.type}/${element.id}${suffix}`,
    properties: { category: kind, name: element.tags?.name, sport: kind === 'sport' ? sport(element.tags ?? {}) : undefined, height: kind === 'building' ? height(element.tags ?? {}) : undefined, routeKind: ['road', 'path'].includes(kind) ? routeKind(element.tags?.highway) : undefined, osmTags: kind === 'sport' ? { leisure: element.tags?.leisure, sport: element.tags?.sport } : undefined },
    geometry: { type: closed ? 'Polygon' : 'LineString', coordinates: closed ? [simplified] : simplified },
  })
}

for (const element of source.elements) {
  if (element.type === 'node' && element.tags?.natural === 'tree') continue
  if (element.geometry) addGeometry(element, element.geometry)
  if (element.type === 'relation') element.members?.filter((member) => member.type === 'way' && member.role === 'outer' && member.geometry).forEach((member, index) => addGeometry({ ...element, type: 'relation' }, member.geometry, `/outer-${index}`))
}

const trees = source.elements.filter((element) => element.type === 'node' && element.tags?.natural === 'tree')
const keptTrees = []
for (const tree of trees) { const point = toMetres([tree.lon, tree.lat]); if (keptTrees.every((kept) => Math.hypot(point[0] - kept.metres[0], point[1] - kept.metres[1]) > 32)) keptTrees.push({ tree, metres: point }) }
keptTrees.slice(0, 36).forEach(({ tree }) => features.push({ type: 'Feature', id: `node/${tree.id}`, properties: { category: 'tree' }, geometry: { type: 'Point', coordinates: [tree.lon, tree.lat] } }))

const collection = { type: 'FeatureCollection', name: 'Töölö Olympic Stadium study area', attribution: '© OpenStreetMap contributors', license: 'ODbL 1.0', source: 'https://www.openstreetmap.org/copyright', center, bbox: [24.9175, 60.1825, 24.9370, 60.1920], generatedAt: new Date().toISOString(), features }
await writeFile(outputPath, `${JSON.stringify(collection, null, 2)}\n`)
const counts = features.reduce((result, feature) => ({ ...result, [feature.properties.category]: (result[feature.properties.category] ?? 0) + 1 }), {})
console.log(JSON.stringify(counts, null, 2))
