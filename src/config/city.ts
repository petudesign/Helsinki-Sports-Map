import { createChunkedAreaLoader } from '../data/area'
import type { MapChunkManifest, MapDataset, MapLabel, MapViewport, StudyAreaGeoJson } from '../data/types'
import { olympicAreaLandmarks } from '../renderer/landmarks/olympicArea'
import type { LandmarkRenderer } from '../renderer/landmarks/types'

export type CityConfig = {
  id: string
  displayName: string
  areaLabel: string
  loadDataset: () => Promise<MapDataset>
  loadDatasetForViewport?: (viewport: MapViewport) => Promise<MapDataset>
  landmarks: LandmarkRenderer[]
  mapLabels: MapLabel[]
}

const helsinkiChunkLoaders = import.meta.glob('../data/map-chunks/helsinki-expanded/[0-5]-[0-3].json', { import: 'default' }) as Record<string, () => Promise<StudyAreaGeoJson>>
const helsinkiDataLoader = createChunkedAreaLoader({
  loadManifest: () => import('../data/map-chunks/helsinki-expanded/manifest.json').then(({ default: manifest }) => manifest as unknown as MapChunkManifest),
  loadOverview: () => import('../data/map-chunks/helsinki-expanded/overview.json').then(({ default: overview }) => overview as unknown as StudyAreaGeoJson),
  loadChunk: (file) => {
    const entry = Object.entries(helsinkiChunkLoaders).find(([key]) => key.endsWith(`/${file}`))
    if (!entry) throw new Error(`Missing Helsinki map chunk: ${file}`)
    return entry[1]()
  },
})

const helsinki: CityConfig = {
  id: 'helsinki',
  displayName: 'Helsinki',
  areaLabel: 'Helsinki / central and northern districts',
  loadDataset: helsinkiDataLoader.loadDataset,
  loadDatasetForViewport: helsinkiDataLoader.loadDatasetForViewport,
  landmarks: olympicAreaLandmarks,
  mapLabels: [
    { text: 'TÖÖLÖ', coordinates: [24.918, 60.1858], tone: 'primary', offset: { x: -42, y: 0 } },
    { text: 'MEILAHTI', coordinates: [24.913, 60.1915], tone: 'primary', offset: { x: -48, y: 0 } },
    { text: 'PASILA', coordinates: [24.9345, 60.1955], tone: 'primary', offset: { x: 44, y: -18 } },
    { text: 'KALLIO', coordinates: [24.950, 60.190], tone: 'primary', offset: { x: 42, y: 0 } },
    { text: 'ETU-TÖÖLÖ', coordinates: [24.914, 60.177], minZoom: 1.35, tone: 'secondary', offset: { x: -42, y: 0 } },
    { text: 'TAKA-TÖÖLÖ', coordinates: [24.928, 60.184], minZoom: 1.35, tone: 'secondary', offset: { x: 48, y: 0 } },
    { text: 'ALPPILA', coordinates: [24.946, 60.198], minZoom: 1.35, tone: 'secondary', offset: { x: 36, y: -18 } },
    { text: 'RUSKEASUO', coordinates: [24.905, 60.197], minZoom: 1.35, tone: 'secondary', offset: { x: -46, y: -14 } },
    { text: 'VALLILA', coordinates: [24.958, 60.198], minZoom: 1.35, tone: 'secondary', offset: { x: 38, y: 0 } },
    { text: 'HERMANNI', coordinates: [24.967, 60.204], minZoom: 1.35, tone: 'secondary', offset: { x: 42, y: -18 } },
    { text: 'SÖRNÄINEN', coordinates: [24.965, 60.188], minZoom: 1.35, tone: 'secondary', offset: { x: 44, y: 18 } },
    { text: 'KÄPYLÄ', coordinates: [24.95, 60.215], tone: 'secondary', offset: { x: 38, y: 0 } },
    { text: 'OULUNKYLÄ', coordinates: [24.966, 60.229], tone: 'secondary', offset: { x: 44, y: 0 } },
    { text: 'MAUNULA', coordinates: [24.925, 60.223], tone: 'secondary', offset: { x: -42, y: 0 } },
    { text: 'PAKILA', coordinates: [24.93, 60.25], tone: 'secondary', offset: { x: 38, y: 0 } },
  ],
}

// The product currently runs on Helsinki only. A future city is added here,
// then selected by changing this one assignment — not by changing App or the renderer.
export const activeCity: CityConfig = helsinki
