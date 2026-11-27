import type { ExpressionSpecification, Map as LibreMap } from 'maplibre-gl'
import type { Locale } from '../../i18n'
import { mapTheme as t } from '../../design-system/mapTheme'

/*
 * Quiet the OpenFreeMap Positron basemap so it reads as part of the product:
 * sentence-case regular labels in the text-3 grey (no tracked uppercase or
 * italics), no road shields, white roads on a hairline casing, and names in
 * the UI language where OpenStreetMap has them (name:en / name:fi).
 */
export function tuneBasemap(map: LibreMap, locale: Locale) {
  const set = (id: string, apply: () => void) => { if (map.getLayer(id)) { try { apply() } catch (error) { if (import.meta.env.DEV) console.warn(`Basemap tweak skipped for layer ${id}`, error) /* layer shape differs in a custom style */ } } }
  const localizedName: ExpressionSpecification = ['coalesce', ['get', `name:${locale}`], ['get', 'name:latin'], ['get', 'name']]
  for (const layer of map.getStyle().layers) {
    if (layer.type !== 'symbol') continue
    const sourceLayer = 'source-layer' in layer ? layer['source-layer'] : ''
    if (sourceLayer === 'place') set(layer.id, () => {
      map.setLayoutProperty(layer.id, 'text-transform', 'none')
      map.setLayoutProperty(layer.id, 'text-letter-spacing', 0)
      map.setLayoutProperty(layer.id, 'text-font', [layer.id.includes('capital') || layer.id.includes('country') ? 'Noto Sans Bold' : 'Noto Sans Regular'])
      map.setLayoutProperty(layer.id, 'text-field', localizedName)
      map.setPaintProperty(layer.id, 'text-color', layer.id.includes('city') ? t.ink : t.label)
      map.setPaintProperty(layer.id, 'text-halo-color', t.halo)
      map.setPaintProperty(layer.id, 'text-halo-width', 1.5)
    })
    if (sourceLayer === 'water_name' || sourceLayer === 'waterway') set(layer.id, () => {
      map.setLayoutProperty(layer.id, 'text-font', ['Noto Sans Regular'])
      map.setLayoutProperty(layer.id, 'text-letter-spacing', 0)
      map.setLayoutProperty(layer.id, 'text-field', localizedName)
      map.setPaintProperty(layer.id, 'text-color', t.waterLabel)
    })
    if (sourceLayer === 'transportation_name') set(layer.id, () => {
      if (layer.id.includes('shield')) { map.setLayoutProperty(layer.id, 'visibility', 'none'); return }
      map.setPaintProperty(layer.id, 'text-color', t.labelSoft)
    })
  }
  for (const id of ['highway_major_inner', 'highway_motorway_inner', 'highway_minor']) set(id, () => map.setPaintProperty(id, 'line-color', t.road))
  for (const id of ['highway_major_casing', 'highway_motorway_casing']) set(id, () => map.setPaintProperty(id, 'line-color', t.roadCasing))
  set('building', () => map.setPaintProperty('building', 'fill-color', t.building))
  set('landuse_residential', () => map.setPaintProperty('landuse_residential', 'fill-color', t.residential))
}
