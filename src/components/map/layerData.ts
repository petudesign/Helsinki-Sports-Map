import type { FeatureCollection, LineString, Point } from 'geojson'
import type { SportFeature } from '../../data/types'
import type { RouteResult } from '../../routing'
import { text, type Locale } from '../../i18n'
import { transitModeLabel } from '../../format'

// GeoJSON builders for the map's facility, route and route-stop sources.
export const empty: FeatureCollection = { type: 'FeatureCollection', features: [] }

// Map labels stay short; the full name is always in the panel.
const mapLabel = (name: string) => name.length > 36 ? `${name.slice(0, 34).trimEnd()}…` : name

export function pointData(features: SportFeature[], locale: Locale): FeatureCollection<Point> {
  return { type: 'FeatureCollection', features: features.flatMap((feature) => feature.center ? [{
    type: 'Feature' as const, id: feature.id,
    properties: { id: feature.id, name: mapLabel(locale === 'en' ? feature.nameEn ?? feature.name ?? '' : feature.name ?? ''), sport: feature.sport },
    geometry: { type: 'Point' as const, coordinates: feature.center },
  }] : []) }
}

export function routeLineData(route: RouteResult | undefined): FeatureCollection<LineString> {
  if (!route) return empty as FeatureCollection<LineString>
  const transitLegs = route.transit?.legs ?? []
  const transitFeatures = transitLegs.flatMap((leg, index) => {
    const fallback = [
      leg.fromCoordinates ?? (index === 0 ? route.origin : undefined),
      leg.toCoordinates ?? (index === transitLegs.length - 1 ? route.destination : undefined),
    ].filter((coordinate): coordinate is [number, number] => Boolean(coordinate))
    const coordinates = leg.geometry && leg.geometry.length > 1 ? leg.geometry : fallback
    return coordinates.length > 1 ? [{ type: 'Feature' as const, properties: { mode: leg.mode.toLowerCase() }, geometry: { type: 'LineString' as const, coordinates } }] : []
  })
  if (transitFeatures.length) return { type: 'FeatureCollection', features: transitFeatures }
  return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { mode: route.mode }, geometry: { type: 'LineString', coordinates: route.coordinates } }] }
}

export function routePointData(route: RouteResult | undefined, locale: Locale): FeatureCollection<Point> {
  if (!route) return empty as FeatureCollection<Point>
  const events = (route.transit?.legs ?? []).flatMap((leg) => {
    if (leg.mode.toUpperCase() === 'WALK') return []
    return [
      leg.fromCoordinates ? { kind: 'board' as const, coordinates: leg.fromCoordinates, leg } : undefined,
      leg.toCoordinates ? { kind: 'alight' as const, coordinates: leg.toCoordinates, leg } : undefined,
    ].filter((event): event is NonNullable<typeof event> => Boolean(event))
  })
  const groups = new Map<string, typeof events>()
  for (const event of events) {
    const key = event.coordinates.map((value) => value.toFixed(6)).join(',')
    const group = groups.get(key) ?? []
    group.push(event)
    groups.set(key, group)
  }
  const stopFeatures = [...groups.values()].map((group) => {
    const [first] = group
    const board = group.find((event) => event.kind === 'board')
    const isTransfer = group.length > 1
    const label = isTransfer && board
      ? text(locale, 'transitChange', { mode: transitModeLabel(locale, board.leg.mode), route: board.leg.routeName ?? '—' })
      : first.kind === 'board'
        ? text(locale, 'transitBoard', { mode: transitModeLabel(locale, first.leg.mode), route: first.leg.routeName ?? '—' })
        : text(locale, 'transitAlight', { stop: first.leg.to ?? (locale === 'fi' ? 'määränpää' : 'destination') })
    return { type: 'Feature' as const, properties: { kind: isTransfer ? 'transfer' : first.kind, label }, geometry: { type: 'Point' as const, coordinates: first.coordinates } }
  })
  return {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { kind: 'start', label: locale === 'fi' ? 'Lähtö tästä' : 'Start here' }, geometry: { type: 'Point', coordinates: route.origin } },
      { type: 'Feature', properties: { kind: 'end', label: locale === 'fi' ? 'Perille' : 'Destination' }, geometry: { type: 'Point', coordinates: route.destination } },
      ...stopFeatures,
    ],
  }
}
