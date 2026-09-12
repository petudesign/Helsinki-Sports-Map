import { mapLandmarks } from '../config/mapLandmarks'
import type { MapDataset } from '../data/types'
import { renderMap } from './mapRenderer'
import { createProjector } from './projection'
import type { BackgroundRequest } from './backgroundRenderer'

let area: MapDataset | undefined
const canvas = new OffscreenCanvas(1, 1)
canvas.getContext('2d', { alpha: false, willReadFrequently: true })
self.onmessage = (event: MessageEvent<BackgroundRequest>) => {
  const { id, view, width, height, dpr, selectedIds } = event.data
  try {
    area = event.data.area ?? area
    if (!area) throw new Error('Missing map background data')
    const padding = 160
    renderMap(canvas, area, view, mapLandmarks, { selectedSportIds: new Set(selectedIds) }, {
      backgroundOnly: true, size: { width, height, dpr, padding },
    })
    const projector = createProjector(area, width, height, view)
    const bitmap = canvas.transferToImageBitmap()
    self.postMessage({ id, frame: { bitmap, origin: projector.point({ x: 0, y: 0 }), scale: projector.scale, width, height, padding, mode: view.mode, zoom: view.zoom, view: { ...view, pan: { ...view.pan } } } }, { transfer: [bitmap] })
  } catch (error) {
    self.postMessage({ id, error: String(error) })
  }
}
