import districts from './data/districts.json'
import { distanceMetres } from './data/geometry'
import type { GeoPoint, SportFeature, SportsVenue } from './data/types'
import { sportText } from './i18n'

type DistrictEntry = { name: string; sv?: string; point: GeoPoint; keys: string[] }

const extraAreas: { name: string; aliases: string[]; point: GeoPoint }[] = [
  { name: 'Töölö', aliases: ['töölö', 'toolo', 'tölö'], point: [24.922, 60.179] },
  { name: 'Keskusta', aliases: ['keskusta', 'stadi', 'center', 'centre', 'city centre', 'city center', 'downtown'], point: [24.941, 60.17] },
  { name: 'Haaga', aliases: ['haaga'], point: [24.893, 60.221] },
  { name: 'Pasila', aliases: ['pasila', 'böle'], point: [24.928, 60.205] },
  { name: 'Pakila', aliases: ['pakila'], point: [24.944, 60.243] },
  { name: 'Malmi', aliases: ['malmi'], point: [25.022, 60.246] },
  { name: 'Malminkartano', aliases: ['malminkartano', 'maltsu'], point: [24.85929, 60.24742] },
  { name: 'Kannelmäki', aliases: ['kannelmäki', 'kantsu'], point: [24.88118, 60.2402] },
  { name: 'Pukinmäki', aliases: ['pukinmäki', 'puksu'], point: [24.98628, 60.24485] },
  { name: 'Vuosaari', aliases: ['vuosaari', 'vuokki', 'nordsjö'], point: [25.144, 60.209] },
  { name: 'Vartiokylä', aliases: ['vartiokylä', 'vartsari', 'vartsika'], point: [25.08293, 60.21407] },
  { name: 'Mellunmäki', aliases: ['mellunmäki', 'meltsi'], point: [25.12236, 60.23265] },
  { name: 'Herttoniemi', aliases: ['herttoniemi', 'hertsika'], point: [25.03453, 60.19964] },
  { name: 'Itäkeskus', aliases: ['itäkeskus', 'itis'], point: [25.07866, 60.208] },
  { name: 'Sörnäinen', aliases: ['sörnäinen', 'sornainen', 'sörkka', 'sörkkä', 'sorkka', 'sörnäis'], point: [24.968, 60.187] },
  { name: 'Kallio', aliases: ['kallio'], point: [24.94811, 60.18231] },
  { name: 'Kamppi', aliases: ['kamppi', 'kampi'], point: [24.93111, 60.16609] },
  { name: 'Lauttasaari', aliases: ['lauttasaari', 'laru'], point: [24.86892, 60.15704] },
  { name: 'Kaivopuisto', aliases: ['kaivopuisto', 'kaivari'], point: [24.95734, 60.15734] },
  { name: 'Kruununhaka', aliases: ['kruununhaka', 'kruna', 'krunikka'], point: [24.95673, 60.17272] },
  { name: 'Katajanokka', aliases: ['katajanokka', 'skatta'], point: [24.96887, 60.16686] },
  { name: 'Ruoholahti', aliases: ['ruoholahti', 'ruohis'], point: [24.90862, 60.16401] },
  { name: 'Punavuori', aliases: ['punavuori', 'röda', 'roba'], point: [24.93695, 60.16086] },
  { name: 'Jätkäsaari', aliases: ['jätkäsaari', 'jätkä'], point: [24.9133, 60.15549] },
  { name: 'Munkkiniemi', aliases: ['munkkiniemi', 'munkka'], point: [24.86392, 60.19453] },
  { name: 'Munkkivuori', aliases: ['munkkivuori', 'munksu'], point: [24.87116, 60.20865] },
  { name: 'Oulunkylä', aliases: ['oulunkylä', 'ogeli'], point: [24.94672, 60.22983] },
  { name: 'Pihlajamäki', aliases: ['pihlajamäki', 'pihlis'], point: [25.01073, 60.23615] },
  { name: 'Pitäjänmäki', aliases: ['pitäjänmäki', 'pitsku'], point: [24.86019, 60.22149] },
  { name: 'Roihuvuori', aliases: ['roihuvuori', 'roihis', 'roihika'], point: [25.05724, 60.19948] },
  { name: 'Jakomäki', aliases: ['jakomäki', 'jakis'], point: [25.07831, 60.2591] },
  { name: 'Kontula', aliases: ['kontula', 'kondis'], point: [25.08507, 60.23433] },
  { name: 'Suomenlinna', aliases: ['suomenlinna', 'suokki'], point: [25.00679, 60.13571] },
  { name: 'Hietaniemi', aliases: ['hietaniemi', 'hietsu', 'hietis'], point: [24.9065, 60.1745] },
  { name: 'Arabianranta', aliases: ['arabianranta', 'arabia'], point: [24.97599, 60.20536] },
  { name: 'Pirkkola', aliases: ['pirkkola', 'pirkkis'], point: [24.91279, 60.23319] },
  { name: 'Ruskeasuo', aliases: ['ruskeasuo', 'ruskis'], point: [24.90423, 60.20217] },
]

