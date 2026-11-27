import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson'

// HSL fare zones (A–E), fetched from HSL's public ArcGIS service. The host must
// stay in connect-src in vercel.json.
export type TransitZoneCollection = FeatureCollection<Polygon | MultiPolygon>
export const emptyTransitZones: TransitZoneCollection = { type: 'FeatureCollection', features: [] }
const HSL_ZONES_URL = 'https://services1.arcgis.com/sswNXkUiRoWtrx0t/arcgis/rest/services/zones_all/FeatureServer/0/query?where=ZONE%20IN%20(%27A%27,%27B%27,%27C%27,%27D%27,%27E%27)&outFields=ZONE,NIMI_E&returnGeometry=true&outSR=4326&f=geojson'

export async function loadTransitZones(): Promise<TransitZoneCollection> {
  const response = await fetch(HSL_ZONES_URL, { cache: 'force-cache', headers: { Accept: 'application/geo+json,application/json' }, signal: AbortSignal.timeout(10_000) })
  if (!response.ok) throw new Error(`HSL fare zones unavailable (${response.status})`)
  const data = await response.json() as Partial<TransitZoneCollection> | null
  // ArcGIS answers some failures with HTTP 200 and an { error } body.
  if (!data || !Array.isArray(data.features)) throw new Error('HSL fare zones response has no features')
  return {
    type: 'FeatureCollection',
    features: data.features.flatMap((feature) => {
      const zone = String(feature.properties?.ZONE ?? feature.properties?.zone ?? '').trim().toUpperCase()
      if (!/^[A-E]$/.test(zone)) return []
      // HSL's ArcGIS zones_all dataset contains a 5-point rectangular cutout
      // artifact over Pasila station inside Zone A. Zone A is the innermost
      // fare zone and has no interior enclaves, so keep only its outer ring.
      const geometry = zone === 'A'
        ? feature.geometry.type === 'Polygon'
          ? { ...feature.geometry, coordinates: feature.geometry.coordinates.slice(0, 1) }
          : { ...feature.geometry, coordinates: feature.geometry.coordinates.map((polygon) => polygon.slice(0, 1)) }
        : feature.geometry
      return [{ ...feature, geometry, properties: { ...(feature.properties ?? {}), zone } }]
    }),
  }
}
