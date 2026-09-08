import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const data = JSON.parse(await readFile('src/data/olympic-area.json', 'utf8'))
const categories = data.features.reduce((counts, feature) => ({ ...counts, [feature.properties.category]: (counts[feature.properties.category] ?? 0) + 1 }), {})
const sportNames = new Set(data.features.filter((feature) => feature.properties.category === 'sport').map((feature) => feature.properties.name))

assert.equal(data.type, 'FeatureCollection')
assert.equal(data.attribution, '© OpenStreetMap contributors')
assert.ok(categories.building > 50, 'Expected a useful set of building footprints')
assert.ok(categories.sport > 10, 'Expected first-class sports geometry')
assert.ok(categories.road > 20 && categories.path > 20, 'Expected both road and path networks')
assert.ok(categories.green > 10, 'Expected surrounding green space')
assert.ok(sportNames.has('Helsingin olympiastadion'), 'Olympic Stadium missing from extract')
assert.ok(sportNames.has('Bolt Arena'), 'Bolt Arena missing from extract')
assert.ok(sportNames.has('Helsingin jäähalli'), 'Helsinki Ice Hall missing from extract')

console.log('Study area OK', categories)
