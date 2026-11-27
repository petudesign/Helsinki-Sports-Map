import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const data = JSON.parse(await readFile('data/raw/helsinki-expanded.json', 'utf8'))
const [west, south, east, north] = data.bbox
const categories = data.features.reduce((counts, feature) => ({ ...counts, [feature.properties.category]: (counts[feature.properties.category] ?? 0) + 1 }), {})
const neighboringFeatures = data.features.filter((feature) => feature.properties.context === 'neighboring')
const coordinatesOf = (geometry) => geometry.type === 'Point' ? [geometry.coordinates] : geometry.type === 'LineString' ? geometry.coordinates : geometry.coordinates.flat()
const hasNorthernGeometry = data.features.some((feature) => coordinatesOf(feature.geometry).some(([, latitude]) => latitude > 60.22))

assert.deepEqual(data.bbox, [24.76, 60.12, 25, 60.3])
const actualBounds = data.features.flatMap((feature) => coordinatesOf(feature.geometry)).reduce((bounds, [longitude, latitude]) => [
  Math.min(bounds[0], longitude), Math.min(bounds[1], latitude), Math.max(bounds[2], longitude), Math.max(bounds[3], latitude),
], [Infinity, Infinity, -Infinity, -Infinity])
assert.ok(actualBounds[0] >= west && actualBounds[1] >= south && actualBounds[2] <= east && actualBounds[3] <= north, `Geometry escapes expanded bbox: ${actualBounds}`)
assert.ok(data.features.length > 40_000, 'Expanded map should contain the merged Helsinki geometry including Lauttasaari')
assert.ok(hasNorthernGeometry, 'Expanded map is missing geometry north of the original study area')
assert.ok(categories.building > 1_000 && categories.road > 1_000, 'Expanded map should retain useful urban context')
assert.ok(categories.water > 15 && categories.green > 300, 'Expanded map should retain water and green context')
assert.ok(neighboringFeatures.length > 5_000, 'Expanded map should retain neighboring context separately from Helsinki')
assert.ok(data.features.some((feature) => /keilaniemi/i.test(feature.properties.name ?? '') && feature.properties.context === 'neighboring'), 'Keilaniemi should be classified outside Helsinki')

console.log('Expanded map OK', { features: data.features.length, neighboringFeatures: neighboringFeatures.length, categories, bbox: data.bbox })
