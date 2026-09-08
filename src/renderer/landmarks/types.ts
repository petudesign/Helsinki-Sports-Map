import type { BuildingFeature, MapDataset, SportFeature } from '../../data/types'
import type { Projector, View } from '../projection'

export type LandmarkRenderContext = {
  ctx: CanvasRenderingContext2D
  area: MapDataset
  features: SportFeature[]
  projector: Projector
  view: View
}

export type LandmarkRenderer = {
  id: string
  selectionHeight?: number
  select(features: SportFeature[]): SportFeature[]
  suppressBuilding?(building: BuildingFeature, features: SportFeature[]): boolean
  render(context: LandmarkRenderContext): void
}
