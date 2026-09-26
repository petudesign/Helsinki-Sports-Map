import { readFile, writeFile } from 'node:fs/promises'

const [basePath, additionPath, outputPath, ...bboxArgs] = process.argv.slice(2)
if (!basePath || !additionPath || !outputPath) throw new Error('Usage: node tools/merge-map-geojson.mjs <base> <addition> <output> [west south east north]')

const [base, addition] = await Promise.all([basePath, additionPath].map((path) => readFile(path, 'utf8').then(JSON.parse)))
const features = new Map()
for (const feature of [...base.features, ...addition.features]) {
  const key = feature.id ?? `${feature.properties?.category ?? 'feature'}:${JSON.stringify(feature.geometry)}`
  if (!features.has(key)) features.set(key, feature)
}

const bbox = bboxArgs.length === 4 ? bboxArgs.map(Number) : base.bbox
if (bbox.length !== 4 || bbox.some((value) => !Number.isFinite(value))) throw new Error('Bounding box must contain four finite numbers')
const [west, south, east, north] = bbox
if (!(west < east && south < north)) throw new Error('Bounding box must be ordered west, south, east, north')

const merged = {
  ...base,
  name: 'Helsinki sports map expanded study area',
  center: [(west + east) / 2, (south + north) / 2],
  bbox,
  generatedAt: new Date().toISOString(),
  features: [...features.values()],
}
await writeFile(outputPath, `${JSON.stringify(merged)}\n`)
console.log(`Merged ${base.features.length} base features + ${addition.features.length} added features into ${merged.features.length} unique features`)
