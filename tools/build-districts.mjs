// npm run data:districts — Helsinki district names and label points for the
// starting-point search ("Kallio", "Kamppi", "Töölö"). Source: Helsinki's open
// district division (kartta.hel.fi WFS, CC BY 4.0). Output: src/data/districts.json
import fs from 'node:fs'

const WFS = 'https://kartta.hel.fi/ws/geoserver/avoindata/wfs'
// Largest to smallest: the same name in a smaller division wins (better point).
const LAYERS = [
  ['avoindata:Maavesi_peruspiirit', 'district'],
  ['avoindata:Kaupunginosajako', 'district'],
  ['avoindata:Maavesi_osa_alueet', 'subdistrict'],
]

async function features(typeName) {
  const params = new URLSearchParams({ service: 'WFS', version: '2.0.0', request: 'GetFeature', typeNames: typeName, outputFormat: 'application/json', srsName: 'EPSG:4326' })
  const response = await fetch(`${WFS}?${params}`)
  if (!response.ok) throw new Error(`${typeName}: HTTP ${response.status}`)
  return (await response.json()).features
}

// "ETU-TÖÖLÖ" → "Etu-Töölö"; names already in mixed case are kept.
function displayName(name) {
  const trimmed = name.trim().replace(/\s+/g, ' ')
  if (trimmed !== trimmed.toLocaleUpperCase('fi-FI')) return trimmed
  return trimmed.toLocaleLowerCase('fi-FI').replace(/(^|[\s-])(\p{L})/gu, (_, separator, letter) => separator + letter.toLocaleUpperCase('fi-FI'))
}

// Area-weighted centroid of the largest ring; if it falls outside (crescent
// shapes, islands), use the ring vertex closest to it instead.
function labelPoint(geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  const ringArea = (ring) => ring.reduce((sum, [x1, y1], i) => { const [x2, y2] = ring[(i + 1) % ring.length]; return sum + x1 * y2 - x2 * y1 }, 0) / 2
  const ring = polygons.map((polygon) => polygon[0]).sort((a, b) => Math.abs(ringArea(b)) - Math.abs(ringArea(a)))[0]
  const area = ringArea(ring)
  let cx = 0, cy = 0
  ring.forEach(([x1, y1], i) => { const [x2, y2] = ring[(i + 1) % ring.length]; const f = x1 * y2 - x2 * y1; cx += (x1 + x2) * f; cy += (y1 + y2) * f })
  const centroid = [cx / (6 * area), cy / (6 * area)]
  const inside = ring.reduce((acc, [xi, yi], i) => { const [xj, yj] = ring[(i + ring.length - 1) % ring.length]; return ((yi > centroid[1]) !== (yj > centroid[1]) && centroid[0] < ((xj - xi) * (centroid[1] - yi)) / (yj - yi) + xi) ? !acc : acc }, false)
  const point = inside ? centroid : ring.reduce((best, p) => Math.hypot(p[0] - centroid[0], p[1] - centroid[1]) < Math.hypot(best[0] - centroid[0], best[1] - centroid[1]) ? p : best)
  return point.map((value) => Number(value.toFixed(5)))
}

const byName = new Map()
for (const [layer] of LAYERS) {
  for (const feature of await features(layer)) {
    const fi = feature.properties?.nimi_fi
    if (!fi || !feature.geometry) continue
    const name = displayName(fi)
    const sv = feature.properties?.nimi_se ? displayName(feature.properties.nimi_se) : undefined
    byName.set(name.toLocaleLowerCase('fi-FI'), { name, ...(sv && sv !== name ? { sv } : {}), point: labelPoint(feature.geometry) })
  }
}

const districts = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, 'fi'))
fs.writeFileSync(new URL('../src/data/districts.json', import.meta.url), `${JSON.stringify(districts)}\n`)
console.log(`${districts.length} districts → src/data/districts.json`)
