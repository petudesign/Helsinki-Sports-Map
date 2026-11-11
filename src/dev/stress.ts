/*
 * Worst-case data for UI stress testing. Development only: every entry point
 * checks import.meta.env.DEV, so production builds tree-shake this module away.
 *
 * Usage: http://localhost:4180/?stress=long,sports,many,missing
 *   long       overlong Finnish and English names, addresses and parent names
 *   sports     dozens of sports on the first venues
 *   many       ~8× the facilities (thousands of map points and list rows)
 *   missing    no price, address, opening hours or official details anywhere
 *   empty      starts with a search that returns nothing
 *   nolocation geolocation always fails with "permission denied"
 *   maperror   basemap style and raster fallback both fail
 *   dataerror  facility dataset fails to load
 *   all        long + sports + many + missing
 */
import type { MapDataset, SportFeature, SportsVenue } from '../data/types'

export type StressFlag = 'long' | 'sports' | 'many' | 'missing' | 'empty' | 'nolocation' | 'maperror' | 'dataerror'

let cachedFlags: Set<StressFlag> | undefined
function readFlags(): Set<StressFlag> {
  if (cachedFlags) return cachedFlags
  if (!import.meta.env.DEV || typeof window === 'undefined') return (cachedFlags = new Set())
  const raw = new URLSearchParams(window.location.search).get('stress')?.split(',').map((value) => value.trim()) ?? []
  const expanded = raw.flatMap((value) => value === 'all' ? ['long', 'sports', 'many', 'missing'] : [value])
  return (cachedFlags = new Set(expanded as StressFlag[]))
}

export const stressFlag = (flag: StressFlag) => readFlags().has(flag)
export const stressActive = () => readFlags().size > 0

const longNamesFi = [
  'Aaltosen monitoimiliikuntapuiston tekonurmikentän ja jäähallin yhteinen pukuhuone- ja huoltorakennus',
  'Alppiharjun–Kallion–Sörnäisten seudullinen ulkoliikunta-alue ja lähiliikuntapaikka (Torkkelinmäki)',
  'Arabianrannan rantapuiston beachvolley-, koripallo-, katusähly- ja parkour-kentät',
  'Aurinkolahden uimarannan talviuintipaikka, sauna ja pukeutumistilat (ylläpito: Helsingin kaupunki)',
  'Arabianrannanliikuntapuistontekonurmikenttä',
  'Ö',
]
const longNamesEn = [
  'Aaltonen Multi-Purpose Sports Park Artificial Turf Pitch and Ice Rink Shared Changing Room and Maintenance Building',
  'Alppiharju–Kallio–Sörnäinen Regional Outdoor Recreation Area and Neighbourhood Sports Ground (Torkkelinmäki)',
  'Arabianranta Waterfront Park Beach Volleyball, Basketball, Street Floorball and Parkour Courts',
  'Aurinkolahti Beach Winter Swimming Spot, Sauna and Changing Facilities (maintained by the City of Helsinki)',
  'Arabianrannanliikuntapuistontekonurmikenttä',
  'Ö',
]
const longAddress = 'Itäinen Rantakatu-Läntinen Rantakatu 1234 A 56, sisäänkäynti Urheilukadun puolelta, 00250 Helsinki / Östra Strandgatan 1234'
const manySports = ['football', 'basketball', 'athletics', 'swimming', 'outdoor_swimming', 'winter_swimming', 'ice_hockey', 'tennis', 'padel', 'volleyball', 'beachvolleyball', 'badminton', 'table_tennis', 'karate', 'golf', 'minigolf', 'canoe', 'canoe_polo', 'skateboarding', 'fitness', 'outdoor_fitness', 'skating', 'skiing', 'floorball', 'gymnastics', 'martial_arts', 'boxing', 'fencing', 'dance', 'bowling', 'shooting', 'parkour', 'climbing', 'petanque', 'running']

export function applyStress(data: MapDataset): MapDataset {
  const flags = readFlags()
  if (!flags.size) return data
  let sports = data.sports
  let venues = data.venues
  const venueById = new Map(venues.map((venue) => [venue.id, venue]))
  const sortedIds = [...sports].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'fi')).map(({ id }) => id)

  if (flags.has('long')) {
    const targets = new Set(sortedIds.slice(0, 12))
    let index = 0
    sports = sports.map((feature) => {
      if (!targets.has(feature.id)) return feature
      const i = index++ % longNamesFi.length
      const venue = venueById.get(feature.id)
      if (venue) venueById.set(feature.id, { ...venue, name: longNamesFi[i], lipas: { ...(venue.lipas ?? { id: 0, name: longNamesFi[i] }), name: longNamesFi[i], parentName: longNamesFi[(i + 1) % longNamesFi.length], address: longAddress } })
      return { ...feature, name: longNamesFi[i], nameEn: longNamesEn[i] }
    })
  }
  if (flags.has('sports')) {
    sortedIds.slice(0, 4).forEach((id) => {
      const venue = venueById.get(id)
      if (venue) venueById.set(id, { ...venue, sports: manySports })
    })
    sports = sports.map((feature) => sortedIds.slice(0, 4).includes(feature.id) ? { ...feature, sports: manySports } : feature)
  }
  if (flags.has('missing')) {
    sports = sports.map((feature) => ({ ...feature, priceClass: 'unknown' }))
    for (const [id, venue] of venueById) {
      venueById.set(id, {
        ...venue,
        priceClass: 'unknown',
        officialUrl: undefined,
        lipas: venue.lipas ? { ...venue.lipas, address: undefined, priceClass: 'unknown', accessStatus: 'unknown', accessNoteFi: undefined, accessNoteEn: undefined } : undefined,
        serviceMap: undefined,
      })
    }
  }
  venues = [...venueById.values()]
  if (flags.has('many')) {
    const copies = 7
    const extraSports: SportFeature[] = []
    const extraVenues: SportsVenue[] = []
    for (let copy = 1; copy <= copies; copy += 1) {
      sports.forEach((feature, index) => {
        const id = `${feature.id}~${copy}`
        const jitter = (seed: number) => Math.sin(seed * 12.9898 + copy * 78.233) * 0.02
        extraSports.push({ ...feature, id, center: feature.center ? [feature.center[0] + jitter(index), feature.center[1] + jitter(index + 0.5) / 2] : undefined })
        const venue = venueById.get(feature.id)
        if (venue) extraVenues.push({ ...venue, id })
      })
    }
    sports = [...sports, ...extraSports]
    venues = [...venues, ...extraVenues]
  }
  return { ...data, sports, venues }
}

export function installStressEnvironment() {
  if (!readFlags().has('nolocation') || !navigator.geolocation) return
  const denied = { code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: 'Stress test: permission denied' } as GeolocationPositionError
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (_ok: PositionCallback, fail?: PositionErrorCallback) => window.setTimeout(() => fail?.(denied), 300), watchPosition: () => 0, clearWatch: () => undefined } })
}

export const stressInitialSearch = () => readFlags().has('empty') ? 'Kuplahalli Atlantis' : ''

export const stressScenarios = ['off', 'all', 'long,sports', 'missing', 'empty', 'nolocation', 'maperror', 'dataerror'] as const
export const currentStress = () => (import.meta.env.DEV && typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('stress') : null) ?? 'off'
