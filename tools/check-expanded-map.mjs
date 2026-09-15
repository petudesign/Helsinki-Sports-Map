import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'

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

const chunkDirectory = 'src/data/map-chunks/helsinki-expanded'
const chunkFiles = (await readdir(chunkDirectory)).filter((file) => /^\d-\d\.json$/.test(file))
const chunkFeatures = (await Promise.all(chunkFiles.map(async (file) => JSON.parse(await readFile(`${chunkDirectory}/${file}`, 'utf8')).features))).flat()
const chunkIds = new Map()
chunkFeatures.forEach((feature) => {
  if (!feature.id) return
  assert.ok(Object.keys(feature.properties).every((key) => ['category', 'name', 'height', 'routeKind', 'sport', 'osmTags'].includes(key)), `Unexpected runtime map property in ${feature.id}`)
  chunkIds.set(feature.id, feature)
})
assert.equal(chunkIds.size, data.features.length, 'Generated map chunks must retain every source feature')
data.features.forEach((feature) => assert.equal(chunkIds.get(feature.id)?.properties.category, feature.properties.category, `Generated map feature is missing: ${feature.id}`))

console.log('Expanded map OK', { features: data.features.length, categories, bbox: data.bbox })
