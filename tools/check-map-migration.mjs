import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { runtimeSite } from './lib/lipas-runtime.mjs'

const read = (name) => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'))
const raw = read('helsinki-expanded')
const venues = read('venue-map')
assert.deepEqual(venues.bbox, raw.bbox)
assert.deepEqual(venues.features, raw.features.filter((f) => f.properties.category === 'sport' && f.properties.context !== 'neighboring'))
assert.ok(venues.features.length > 400)
for (const site of read('lipas-helsinki').sites) {
  const geometry = site.geometry?.features?.[0]?.geometry
  const anchor = geometry?.type === 'Point' ? geometry.coordinates : geometry?.type === 'LineString' ? geometry.coordinates[0] : geometry?.type === 'Polygon' ? geometry.coordinates[0]?.[0] : undefined
  assert.deepEqual(runtimeSite(site).geometry?.features[0].geometry.coordinates, anchor, `Anchor changed for ${site.id}`)
}
const assets = readdirSync(new URL('../dist/assets/', import.meta.url))
assert(!assets.some((file) => /^(overview|[0-7]-[0-7])-/.test(file)), 'Custom basemap must not enter the production bundle')
assert(assets.some((file) => file.startsWith('maplibre-gl-worker-')), 'Production worker is missing')
console.log('Map migration checks passed: facility geometry preserved, LIPAS anchors unchanged, old basemap excluded, worker bundled.')
