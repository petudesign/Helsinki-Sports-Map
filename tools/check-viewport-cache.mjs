import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import vm from 'node:vm'

const source = readFileSync('src/data/area.ts', 'utf8')
const loaderSource = source.slice(source.indexOf('export function createChunkedAreaLoader'))
let builds = 0
let loads = 0
const context = { createAreaFromChunks: async (chunks) => ({ chunks, build: ++builds }), chunkIsVisible: (chunk, manifest, viewport) => viewport.visible.includes(chunk.file) }
vm.createContext(context)
vm.runInContext(stripTypeScriptTypes(loaderSource.replace('export function', 'function')), context)
const loader = context.createChunkedAreaLoader({
  loadManifest: async () => ({ chunks: [{ file: 'a' }, { file: 'b' }] }),
  loadOverview: async () => ({ overview: true }),
  loadChunk: async (file) => { loads++; return { file } },
})
const initial = await loader.loadDataset()
assert.equal(await loader.loadDatasetForViewport({ zoom: 1 }), initial)
const [first, repeated] = await Promise.all([1, 2].map(() => loader.loadDatasetForViewport({ zoom: 2, visible: ['a'] })))
assert.equal(first, repeated, 'Identical concurrent viewport requests must share normalization')
assert.equal(loads, 1)
assert.equal(builds, 2)
await loader.loadDatasetForViewport({ zoom: 2, visible: ['b'] })
assert.equal(await loader.loadDatasetForViewport({ zoom: 3, visible: ['a'] }), first)
assert.equal(await loader.loadDatasetForViewport({ zoom: 3, visible: [] }), initial)
assert.equal(loads, 2, 'Panning outside the dataset must not fetch all detail chunks')
console.log('Viewport cache checks passed')
