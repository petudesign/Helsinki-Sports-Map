import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const data = JSON.parse(await readFile('src/data/helsinki-expanded.json', 'utf8'))
const [west, south, east, north] = data.bbox
const categories = data.features.reduce((counts, feature) => ({ ...counts, [feature.properties.category]: (counts[feature.properties.category] ?? 0) + 1 }), {})
const coordinatesOf = (geometry) => geometry.type === 'Point' ? [geometry.coordinates] : geometry.type === 'LineString' ? geometry.coordinates : geometry.coordinates.flat()
const hasNorthernGeometry = data.features.some((feature) => coordinatesOf(feature.geometry).some(([, latitude]) => latitude > 60.22))

assert.deepEqual(data.bbox, [24.88, 60.165, 24.98, 60.28])
assert.ok(data.features.length > 30_000, 'Expanded map should contain the merged central and northern geometry')
assert.ok(hasNorthernGeometry, 'Expanded map is missing geometry north of the original study area')
assert.ok(categories.building > 1_000 && categories.road > 1_000, 'Expanded map should retain useful urban context')
assert.ok(categories.water > 15 && categories.green > 300, 'Expanded map should retain water and green context')

console.log('Expanded map OK', { features: data.features.length, categories, bbox: data.bbox })