function fold(value: string) {
  return value.toLocaleLowerCase('fi-FI').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function buildDistrictKeys(raw: string) {
  const lower = raw.toLocaleLowerCase('fi-FI')
  const folded = fold(raw)
  const keys = new Set([lower, folded])
  // Handle common Finnish locative stems ("sörnäinen" → "sörnäis", "kamppi" → "kamp", "kallio" → "kallio").
  if (lower.endsWith('nen') && lower.length >= 6) {
    keys.add(`${lower.slice(0, -3)}s`)
    keys.add(`${folded.slice(0, -3)}s`)
  }
  return [...keys]
}

const districtEntries: DistrictEntry[] = [
  ...extraAreas.map((area) => ({
    name: area.name,
    point: area.point,
    keys: area.aliases.flatMap(buildDistrictKeys),
  })),
  ...(districts as { name: string; sv?: string; point: GeoPoint }[]).map((district) => ({
    name: district.name,
    sv: district.sv,
    point: district.point,
    keys: [district.name, district.sv].filter((v): v is string => Boolean(v)).flatMap(buildDistrictKeys),
  })),
]

function tokenMatchesDistrict(token: string, entry: DistrictEntry) {
  if (token.length < 3) return false
  const folded = fold(token)
  return entry.keys.some((key) => {
    if (key === token || key === folded) return true
    // Match Finnish inflections like "sörnäisissä", "kalliossa", "töölössä", "kampissa", "vuosaaressa".
    if (key.length >= 4 && (token.startsWith(key) || folded.startsWith(key)) && token.length <= key.length + 5) return true
    if (key.length >= 5 && key.endsWith('i') && (token.startsWith(key.slice(0, -1)) || folded.startsWith(key.slice(0, -1))) && token.length <= key.length + 4) return true
    return false
  })
}

export function findQueryDistrict(words: string[]): { district: DistrictEntry; remainingWords: string[] } | undefined {
  for (let index = 0; index < words.length; index++) {
    const word = words[index]
    const match = districtEntries.find((entry) => tokenMatchesDistrict(word, entry))
    if (match) {
      return { district: match, remainingWords: words.filter((_, i) => i !== index) }
    }
  }
  return undefined
}

// Common everyday Finnish & English search synonyms mapped to canonical sport tokens.
const querySynonyms: Record<string, string[]> = {
  football: ['football', 'soccer', 'jalkapallo'],
  soccer: ['soccer', 'football', 'jalkapallo'],
  futis: ['soccer', 'football', 'jalkapallo'],
  jalkapallo: ['jalkapallo', 'soccer', 'football'],
  futsal: ['futsal', 'soccer', 'jalkapallo'],
  gym: ['gym', 'kuntosali', 'kuntokeskus'],
  gyms: ['gym', 'kuntosali', 'kuntokeskus'],
  sali: ['kuntosali', 'kuntokeskus', 'gym'],
  kuntosali: ['kuntosali', 'kuntokeskus', 'gym'],
  workout: ['outdoor gym', 'ulkokuntosali', 'gym'],
  swimming: ['swimming', 'uinti', 'uimahalli'],
  swim: ['swimming', 'uinti', 'uimahalli'],
  pool: ['swimming', 'uimahalli', 'maauimala', 'pool'],
  pools: ['swimming', 'uimahalli', 'maauimala', 'pool'],
  uimahalli: ['uimahalli', 'swimming', 'uinti'],
  beach: ['outdoor swimming', 'uimaranta', 'beach'],
  uimaranta: ['uimaranta', 'outdoor swimming'],
  basketball: ['basketball', 'koripallo'],
  basket: ['basketball', 'koripallo'],
  koris: ['koripallo', 'basketball'],
  koripallo: ['koripallo', 'basketball'],
  tennis: ['tennis'],
  padel: ['padel'],
  volleyball: ['volleyball', 'lentopallo'],
  lentis: ['lentopallo', 'volleyball'],
  badminton: ['badminton', 'sulkapallo'],
  sulkkis: ['sulkapallo', 'badminton'],
  hockey: ['ice hockey', 'jääkiekko', 'jäähalli'],
  lätkä: ['jääkiekko', 'jäähalli', 'ice hockey'],
  skating: ['skating', 'luistelu', 'luistelukenttä'],
  skate: ['skateboarding', 'skeittaus', 'skeitti'],
  skatepark: ['skateboarding', 'skeittaus', 'skeitti'],
  skeitti: ['skeittaus', 'skateboarding'],
  floorball: ['floorball', 'salibandy'],
  sähly: ['salibandy', 'floorball'],
  climbing: ['climbing', 'kiipeily'],
  bouldering: ['climbing', 'kiipeily'],
  running: ['athletics', 'yleisurheilu', 'juoksu'],
  track: ['athletics', 'yleisurheilu'],
  ski: ['skiing', 'hiihto', 'hiihtolatu'],
  skiing: ['skiing', 'hiihto', 'hiihtolatu'],
  mansku: ['mannerheimintie'],
  hesari: ['helsinginkatu'],
  kisis: ['kisahalli'],
  stadikka: ['olympiastadion', 'uimastadion'],
}

// Short words that must match whole tokens so they don't match unrelated words (e.g. "gym" ≠ "gymnastics" / "gymnasium").
const exactTokenWords = new Set(['gym', 'gyms', 'pool', 'pools', 'ski', 'swim', 'run', 'bar'])

export type SearchEntry = {
  namesFolded: string
  namesTokens: Set<string>
  typesFolded: string
  typesTokens: Set<string>
  sportsFolded: string
  sportsTokens: Set<string>
  allFolded: string
  allTokens: Set<string>
  allTokenList: string[]
  isIndoorGym: boolean
  isSwimmingPool: boolean
  center?: GeoPoint
}

function packField(items: (string | undefined)[], expandSport = false) {
  const unique = new Set<string>()
  for (const item of items) {
    if (!item) continue
    unique.add(fold(item))
    if (expandSport) {
      unique.add(fold(sportText('en', item)))
      unique.add(fold(sportText('fi', item)))
    }
  }
  const folded = [...unique].join(' ')
  const tokenList = folded ? folded.split(/[^\p{L}\p{N}]+/u).filter(Boolean) : []
  return { folded, tokens: new Set(tokenList), tokenList }
}

export function buildSearchEntry(feature: SportFeature, venue: SportsVenue | undefined): SearchEntry {
  const names = packField([feature.name, feature.nameEn, venue?.name, venue?.lipas?.name])
  const types = packField([venue?.lipas?.typeName, venue?.lipas?.typeNameEn, feature.facilityType])
  const sports = packField([feature.sport, ...(feature.sports ?? [])], true)
  const details = packField([
    venue?.lipas?.parentName,
    venue?.lipas?.address,
    ...(venue?.lipas?.facilities ?? []).flatMap(({ name, typeName, typeNameEn, address }) => [name, typeName, typeNameEn, address]),
  ])
  const allFolded = `${names.folded} ${types.folded} ${sports.folded} ${details.folded}`.trim()
  const allTokens = new Set<string>([...names.tokens, ...types.tokens, ...sports.tokens, ...details.tokens])
  const allTokenList = [...allTokens]
  const sportList = feature.sports ?? [feature.sport]
  const isIndoorGym = Boolean(
    sportList.includes('fitness')
    || /kuntosali|kuntokeskus|voimailusali|\bgym\b/i.test(`${feature.name ?? ''} ${venue?.lipas?.typeName ?? ''} ${venue?.lipas?.typeNameEn ?? ''}`),
  )
  const isSwimmingPool = Boolean(
    sportList.includes('swimming')
    || /uimahalli|maauimala|uimastadion/i.test(`${feature.name ?? ''} ${venue?.lipas?.typeName ?? ''}`),
  )
  return {
    namesFolded: names.folded,
    namesTokens: names.tokens,
    typesFolded: types.folded,
    typesTokens: types.tokens,
    sportsFolded: sports.folded,
    sportsTokens: sports.tokens,
    allFolded,
    allTokens,
    allTokenList,
    isIndoorGym,
    isSwimmingPool,
    center: feature.center,
  }
}

type CompiledWord = {
  terms: { folded: string; exact: boolean; stems: string[] }[]
}

function compileWord(word: string): CompiledWord {
  const candidates = querySynonyms[word] ?? [word]
  return {
    terms: candidates.map((term) => {
      const folded = fold(term)
      const exact = exactTokenWords.has(term)
      const stems = exact ? [] : [folded.length >= 6 ? folded.slice(0, -1) : '', folded.length >= 8 ? folded.slice(0, -2) : ''].filter(Boolean)
      return { folded, exact, stems }
    }),
  }
}

function matchesPacked(folded: string, tokens: Set<string>, tokenList: string[] | undefined, compiled: CompiledWord) {
  return compiled.terms.some(({ folded: term, exact, stems }) => {
    if (exact) return tokens.has(term)
    if (folded.includes(term)) return true
    if (!stems.length || !tokenList) return false
    return stems.some((stem) => tokenList.some((part) => part.startsWith(stem) && part.length <= stem.length + 4))
  })
}

export type ParsedSearch = {
  raw: string
  words: string[]
  compiledRaw: CompiledWord[]
  area?: { name: string; point: GeoPoint }
  halfwayAreas?: [{ name: string; point: GeoPoint }, { name: string; point: GeoPoint }]
  contentWords: string[]
  compiledContent: CompiledWord[]
  wantsGym: boolean
  wantsPool: boolean
  wantsOutdoor: boolean
}

const halfwayFillerWords = new Set(['ja', 'and', 'tai', 'or', 'välillä', 'valilla', 'välissä', 'valissa', 'puoliväli', 'puolivali', 'puolivälissä', 'puolivalissa', 'between', 'halfway', 'vs'])

export function parseSearchQuery(rawQuery: string): ParsedSearch {
  const raw = rawQuery.trim().toLocaleLowerCase('fi-FI')
  if (!raw) {
    return { raw: '', words: [], compiledRaw: [], contentWords: [], compiledContent: [], wantsGym: false, wantsPool: false, wantsOutdoor: false }
  }
  const words = raw.split(/[\s,+/&–—↔→-]+/).filter(Boolean)
  const areaMatch = findQueryDistrict(words)
  const secondAreaMatch = areaMatch ? findQueryDistrict(areaMatch.remainingWords) : undefined
  const isTwoDistinctAreas = Boolean(areaMatch && secondAreaMatch && areaMatch.district.name !== secondAreaMatch.district.name)
  const halfwayAreas: ParsedSearch['halfwayAreas'] = isTwoDistinctAreas && areaMatch && secondAreaMatch
    ? [
      { name: areaMatch.district.name, point: areaMatch.district.point },
      { name: secondAreaMatch.district.name, point: secondAreaMatch.district.point },
    ]
    : undefined
  const area = !halfwayAreas && areaMatch ? { name: areaMatch.district.name, point: areaMatch.district.point } : undefined
  const contentWords = halfwayAreas && secondAreaMatch
    ? secondAreaMatch.remainingWords.filter((word) => !halfwayFillerWords.has(word))
    : areaMatch
      ? areaMatch.remainingWords
      : words
  const wantsOutdoor = contentWords.some((word) => word.includes('outdoor') || word.includes('ulko'))
  const wantsGym = !wantsOutdoor && contentWords.some((word) => ['gym', 'gyms', 'kuntosali', 'kuntokeskus', 'sali'].includes(word))
  const wantsPool = !wantsOutdoor && contentWords.some((word) => ['pool', 'pools', 'swimming', 'swim', 'uimahalli'].includes(word))
  return {
    raw,
    words,
    compiledRaw: words.map(compileWord),
    area,
    halfwayAreas,
    contentWords,
    compiledContent: contentWords.map(compileWord),
    wantsGym,
    wantsPool,
    wantsOutdoor,
  }
}

const AREA_RADIUS_METRES = 1200
const AREA_FALLBACK_RADIUS_METRES = 2500

export function evaluateSearchMatch(entry: SearchEntry | undefined, parsed: ParsedSearch, maxAreaRadius = AREA_RADIUS_METRES): { matched: boolean; score: number; areaDistance?: number } {
  if (!parsed.raw) return { matched: true, score: 1 }
  if (!entry) return { matched: false, score: 0 }

  // Case 0: Two districts in search (e.g. "Kallio ja Lauttasaari", "padel Kamppi Töölö") — meet halfway!
  if (parsed.halfwayAreas) {
    if (!entry.center) return { matched: false, score: 0 }
    const words = parsed.compiledContent
    if (words.length > 0 && !words.every((word) => matchesPacked(entry.allFolded, entry.allTokens, entry.allTokenList, word))) {
      return { matched: false, score: 0 }
    }
    const [a, b] = parsed.halfwayAreas
    const span = distanceMetres(a.point, b.point)
    const distA = distanceMetres(a.point, entry.center)
    const distB = distanceMetres(b.point, entry.center)
    const maxAllowed = Math.max(2500, span * 0.9)
    if (Math.max(distA, distB) > maxAllowed) return { matched: false, score: 0 }
    const fairness = Math.max(distA, distB) + 0.35 * Math.abs(distA - distB)
    return { matched: true, score: Math.max(1, 10000 - fairness), areaDistance: fairness }
  }

  // Case 1: District-only search (e.g. "sörnäinen", "kamppi") — include name/address matches AND nearby venues within 1.2 km.
  if (parsed.area && parsed.compiledContent.length === 0) {
    const directNameMatch = parsed.compiledRaw.every((word) => matchesPacked(entry.allFolded, entry.allTokens, entry.allTokenList, word))
    const dist = entry.center ? distanceMetres(parsed.area.point, entry.center) : undefined
    if (!directNameMatch && (dist === undefined || dist > maxAreaRadius)) return { matched: false, score: 0 }
    const score = (directNameMatch ? 500 : 100) + (dist !== undefined ? Math.max(0, maxAreaRadius - dist) / 10 : 0)
    return { matched: true, score, areaDistance: dist }
  }

  // Case 2: Sport/topic + optional district (e.g. "football sörnäinen", "gym kallio").
  const words = parsed.compiledContent
  if (!words.every((word) => matchesPacked(entry.allFolded, entry.allTokens, entry.allTokenList, word))) {
    if (!parsed.area || !parsed.compiledRaw.every((word) => matchesPacked(entry.allFolded, entry.allTokens, entry.allTokenList, word))) {
      return { matched: false, score: 0 }
    }
  }

  if (parsed.area && entry.center) {
    const dist = distanceMetres(parsed.area.point, entry.center)
    if (dist > maxAreaRadius) return { matched: false, score: 0 }
    return { matched: true, score: 100, areaDistance: dist }
  }

  let score = 100
  if (words.every((word) => matchesPacked(entry.namesFolded, entry.namesTokens, undefined, word))) score += 300
  else if (words.some((word) => matchesPacked(entry.namesFolded, entry.namesTokens, undefined, word))) score += 160
  if (words.every((word) => matchesPacked(entry.typesFolded, entry.typesTokens, undefined, word))) score += 140
  if (words.every((word) => matchesPacked(entry.sportsFolded, entry.sportsTokens, undefined, word))) score += 80
  if (parsed.wantsGym && entry.isIndoorGym) score += 220
  if (parsed.wantsPool && entry.isSwimmingPool) score += 180

  return { matched: true, score }
}

export { AREA_FALLBACK_RADIUS_METRES }
