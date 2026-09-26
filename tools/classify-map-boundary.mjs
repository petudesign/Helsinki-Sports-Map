import { readFile, writeFile } from 'node:fs/promises'

const [inputPath = 'src/data/helsinki-expanded.json', boundaryPath = 'src/data/helsinki-boundary.json', outputPath = 'tmp/helsinki-expanded-classified.json'] = process.argv.slice(2)
const [source, boundarySnapshot] = await Promise.all([
  readFile(inputPath, 'utf8').then(JSON.parse),
  readFile(boundaryPath, 'utf8').then(JSON.parse),
])

const boundaryGeometry = boundarySnapshot[0]?.geojson ?? boundarySnapshot.geojson ?? boundarySnapshot
if (!boundaryGeometry || !['Polygon', 'MultiPolygon'].includes(boundaryGeometry.type)) throw new Error('Boundary data must contain a Polygon or MultiPolygon GeoJSON geometry')

function pointInRing([longitude, latitude], ring) {
  let inside = false
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [currentLongitude, currentLatitude] = ring[index]
    const [previousLongitude, previousLatitude] = ring[previous]
    const intersects = (currentLatitude > latitude) !== (previousLatitude > latitude) && longitude < (previousLongitude - currentLongitude) * (latitude - currentLatitude) / (previousLatitude - currentLatitude) + currentLongitude
    if (intersects) inside = !inside
  }
  return inside
}

function pointInPolygon(point, rings) {
  return pointInRing(point, rings[0]) && !rings.slice(1).some((ring) => pointInRing(point, ring))
}

function pointInBoundary(point) {
  if (boundaryGeometry.type === 'Polygon') return pointInPolygon(point, boundaryGeometry.coordinates)
  return boundaryGeometry.coordinates.some((polygon) => pointInPolygon(point, polygon))
}

function representativePoint(geometry) {
  if (geometry.type === 'Point') return geometry.coordinates
  const points = geometry.type === 'LineString' ? geometry.coordinates : geometry.coordinates[0]
  const usable = points.filter((point) => Array.isArray(point) && point.length === 2)
  if (!usable.length) return undefined
  const total = usable.reduce(([longitude, latitude], [pointLongitude, pointLatitude]) => [longitude + pointLongitude, latitude + pointLatitude], [0, 0])
  return [total[0] / usable.length, total[1] / usable.length]
}

let neighboringFeatures = 0
const features = source.features.map((feature) => {
  const point = representativePoint(feature.geometry)
  const neighboring = !point || !pointInBoundary(point)
  if (neighboring) neighboringFeatures += 1
  const properties = { ...feature.properties }
  if (neighboring) properties.context = 'neighboring'
  else delete properties.context
  return { ...feature, properties }
})

await writeFile(outputPath, `${JSON.stringify({ ...source, features })}\n`)
console.log(`Boundary classification complete: ${neighboringFeatures} neighboring-context features, ${features.length - neighboringFeatures} Helsinki features`)
