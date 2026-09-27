import { mkdir, writeFile } from 'node:fs/promises'
import { runtimeSnapshot } from './lib/lipas-runtime.mjs'

const api = 'https://api.lipas.fi/v2'
const pageSize = 100
const boundary = JSON.parse(await readFile(new URL('../src/data/helsinki-boundary.json', import.meta.url), 'utf8'))[0]
const defaultBounds = {
  west: Number(boundary.boundingbox[2]),
  south: Number(boundary.boundingbox[0]),
  east: Number(boundary.boundingbox[3]),
  north: Number(boundary.boundingbox[1]),
}
const [westArg = String(defaultBounds.west), southArg = String(defaultBounds.south), eastArg = String(defaultBounds.east), northArg = String(defaultBounds.north), outputPath = 'src/data/lipas-helsinki.json', runtimeOutputPath = 'src/data/lipas-helsinki-runtime.json'] = process.argv.slice(2)
const helsinkiBbox = { west: Number(westArg), south: Number(southArg), east: Number(eastArg), north: Number(northArg) }
if (!Object.values(helsinkiBbox).every(Number.isFinite) || !(helsinkiBbox.west < helsinkiBbox.east && helsinkiBbox.south < helsinkiBbox.north)) throw new Error('Usage: node tools/import-lipas.mjs <west> <south> <east> <north> [output] [runtime-output]')

async function getJson(path) {
  const response = await fetch(`${api}${path}`)
  if (!response.ok) throw new Error(`LIPAS ${response.status}: ${path}`)
  return response.json()
}

const categories = await getJson('/sports-site-categories')
const categoryByCode = new Map(categories.map((category) => [category['type-code'], {
  fi: category.name?.fi,
  en: category.name?.en,
  geometryType: category['geometry-type'],
}]))

const firstPage = await getJson(`/sports-sites?city-codes=91&statuses=active%2Cout-of-service-temporarily&page-size=${pageSize}&page=1`)
const totalPages = firstPage.pagination['total-pages']
const pages = [firstPage]

for (let page = 2; page <= totalPages; page += 1) {
  pages.push(await getJson(`/sports-sites?city-codes=91&statuses=active%2Cout-of-service-temporarily&page-size=${pageSize}&page=${page}`))
  console.log(`Imported LIPAS page ${page}/${totalPages}`)
}

function firstCoordinate(geometry) {
  const coordinates = geometry?.features?.flatMap(({ geometry: featureGeometry }) => {
    if (featureGeometry?.type === 'Point') return [featureGeometry.coordinates]
    if (featureGeometry?.type === 'LineString') return featureGeometry.coordinates
    if (featureGeometry?.type === 'Polygon') return featureGeometry.coordinates[0]
    return []
  }) ?? []
  return coordinates[0]
}

const sites = pages.flatMap(({ items }) => items).filter((site) => {
  const [longitude, latitude] = firstCoordinate(site.location?.geometries) ?? []
  return longitude >= helsinkiBbox.west && longitude <= helsinkiBbox.east && latitude >= helsinkiBbox.south && latitude <= helsinkiBbox.north
}).map((site) => ({
  id: site['lipas-id'],
  name: site.name,
  website: site.www,
  status: site.status,
  typeCode: site.type?.['type-code'],
  type: categoryByCode.get(site.type?.['type-code']),
  address: site.location?.address,
  city: site.location?.city?.neighborhood,
  geometry: site.location?.geometries,
  properties: site.properties,
  comment: site.comment,
  updatedAt: site['event-date'],
}))

await mkdir('src/data', { recursive: true })
await mkdir(outputPath.includes('/') ? outputPath.slice(0, outputPath.lastIndexOf('/')) : '.', { recursive: true })
await mkdir(runtimeOutputPath.includes('/') ? runtimeOutputPath.slice(0, runtimeOutputPath.lastIndexOf('/')) : '.', { recursive: true })
const snapshot = {
  source: 'https://api.lipas.fi/v2/sports-sites',
  license: 'CC BY 4.0',
  attribution: 'LIPAS, University of Jyväskylä',
  cityCode: 91,
  scope: `Helsinki municipal bbox ${Object.values(helsinkiBbox).join(',')}`,
  importedAt: new Date().toISOString(),
  sites,
}
await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`)
await writeFile(runtimeOutputPath, `${JSON.stringify(runtimeSnapshot(snapshot))}\n`)

console.log(`LIPAS import complete: ${sites.length} Helsinki sports sites`)
