import { type RemixiconComponentType, RiApps2Line, RiBasketballLine, RiBoxingLine, RiBus2Line, RiCommunityLine, RiFootballLine, RiFootprintLine, RiLeafLine, RiMapPin2Line, RiMedal2Line, RiPingPongLine, RiRoadMapLine, RiRunLine, RiShipLine, RiStore2Line, RiSubwayLine, RiTrainLine, RiWalkLine, RiWaterFlashLine, RiWaterPercentLine, RiWeightLine } from '@remixicon/react'
import type { AddressSuggestion } from '../geocoding'
import type { SportFeature } from '../data/types'
import { matchesFilter, type SportFilter } from '../filters'

const sportIcons: Record<SportFilter, RemixiconComponentType> = {
  all: RiApps2Line,
  football: RiFootballLine,
  basketball: RiBasketballLine,
  outdoor: RiLeafLine,
  gym: RiWeightLine,
  athletics: RiRunLine,
  swimming: RiWaterFlashLine,
  outdoor_swimming: RiWaterPercentLine,
  ice_hockey: RiMedal2Line,
  tennis: RiPingPongLine,
  padel: RiPingPongLine,
  martial_arts: RiBoxingLine,
  skateboarding: RiFootprintLine,
}

// The row's leading tile shows the most specific sport the place offers; specific sports win over "gym" and "outdoor".
const tilePriority: SportFilter[] = ['swimming', 'outdoor_swimming', 'ice_hockey', 'tennis', 'padel', 'basketball', 'football', 'athletics', 'skateboarding', 'martial_arts', 'gym']
export function PlaceTile({ feature }: { feature: SportFeature }) {
  const id = tilePriority.find((option) => matchesFilter(feature, option))
  const Icon = id ? sportIcons[id] : RiMapPin2Line
  return <span className="place-tile" aria-hidden="true"><Icon size={18} /></span>
}

export function SportFilterIcon({ id }: { id: SportFilter }) {
  const Icon = sportIcons[id]
  return <Icon className="sport-filter-icon" aria-hidden="true" size={15} />
}

export function TransitLegIcon({ mode }: { mode: string }) {
  const normalizedMode = mode.toUpperCase()
  const Icon = normalizedMode === 'WALK' ? RiWalkLine : normalizedMode === 'BUS' ? RiBus2Line : normalizedMode === 'TRAM' ? RiTrainLine : normalizedMode === 'RAIL' ? RiTrainLine : normalizedMode === 'SUBWAY' ? RiSubwayLine : normalizedMode === 'FERRY' ? RiShipLine : RiBus2Line
  return <Icon aria-hidden="true" size={17} />
}

export function SuggestionIcon({ kind }: { kind?: AddressSuggestion['kind'] }) {
  const Icon = kind === 'area' ? RiCommunityLine : kind === 'station' ? RiSubwayLine : kind === 'place' ? RiStore2Line : RiRoadMapLine
  return <Icon aria-hidden="true" size={16} className="suggestion-icon" />
}
