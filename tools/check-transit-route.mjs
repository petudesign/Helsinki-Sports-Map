import assert from 'node:assert/strict'
import handler from '../api/transit-route.mjs'

process.env.DIGITRANSIT_API_KEY = 'test-only'
const originalFetch = global.fetch
const origin = [24.94, 60.17]
const destination = [24.98, 60.19]
let upstreamRequest
global.fetch = async (url, init) => {
  upstreamRequest = { url, init }
  const itinerary = {
    duration: 1800,
    walkTime: 420,
    numberOfTransfers: 1,
    legs: [
      { mode: 'WALK', transitLeg: false, duration: 300, distance: 250, from: { name: 'Origin', lat: origin[1], lon: origin[0] }, to: { name: 'Kamppi', lat: 60.169, lon: 24.932, stop: { zoneId: 'HSL:A' } }, route: null },
      { mode: 'BUS', transitLeg: true, duration: 1200, distance: 4200, headsign: 'Itäkeskus', legGeometry: { points: '' }, from: { name: 'Kamppi', lat: 60.169, lon: 24.932, stop: { zoneId: 'HSL:A' } }, to: { name: 'Kalasatama', lat: destination[1], lon: destination[0], stop: { zoneId: 'HSL:B' } }, route: { shortName: '550' } },
    ],
  }
  return {
    ok: true,
    json: async () => ({ data: { planConnection: { edges: [{ node: itinerary }] } } }),
  }
}

const response = {
  statusCode: 200,
  headers: {},
  body: undefined,
  setHeader(name, value) { this.headers[name] = value },
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this },
}

await handler({ method: 'POST', headers: {}, body: { origin, destination, locale: 'en' } }, response)
assert.equal(response.statusCode, 200)
assert.deepEqual(response.body.route.transit.zones, ['A', 'B'])
assert.equal(response.body.route.transit.legs[1].routeName, '550')
assert.equal(response.body.route.distanceMetres, 4450)
assert.equal(response.body.route.coordinates.length, 3)
assert.equal(upstreamRequest.url, 'https://api.digitransit.fi/routing/v2/hsl/gtfs/v1')
assert.equal(upstreamRequest.init.headers['digitransit-subscription-key'], 'test-only')

global.fetch = originalFetch
console.log('Transit route checks passed: HSL proxy payload, zones, line metadata, distance and server-only key forwarding.')
