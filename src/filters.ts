import type { SportFeature, SportsVenue } from './data/types'

export type SportFilter = 'all' | 'football' | 'basketball' | 'outdoor' | 'gym' | 'athletics' | 'swimming' | 'outdoor_swimming' | 'ice_hockey' | 'tennis' | 'padel' | 'martial_arts' | 'skateboarding'

export type PriceFilter = 'all' | 'free' | 'paid'

export type AccessibilityFilter = 'all' | 'stepFreeEntrance' | 'accessibleToilet' | 'accessibleParking'

export type FamilyFilter = 'all' | 'family'

export const allFilterOptions: { id: SportFilter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'football', label: 'Football' }, { id: 'basketball', label: 'Basketball' }, { id: 'outdoor', label: 'Outdoor' }, { id: 'gym', label: 'Gym' },
  { id: 'athletics', label: 'Athletics' }, { id: 'swimming', label: 'Swimming' }, { id: 'outdoor_swimming', label: 'Outdoor swimming' }, { id: 'ice_hockey', label: 'Ice hockey' }, { id: 'tennis', label: 'Tennis' }, { id: 'padel', label: 'Padel' }, { id: 'martial_arts', label: 'Martial arts' }, { id: 'skateboarding', label: 'Skateboarding' },
]

const outdoorSports = new Set(['athletics', 'basketball', 'beachvolleyball', 'football', 'soccer', 'ice_hockey', 'outdoor_fitness', 'outdoor_swimming', 'padel', 'skateboarding', 'skating', 'skiing', 'tennis', 'volleyball'])

function isOutdoorFeature(feature: SportFeature) {
  const sports = feature.sports?.length ? feature.sports : [feature.sport]
  if (sports.some((sport) => outdoorSports.has(sport))) return true
  return /beach|court|field|fitness.station|hiihto|kenttä|kuntorata|luist|outdoor|park|pitch|puisto|ranta|rata|stadium|stadion|skate|track|trail|ulko|uimar/i.test(`${feature.name ?? ''} ${feature.facilityType ?? ''}`)
}

export function matchesFilter(feature: SportFeature, filter: SportFilter) {
  if (filter === 'all') return true
  const sports = feature.sports?.length ? feature.sports : [feature.sport]
  if (filter === 'football') return sports.some((sport) => ['soccer', 'football'].includes(sport))
  if (filter === 'basketball') return sports.includes('basketball')
  if (filter === 'outdoor') return isOutdoorFeature(feature)
  if (filter === 'gym') return sports.some((sport) => ['fitness', 'outdoor_fitness'].includes(sport))
  if (filter === 'athletics') return sports.some((sport) => ['athletics', 'running'].includes(sport))
  if (filter === 'skateboarding') return sports.some((sport) => ['skateboarding', 'skateboard', 'scooter', 'rollerblading'].includes(sport))
  return sports.includes(filter)
}

export function matchesPrice(feature: SportFeature, filter: PriceFilter) {
  return filter === 'all' || feature.priceClass === filter || feature.priceClass === 'mixed'
}

export function matchesAccessibility(venue: SportsVenue | undefined, filter: AccessibilityFilter) {
  if (filter === 'all') return true
  return venue?.serviceMap?.accessibility?.[filter] === 'yes'
}

export function matchesFamily(venue: SportsVenue | undefined, filter: FamilyFilter) {
  return filter === 'all' || Boolean(venue?.serviceMap?.familySignals.length)
}
