import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import vm from 'node:vm'

const timers = new Map()
let serial = 0
let worker
class FakeWorker {
  messages = []
  constructor() { worker = this }
  postMessage(message) { this.messages.push(message) }
  terminate() { this.terminated = true }
  reply(mode = '2d', zoom = 1) {
    const bitmap = { closed: 0, close() { this.closed++ } }
    this.onmessage({ data: { frame: { bitmap, mode, zoom } } })
    return bitmap
  }
}
const context = vm.createContext({ Worker: FakeWorker, OffscreenCanvas: class {}, URL, window: { devicePixelRatio: 2 },
  setTimeout(fn) { timers.set(++serial, fn); return serial }, clearTimeout(id) { timers.delete(id) } })
const source = stripTypeScriptTypes(readFileSync('src/renderer/backgroundRenderer.ts', 'utf8'))
vm.runInContext(source.replace('export function', 'function').replace('import.meta.url', "'https://example.test/renderer.js'"), context)
const flush = () => { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(fn => fn()) }
const renderer = context.createBackgroundRenderer(() => {})
const area = {}
const view = zoom => ({ mode: '2d', zoom, pan: { x: 0, y: 0 } })
const update = zoom => renderer.update(area, view(zoom), 800, 600, [])
assert.equal(update(1), null)
flush()
assert.equal(worker.messages.length, 1)
assert.equal(worker.messages[0].dpr, 1.5)
update(2); update(3); flush()
assert.equal(worker.messages.length, 1, 'Only one background render may be in flight')
const overview = worker.reply()
assert.equal(worker.messages.length, 2)
assert.equal(worker.messages[1].view.zoom, 3, 'Queued work uses only the newest camera')
assert.equal(worker.messages[1].area, undefined, 'Unchanged data must not be cloned again')
const detail = worker.reply('2d', 3)
assert.equal(update(3).fallback.bitmap, overview)
flush()
assert.equal(worker.messages.length, 2, 'Completed frames must not trigger a render loop')
update(4)
assert.equal(worker.messages.length, 2, 'Gestures reuse a frame until the quiet timer fires')
flush()
worker.reply('2d', 4)
assert.equal(detail.closed, 1)
assert.equal(overview.closed, 0, 'Overview remains available behind detail during gestures')
worker.onerror()
assert.equal(update(4), undefined, 'Worker failures enable synchronous rendering')
assert.equal(overview.closed, 1)
renderer.dispose()
assert.equal(overview.closed, 1, 'Bitmaps must not be closed twice')
console.log('Background renderer checks passed')
