import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { stripTypeScriptTypes } from 'node:module'

// Exercise the actual TypeScript classifiers without adding a test dependency.
const source = readFileSync(new URL('../src/data/lipas.ts', import.meta.url), 'utf8')
const output = stripTypeScriptTypes(source.replace(/^import .*$/gm, '').replace(/export function/g, 'function')) + '\nexports.sportsFromSite = sportsFromSite; exports.explicitPrice = explicitPrice; exports.priceClassForSites = priceClassForSites;'
const snapshot = JSON.parse(readFileSync(new URL('../src/data/lipas-helsinki.json', import.meta.url), 'utf8'))
const context = { exports: {}, lipasSnapshot: snapshot }
vm.runInNewContext(output, context)
const { sportsFromSite, explicitPrice, priceClassForSites } = context.exports
const site = (id) => snapshot.sites.find((item) => item.id === id)
assert.equal(explicitPrice(site(78357)), undefined, 'Seasonal restrictions must override the free flag')
assert.deepEqual(Array.from(sportsFromSite(site(608442))), ['table_tennis'], 'Neighbours and parent must not add sports')
assert.deepEqual(Array.from(sportsFromSite(site(77584))), ['minigolf'])
assert.ok(sportsFromSite(site(98177)).includes('swimming'), 'Kumpulan outdoor pool must remain a swimming place')
assert.ok(sportsFromSite(site(98177)).includes('outdoor_swimming'), 'Kumpulan outdoor pool must be filterable as outdoor swimming')
assert.ok(sportsFromSite(site(100614)).includes('outdoor_swimming'), 'Public beaches must be filterable as outdoor swimming')
assert.ok(sportsFromSite(site(74562)).includes('skateboarding'), 'Skateboarding facilities must use the skateboarding category')
assert.ok(!sportsFromSite(site(608442)).includes('outdoor_swimming'), 'A pool child record must not inherit outdoor swimming from its parent')
assert.equal(priceClassForSites([{ name: 'Free', properties: { 'free-use?': true } }, { name: 'Unknown' }]), 'unknown')
assert.equal(explicitPrice({ name: 'Unknown', comment: 'Ei vapaassa käytössä' }), undefined)
console.log('LIPAS classification checks passed')
