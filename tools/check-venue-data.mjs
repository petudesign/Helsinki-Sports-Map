import assert from 'node:assert/strict'
import data from '../src/data/olympic-area.json' with { type: 'json' }

const kisahalli = data.features.find(({ properties }) => properties.name === 'Töölön Kisahalli')
assert.ok(kisahalli, 'Töölön Kisahalli missing from extract')

const sports = kisahalli.properties.osmTags?.sport?.split(';').filter(Boolean) ?? []
for (const sport of ['basketball', 'volleyball', 'badminton', 'table_tennis', 'karate', 'golf']) {
  assert.ok(sports.includes(sport), `Töölön Kisahalli is missing ${sport} capability`)
}

assert.ok(!sports.includes('multi'), 'Multi-sport must not replace explicit capabilities')

const olympicStadium = data.features.find(({ properties }) => properties.name === 'Helsingin olympiastadion')
assert.ok(olympicStadium, 'Olympic Stadium missing from extract')
assert.equal(olympicStadium.id, 'way/138324248', 'Olympic Stadium profile id changed; update curated venue data')
console.log(`Venue data OK: Töölön Kisahalli exposes ${sports.length} explicit capabilities; Olympic Stadium has a curated profile`)
