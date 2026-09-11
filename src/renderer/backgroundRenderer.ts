import type { MapDataset } from '../data/types'
import type { BackgroundFrame } from './mapRenderer'
import type { View } from './projection'

export type BackgroundRequest = {
  id: number; area?: MapDataset; view: View; width: number; height: number; dpr: number; selectedIds: string[]
}

// Keep one render in flight and replace its successor with the latest camera.
// Old bitmaps remain usable during gestures; their map coordinates stay fixed.
export function createBackgroundRenderer(onFrame: () => void) {
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return undefined
  let worker: Worker
  try { worker = new Worker(new URL('./background.worker.ts', import.meta.url), { type: 'module' }) } catch { return undefined }
  let failed = false
  let disposed = false
  let busy = false
  let serial = 0
  let frame: BackgroundFrame | null = null
  const overviews = new Map<View['mode'], BackgroundFrame>()
  const closeFrames = () => { for (const item of new Set([frame, ...overviews.values()])) item?.bitmap.close(); frame = null; overviews.clear() }
  let workerArea: MapDataset | undefined
  let latest: (BackgroundRequest & { area: MapDataset }) | undefined
  let sentId = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const fail = () => { failed = true; clearTimeout(timer); worker.terminate(); closeFrames(); if (!disposed) onFrame() }
  const send = () => {
    if (disposed || failed || busy || timer || !latest || sentId === latest.id) return
    busy = true
    const { area, ...request } = latest
    sentId = request.id
    try {
      worker.postMessage({ ...request, area: workerArea === area ? undefined : area })
      workerArea = area
    } catch { fail() }
  }
  worker.onerror = fail
  worker.onmessage = (event: MessageEvent<{ id: number; frame?: BackgroundFrame; error?: string }>) => {
    busy = false
    if (event.data.error || !event.data.frame) { fail(); return }
    const next = event.data.frame
    if (disposed || next.mode !== latest?.view.mode) next.bitmap.close()
    else {
      if (frame && overviews.get(frame.mode) !== frame) frame.bitmap.close()
      const overview = overviews.get(next.mode)
      if (next.zoom <= 1 && (!overview || next.zoom < overview.zoom)) {
        overview?.bitmap.close()
        overviews.set(next.mode, next)
      }
      frame = next
      onFrame()
    }
    send()
  }
  return {
    update(area: MapDataset, view: View, width: number, height: number, selectedIds: string[]) {
      if (failed) return undefined
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      if (!latest || latest.area !== area || latest.width !== width || latest.height !== height || latest.dpr !== dpr ||
        latest.view.mode !== view.mode || latest.view.zoom !== view.zoom || latest.view.pan.x !== view.pan.x || latest.view.pan.y !== view.pan.y ||
        latest.selectedIds.join('|') !== selectedIds.join('|')) {
        latest = { id: ++serial, area, view: { ...view, pan: { ...view.pan } }, width, height, dpr, selectedIds }
        clearTimeout(timer)
        // Do not let expensive raster work compete with an active wheel gesture.
        timer = setTimeout(() => { timer = undefined; send() }, frame ? 120 : 0)
      }
      return frame ? { ...frame, fallback: overviews.get(view.mode) === frame ? undefined : overviews.get(view.mode) } : null
    },
    dispose() { disposed = true; clearTimeout(timer); worker.terminate(); closeFrames() },
  }
}
