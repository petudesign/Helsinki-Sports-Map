import assert from 'node:assert/strict'
import data from '../src/data/lipas-helsinki.json' with { type: 'json' }

const sites = data.sites
const excluded = /huoltorakennus|veneilyn palvelupaikka|kalastuskohde|pysäköinti|katsomo|opastuspiste|\binfo\b/i

assert.ok(sites.length > 0, 'LIPAS snapshot is empty')
assert.ok(sites.every((site) => site.name && site.type?.fi && site.type?.en), 'Every LIPAS site needs a Finnish and English source label')
function firstCoordinate(site) {
  const geometries = site.geometry?.features?.map(({ geometry }) => geometry) ?? []
  for (const geometry of geometries) {
    if (geometry?.type === 'Point' && Array.isArray(geometry.coordinates)) return geometry.coordinates
    if (geometry?.type === 'LineString' && Array.isArray(geometry.coordinates)) return geometry.coordinates[0]
    if (geometry?.type === 'Polygon' && Array.isArray(geometry.coordinates)) return geometry.coordinates[0]?.[0]
  }
  return undefined
}

assert.ok(sites.every((site) => {
  const coordinate = firstCoordinate(site)
  return Array.isArray(coordinate) && coordinate.length >= 2
}), 'Every LIPAS site needs a usable coordinate for the current map projection')

const userFacing = sites.filter((site) => !excluded.test(`${site.name} ${site.type?.fi ?? ''}`))
const excludedCount = sites.length - userFacing.length
const typeCounts = new Map()
for (const site of userFacing) typeCounts.set(site.type.fi, (typeCounts.get(site.type.fi) ?? 0) + 1)

const tooloBallFields = [85946, 82858, 82861, 85198, 86486]
assert.ok(tooloBallFields.every((id) => sites.some((site) => site.id === id)), 'Töölön pallokenttä curated records are missing')

assert.equal(userFacing.some((site) => excluded.test(`${site.name} ${site.type?.fi ?? ''}`)), false, 'Excluded LIPAS categories leaked into user-facing data')
console.log(`LIPAS data OK: ${sites.length} raw sites, ${userFacing.length} user-facing sites, ${excludedCount} excluded support sites`)
console.log(`Top categories: ${[...typeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([type, count]) => `${type} (${count})`).join(', ')}`)
