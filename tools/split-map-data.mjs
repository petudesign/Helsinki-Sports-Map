import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
function option(name, fallback) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] ?? fallback : fallback
}

const sourcePath = path.resolve(option('--source', 'src/data/central-helsinki.json'))
const outputDirectory = path.resolve(option('--output', 'src/data/map-chunks/central-helsinki'))
const columns = Number(option('--columns', '4'))
const rows = Number(option('--rows', '4'))
if (!Number.isInteger(columns) || columns < 1 || !Number.isInteger(rows) || rows < 1) throw new Error('Chunk columns and rows must be positive integers')
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'))
const [west, south, east, north] = source.bbox

function pointsForGeometry(geometry) {
  if (geometry.type === 'Point') return [geometry.coordinates]
  if (geometry.type === 'LineString') return geometry.coordinates
  return geometry.coordinates.flat()
}

function boundsForFeature(feature) {
  return pointsForGeometry(feature.geometry).reduce((bounds, [longitude, latitude]) => ({
    minLongitude: Math.min(bounds.minLongitude, longitude),
    minLatitude: Math.min(bounds.minLatitude, latitude),
    maxLongitude: Math.max(bounds.maxLongitude, longitude),
    maxLatitude: Math.max(bounds.maxLatitude, latitude),
  }), { minLongitude: Infinity, minLatitude: Infinity, maxLongitude: -Infinity, maxLatitude: -Infinity })
}

function cellRange(min, max, start, end, count) {
  return {
    first: Math.max(0, Math.min(count - 1, Math.floor((min - start) / (end - start) * count))),
    last: Math.max(0, Math.min(count - 1, Math.floor((max - start) / (end - start) * count))),
  }
}

const cells = Array.from({ length: columns * rows }, (_, index) => ({ index, features: [] }))
for (const feature of source.features) {
  const bounds = boundsForFeature(feature)
  const columnRange = cellRange(bounds.minLongitude, bounds.maxLongitude, west, east, columns)
  const rowRange = cellRange(north - bounds.maxLatitude, north - bounds.minLatitude, 0, north - south, rows)
  for (let row = rowRange.first; row <= rowRange.last; row += 1) {
    for (let column = columnRange.first; column <= columnRange.last; column += 1) {
      cells[row * columns + column].features.push(feature)
    }
  }
}

function isOverviewFeature(feature) {
  const { category, routeKind } = feature.properties
  if (['water', 'green', 'urban', 'waterline', 'rail', 'sport'].includes(category)) return true
  if (category === 'road') return ['major', 'street'].includes(routeKind)
  if (category === 'building') {
    const ring = feature.geometry.coordinates[0]
    const longitudes = ring.map(([longitude]) => longitude)
    const latitudes = ring.map(([, latitude]) => latitude)
    const area = (Math.max(...longitudes) - Math.min(...longitudes)) * (Math.max(...latitudes) - Math.min(...latitudes))
    return Boolean(feature.properties.name) || area > 0.00000035
  }
  return false
}

fs.rmSync(outputDirectory, { recursive: true, force: true })
fs.mkdirSync(outputDirectory, { recursive: true })
const overview = {
  type: source.type,
  name: source.name,
  attribution: source.attribution,
  source: source.source,
  center: source.center,
  bbox: source.bbox,
  features: source.features.filter(isOverviewFeature),
}
fs.writeFileSync(path.join(outputDirectory, 'overview.json'), `${JSON.stringify(overview)}\n`)
for (const cell of cells) {
  const row = Math.floor(cell.index / columns)
  const column = cell.index % columns
  const cellWest = west + (east - west) * column / columns
  const cellEast = west + (east - west) * (column + 1) / columns
  const cellSouth = south + (north - south) * (rows - row - 1) / rows
  const cellNorth = south + (north - south) * (rows - row) / rows
  const chunk = {
    type: source.type,
    name: source.name,
    attribution: source.attribution,
    source: source.source,
    center: source.center,
    bbox: source.bbox,
    chunkBbox: [cellWest, cellSouth, cellEast, cellNorth],
    features: cell.features,
  }
  fs.writeFileSync(path.join(outputDirectory, `${row}-${column}.json`), `${JSON.stringify(chunk)}\n`)
}

const manifest = {
  name: source.name,
  center: source.center,
  bbox: source.bbox,
  chunks: cells.map((cell) => {
    const row = Math.floor(cell.index / columns)
    const column = cell.index % columns
    const cellWest = west + (east - west) * column / columns
    const cellEast = west + (east - west) * (column + 1) / columns
    const cellSouth = south + (north - south) * (rows - row - 1) / rows
    const cellNorth = south + (north - south) * (rows - row) / rows
    return { id: `${row}-${column}`, file: `${row}-${column}.json`, row, column, bbox: [cellWest, cellSouth, cellEast, cellNorth] }
  }),
}
fs.writeFileSync(path.join(outputDirectory, 'manifest.json'), `${JSON.stringify(manifest)}\n`)

const featureReferences = cells.reduce((total, cell) => total + cell.features.length, 0)
console.log(`Map chunks written: ${cells.length} chunks, ${source.features.length} unique features, ${featureReferences} chunk references, ${overview.features.length} overview features`)
