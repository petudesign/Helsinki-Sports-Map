import { readFile, writeFile } from 'node:fs/promises'

const [basePath, additionPath, outputPath] = process.argv.slice(2)
if (!basePath || !additionPath || !outputPath) throw new Error('Usage: node tools/merge-map-geojson.mjs <base> <addition> <output>')

const [base, addition] = await Promise.all([basePath, additionPath].map((path) => readFile(path, 'utf8').then(JSON.parse)))
const features = new Map()
for (const feature of [...base.features, ...addition.features]) {
  const key = feature.id ?? `${feature.properties?.category ?? 'feature'}:${JSON.stringify(feature.geometry)}`
  if (!features.has(key)) features.set(key, feature)
}

const merged = {
  ...base,
  name: 'Helsinki sports map expanded study area',
  center: [24.93, 60.2225],
  bbox: [24.88, 60.165, 24.98, 60.28],
  generatedAt: new Date().toISOString(),
  features: [...features.values()],
}
await writeFile(outputPath, `${JSON.stringify(merged)}\n`)
console.log(`Merged ${base.features.length} base features + ${addition.features.length} added features into ${merged.features.length} unique features`)
