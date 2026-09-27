// Keep facility geometry independent of the custom basemap. Run after OSM imports.
import { readFile, writeFile } from 'node:fs/promises'

const source = JSON.parse(await readFile(new URL('../src/data/helsinki-expanded.json', import.meta.url), 'utf8'))
const boundary = JSON.parse(await readFile(new URL('../src/data/helsinki-boundary.json', import.meta.url), 'utf8'))[0]
const [south, north, west, east] = boundary.boundingbox.map(Number)
const bbox = [west, south, east, north]
const center = [(west + east) / 2, (south + north) / 2]
const output = {
  ...source,
  name: 'Helsinki citywide sports map',
  center,
  bbox,
  features: source.features.filter((feature) => feature.properties.category === 'sport' && feature.properties.context !== 'neighboring'),
}
await writeFile(new URL('../src/data/venue-map.json', import.meta.url), JSON.stringify(output))
console.log(`Exported ${output.features.length} facility geometries; no basemap buildings, roads or trees.`)
