export const runtimePropertyKeys = [
  'football-fields-count',
  'futsal-fields-count',
  'basketball-fields-count',
  'volleyball-fields-count',
  'badminton-courts-count',
  'table-tennis-count',
  'tennis-courts-count',
  'pool-tracks-count',
  'swimming-pool-count',
  'floorball-fields-count',
  'ice-rinks-count',
  'longjump-places-count',
  'highjump-places-count',
  'sprint-lanes-count',
  'shotput-count',
  'discus-throw-places',
  'hammer-throw-places-count',
  'javelin-throw-places-count',
  'exercise-machines-count',
  'outdoor-exercise-machines?',
  'outdoor-exercise-structures',
  'free-use?',
]

export function runtimeSite(site) {
  const properties = Object.fromEntries(runtimePropertyKeys
    .filter((key) => site.properties?.[key] !== undefined)
    .map((key) => [key, site.properties[key]]))
  const firstGeometry = site.geometry?.features?.[0]?.geometry
  // The UI only consumes this anchor (see firstCoordinate in lipas.ts).
  // Keep full paths/polygons in the source snapshot, not the browser payload.
  const coordinate = firstGeometry?.type === 'Point' ? firstGeometry.coordinates
    : firstGeometry?.type === 'LineString' ? firstGeometry.coordinates[0]
      : firstGeometry?.type === 'Polygon' ? firstGeometry.coordinates[0]?.[0] : undefined
  return {
    id: site.id,
    name: site.name,
    website: site.website,
    type: site.type,
    address: site.address,
    geometry: coordinate ? { features: [{ geometry: { type: 'Point', coordinates: coordinate } }] } : undefined,
    properties,
    comment: site.comment,
    updatedAt: site.updatedAt,
  }
}

export function runtimeSnapshot(snapshot) {
  return {
    source: snapshot.source,
    license: snapshot.license,
    attribution: snapshot.attribution,
    cityCode: snapshot.cityCode,
    scope: snapshot.scope,
    importedAt: snapshot.importedAt,
    sites: snapshot.sites.map(runtimeSite),
  }
}
