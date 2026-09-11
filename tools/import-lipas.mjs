import { mkdir, writeFile } from 'node:fs/promises'

const api = 'https://api.lipas.fi/v2'
const pageSize = 100
const studyAreaBbox = { west: 24.88, south: 60.165, east: 24.98, north: 60.28 }

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
  return longitude >= studyAreaBbox.west && longitude <= studyAreaBbox.east && latitude >= studyAreaBbox.south && latitude <= studyAreaBbox.north
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
await writeFile('src/data/lipas-helsinki.json', `${JSON.stringify({
  source: 'https://api.lipas.fi/v2/sports-sites',
  license: 'CC BY 4.0',
  attribution: 'LIPAS, University of Jyväskylä',
  cityCode: 91,
  scope: 'Central and northern Helsinki study area bbox',
  importedAt: new Date().toISOString(),
  sites,
}, null, 2)}\n`)

console.log(`LIPAS import complete: ${sites.length} Helsinki sports sites`)
