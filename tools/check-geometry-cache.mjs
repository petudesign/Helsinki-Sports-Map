import assert from 'node:assert/strict'
import { frameFromRing } from '../src/renderer/landmarks/geometry.ts'

const ring = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }, { x: 0, y: 10 }]
const frame = frameFromRing(ring)
assert.deepEqual(frame.center, { x: 10, y: 5 })
assert.equal(frame.halfLong, 10)
assert.equal(frame.halfShort, 5)
assert.equal(frameFromRing(ring), frame)
const translated = ring.map(({ x, y }) => ({ x: x + 100, y: y - 50 }))
assert.deepEqual(frameFromRing(translated).center, { x: 110, y: -45 })
assert.notEqual(frameFromRing(translated), frame)
console.log('Geometry cache checks passed')
