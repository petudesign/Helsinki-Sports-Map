import type { MapDataset, StudyAreaGeoJson } from '../data/types'

// Venue data is loaded once. Moving the map only requests basemap tiles.
let dataset: Promise<MapDataset> | undefined
export const activeCity = {
  id: 'helsinki',
  displayName: 'Helsinki',
  center: [24.94, 60.19] as [number, number],
  coverage: [24.76, 60.12, 25, 60.3] as [number, number, number, number],
  loadDataset() {
    dataset ??= Promise.all([import('../data/area'), import('../data/venue-map.json')])
      .then(([{ createArea }, { default: geometry }]) => createArea(geometry as unknown as StudyAreaGeoJson))
      .catch((error) => { dataset = undefined; throw error })
    return dataset
  },
}
