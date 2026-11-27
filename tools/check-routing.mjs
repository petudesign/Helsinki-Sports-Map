import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import vm from 'node:vm'

// Imports are stripped, so the modules routing.ts depends on are concatenated in order.
const source = ['http.ts', 'geocoding.ts', 'routing.ts'].map((file) => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')).join('\n')
const js = stripTypeScriptTypes(source.replace(/^import .*$/gm, '').replace(/^export /gm, ''))
const context = { exports: {}, URLSearchParams, AbortController, setTimeout, clearTimeout, fetch: undefined }
vm.runInNewContext(js + '\nexports.searchAddresses=searchAddresses; exports.routeByMode=routeByMode; exports.requestJson=requestJson;', context)
const { searchAddresses, routeByMode, requestJson } = context.exports
const response = (json, status = 200) => ({ ok: status === 200, status, json: async () => json })

context.fetch = async (url) => {
  assert.ok(url.includes('prefix=M%C3%A4k'))
  return response({ features: ['Mäkelänkatu', 'Mäkelänrinne', 'Mäkelänkatu', 'Mannerheimintie'].map(katunimi => ({ properties: { katunimi } })) })
}
assert.deepEqual(Array.from(await searchAddresses('Mäk'), s => s.label), ['Mäkelänkatu', 'Mäkelänrinne'])
// Place search runs alongside the street index (batch 8). An empty but successful
// street answer must not fall through to the credentialed Paikkatieto lookup.
const calls = []
context.fetch = async (url) => { calls.push(url.split('?')[0]); return response({ features: [] }) }
assert.equal((await searchAddresses('Tuntematon')).length, 0)
assert.deepEqual(calls.sort(), ['/api/helsinki-streets', '/api/places'], 'A valid empty street search must not trigger another service')

context.fetch = async () => response({}, 503)
await assert.rejects(searchAddresses('Mäk'), /Request failed/)
await assert.rejects(searchAddresses('Mäkelänkatu 10'), /Request failed/)

context.fetch = async () => response({results:[{street:{name:'Mäkelänkatu'},number:'10',postal_code_area:{postal_code:'00510'},location:{coordinates:[24.955,60.193]}}]})
const [address] = await searchAddresses('Mäkelänkatu 10')
assert.equal(address.label, 'Mäkelänkatu 10, 00510')
assert.deepEqual(Array.from(address.coordinates), [24.955,60.193])

context.fetch = async () => response({code:'Ok',routes:[{distance:1000,duration:600,geometry:{coordinates:[[24.95,60.19],[24.93,60.18]]}}]})
const route = await routeByMode([24.95,60.19],[24.93,60.18],'walk')
assert.equal(route.durationSeconds,600)
assert.equal(route.coordinates.length,2)

context.fetch = (_url, {signal}) => new Promise((_resolve,reject) => {
  if (signal.aborted) return reject(new Error('aborted'))
  signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true})
})
await assert.rejects(requestJson('/hung', undefined, 10), /aborted/, 'Requests need a deadline')
const cancelled = new AbortController()
cancelled.abort()
await assert.rejects(searchAddresses('Mäk',cancelled.signal),/aborted/)
console.log('Routing checks passed: Mäk suggestions, deduplication, exact address, empty vs error, route parsing, deadline and cancellation.')
