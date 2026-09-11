import lipasSnapshot from './lipas-helsinki.json'
import type { Bounds, GeoPoint, LipasVenue, MapPoint, PriceClass, SportFeature } from './types'
import { normalizeExternalUrl } from './urls'

type LipasSite = {
  id: number
  name: string
  website?: string
  type?: { fi?: string; en?: string }
  address?: string
  updatedAt?: string
  comment?: string
  properties?: Record<string, unknown>
  geometry?: { features?: { geometry?: { type: string; coordinates: unknown } }[] }
}

function firstCoordinate(site: LipasSite) {
  const feature = site.geometry?.features?.[0]?.geometry
  if (!feature) return undefined
  if (feature.type === 'Point' && Array.isArray(feature.coordinates)) return feature.coordinates as GeoPoint
  if (feature.type === 'LineString' && Array.isArray(feature.coordinates)) return feature.coordinates[0] as GeoPoint
  if (feature.type === 'Polygon' && Array.isArray(feature.coordinates)) return feature.coordinates[0]?.[0] as GeoPoint
  return undefined
}

function normalized(value: string) {
  return value.toLocaleLowerCase('fi-FI').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '')
}

function distanceSquared(a: GeoPoint, b: GeoPoint) {
  const latitudeScale = Math.cos(a[1] * Math.PI / 180)
  return ((a[0] - b[0]) * latitudeScale) ** 2 + (a[1] - b[1]) ** 2
}

function distanceMetres(a: GeoPoint, b: GeoPoint) {
  const latitudeScale = Math.cos(((a[1] + b[1]) / 2) * Math.PI / 180)
  return Math.sqrt(((a[0] - b[0]) * latitudeScale * 111_320) ** 2 + ((a[1] - b[1]) * 111_320) ** 2)
}

const sites = (lipasSnapshot.sites as LipasSite[]).flatMap((site) => {
  const coordinate = firstCoordinate(site)
  return coordinate ? [{ site, coordinate, normalizedName: normalized(site.name) }] : []
})

// LIPAS uses the generic “Ball field” category for these five fields, but
// their individual names and descriptions identify them as football fields.
// Keep this small and explicit instead of treating every generic ball field
// in Helsinki as football.
const curatedSportsBySite: Record<number, string[]> = {
  85946: ['soccer'],
  82858: ['soccer'],
  82861: ['soccer'],
  85198: ['soccer'],
  86486: ['soccer'],
}

function positiveProperty(site: LipasSite, key: string) {
  const value = site.properties?.[key]
  return typeof value === 'number' ? value > 0 : Array.isArray(value) ? value.length > 0 : value === true
}

export function sportsFromSite(site: LipasSite) {
  // Child records describe their own activity, not the parent venue or neighbours.
  const recordName = site.name.split(' / ').pop() ?? site.name
  const label = `${recordName} ${site.type?.fi ?? ''} ${site.type?.en ?? ''}`.toLocaleLowerCase('fi-FI')
  const identity = `${site.name} ${site.type?.fi ?? ''} ${site.type?.en ?? ''}`.toLocaleLowerCase('fi-FI')
  const isStandaloneRecord = !site.name.includes(' / ')
  const sports = new Set<string>()

  // “Ratagolf” records can mention the neighbouring tennis centre in their
  // description. Use the facility's own name/type for this classification so
  // that neighbouring-place text cannot turn minigolf into tennis.
  const isMinigolf = /ratagolf|minigolf|mini\s+golf/.test(identity)
  if (isMinigolf) sports.add('minigolf')

  // These fields describe actual provision in the LIPAS record. Prefer them
  // over guessing from a generic category such as “sports hall”.
  if (positiveProperty(site, 'football-fields-count') || positiveProperty(site, 'futsal-fields-count')) sports.add('soccer')
  if (positiveProperty(site, 'basketball-fields-count')) sports.add('basketball')
  if (positiveProperty(site, 'volleyball-fields-count')) sports.add('volleyball')
  if (positiveProperty(site, 'badminton-courts-count')) sports.add('badminton')
  if (positiveProperty(site, 'table-tennis-count')) sports.add('table_tennis')
  if (positiveProperty(site, 'tennis-courts-count')) sports.add('tennis')
  if (positiveProperty(site, 'pool-tracks-count') || positiveProperty(site, 'swimming-pool-count')) sports.add('swimming')
  if (positiveProperty(site, 'floorball-fields-count')) sports.add('floorball')
  if (positiveProperty(site, 'ice-rinks-count') && /jääkie|jäähalli|kilpajäähalli|harjoitusjäähalli|ice arena/.test(label)) sports.add('ice_hockey')
  if (positiveProperty(site, 'longjump-places-count') || positiveProperty(site, 'highjump-places-count') || positiveProperty(site, 'sprint-lanes-count') || positiveProperty(site, 'shotput-count') || positiveProperty(site, 'discus-throw-places') || positiveProperty(site, 'hammer-throw-places-count') || positiveProperty(site, 'javelin-throw-places-count')) sports.add('athletics')
  if (positiveProperty(site, 'exercise-machines-count') || positiveProperty(site, 'outdoor-exercise-machines?') || positiveProperty(site, 'outdoor-exercise-structures')) sports.add('outdoor_fitness')

  // A small, explicit type mapping covers categories where LIPAS has no
  // sport-specific count field. It deliberately distinguishes indoor gyms
  // from outdoor exercise places.
  if (/jalkapallostadion|jalkapallohalli|jalkapallokenttä|jalkapallomaal|futsal/.test(label)) sports.add('soccer')
  if (/yleisurheilu|juoksu|yleisurheilukenttä|yleisurheilun harjoitus/.test(label)) sports.add('athletics')
  if (/uinti|uimahalli|maauimala|uima-allastila/.test(label) && !/talviuinti|avantouinti/.test(label)) sports.add('swimming')
  // Keep ordinary swimming, outdoor swimming and winter swimming distinct.
  // Only standalone beach/pool records receive the outdoor category: child
  // records such as a pool's table-tennis area must not inherit it.
  if (isStandaloneRecord && /maauimala|uimastadion|ulkouimala|uimaranta|open-air pool|outdoor pool|public beach/.test(label)) sports.add('outdoor_swimming')
  if (/talviuinti|avantouinti/.test(label)) sports.add('winter_swimming')
  if (/jääkie|jäähalli|harjoitusjäähalli|kilpajäähalli|ice arena/.test(label)) sports.add('ice_hockey')
  if (/koripallo/.test(label)) sports.add('basketball')
  if (/tennis/.test(label.replace(/pöytätennis|table\s+tennis/g, '')) && !isMinigolf) sports.add('tennis')
  if (/padel/.test(label)) sports.add('padel')
  if (/ulkokuntoilupaikka/.test(label)) sports.add('outdoor_fitness')
  if (/kuntosali|kuntokeskus|voimailusali|painonnosto/.test(label)) sports.add('fitness')
  if (/luistelukenttä|luistelureitti|tekojäärata/.test(label)) sports.add('skating')
  if (/skeitt|rullalaut|rullaluist|potkulaut|skateboard|rollerblad|scooter/.test(label)) sports.add('skateboarding')
  if (/hiihtolatu/.test(label)) sports.add('skiing')
  if (/lentopallo|beachvolley/.test(label)) sports.add('volleyball')
  if (/sulkapallo/.test(label)) sports.add('badminton')
  if (/pöytätennis/.test(label)) sports.add('table_tennis')
  if (/salibandy|sähly|floorball/.test(label)) sports.add('floorball')
  if (/telinevoimistelu|voimistelu/.test(label)) sports.add('gymnastics')
  if (/kamppailulaj|judo|karate/.test(label)) sports.add('martial_arts')
  if (/nyrkkeily|boxing/.test(label)) sports.add('boxing')
  if (/miekkailu|fencing/.test(label)) sports.add('fencing')
  if (/tanssi|koreografia|ryhmäliikunta/.test(label)) sports.add('dance')
  if (/keilahalli|bowling/.test(label)) sports.add('bowling')
  if (/ampumarata|shooting range/.test(label)) sports.add('shooting')
  if (/parkour/.test(label)) sports.add('parkour')
  if (/kiipeily|climbing/.test(label)) sports.add('climbing')
  if (/petanque/.test(label)) sports.add('petanque')

  return [...new Set([...(curatedSportsBySite[site.id] ?? []), ...sports])]
}

export function explicitPrice(site: LipasSite): Exclude<PriceClass, 'mixed' | 'unknown'> | undefined {
  // A free-use flag is insufficient when the description states restrictions.
  if (/vain|ei vapaassa|ei maksuton|varau|jäsen|kesäisin|talvisin|pääsymaks|käyttömaks/i.test(site.comment ?? '')) return undefined
  if (site.properties?.['free-use?'] === true) return 'free'
  return undefined
}

export function priceClassForSites(members: LipasSite[]): PriceClass {
  const prices = members.map(explicitPrice)
  if (!prices.length || prices.includes(undefined)) return 'unknown'
  const hasFree = prices.includes('free')
  const hasPaid = prices.includes('paid')
  if (hasFree && hasPaid) return 'mixed'
  if (hasFree) return 'free'
  if (hasPaid) return 'paid'
  return 'unknown'
}

function iconFromSports(sports: string[]) {
  if (sports.length > 1) return 'multi' as const
  if (sports[0] === 'outdoor_fitness') return 'fitness' as const
  if (sports[0] === 'outdoor_swimming') return 'swimming' as const
  if (['soccer', 'athletics', 'swimming', 'ice_hockey', 'basketball', 'tennis'].includes(sports[0])) return sports[0] as 'football' | 'athletics' | 'swimming' | 'ice_hockey' | 'basketball' | 'tennis'
  return 'multi' as const
}

function isUserFacingSite(site: LipasSite) {
  const label = `${site.name} ${site.type?.fi ?? ''}`.toLocaleLowerCase('fi-FI')
  return !/huoltorakennus|veneilyn palvelupaikka|kalastuskohde|pysäköinti|katsomo|opastuspiste|\binfo\b/.test(label)
}

function venueGroupName(site: LipasSite) {
  const name = site.name.replace(/\s+\/.*$/, '')
  if (/^uimastadion/i.test(name)) return 'Uimastadion'
  if (/^olympiastadion/i.test(name)) return 'Olympiastadion'
  if (/^eläintarhan urheilukenttä/i.test(name)) return 'Eläintarhan urheilukenttä'
  return name
}

export function accessProfileForUrl(url: string | undefined) {
  if (/validia\.fi\/talo\/kuntoutuskeskus-synapsia/i.test(url ?? '')) {
    return {
      accessStatus: 'unknown' as const,
      accessNoteFi: 'Käyttöoikeutta ja hintoja ei ole ilmoitettu julkisesti. Tarkista Validialta ennen lähtöä, sopiiko tila omaan käyttöösi.',
      accessNoteEn: 'Public access and prices are not listed. Check with Validia before visiting to confirm whether the facility is available for your use.',
      accessSourceUrl: 'https://validia.fi/vammaispalvelut/kuntoutukseen-hakeminen/',
    }
  }
  return undefined
}

function shouldAlwaysGroup(groupName: string) {
  // These are named complexes/parks whose LIPAS sub-records should be
  // explored as one place instead of competing markers on the same area.
  return /^(uimastadion|olympiastadion|töölön kisahalli|eläintarhan urheilukenttä|violanpuisto)$/i.test(groupName)
}

function splitNearbyGroups(members: { site: LipasSite; coordinate: GeoPoint }[], groupName: string) {
  if (shouldAlwaysGroup(groupName)) return [members]
  const groups: { site: LipasSite; coordinate: GeoPoint }[][] = []
  members.forEach((member) => {
    const nearby = groups.find((group) => distanceMetres(member.coordinate, group[0].coordinate) <= 50)
    if (nearby) nearby.push(member)
    else groups.push([member])
  })
  return groups
}

function addressForCluster(cluster: { site: LipasSite; coordinate: GeoPoint }[]) {
  const addresses = [...new Set(cluster.map(({ site }) => site.address).filter((address): address is string => Boolean(address)))]
  const preciseAddresses = addresses.filter((address) => /\d/.test(address))
  return (preciseAddresses.length > 0 ? preciseAddresses : addresses).join(' / ')
}

function ringAround(point: MapPoint, radius = 5) {
  return Array.from({ length: 16 }, (_, index) => {
    const angle = index / 16 * Math.PI * 2
    return { x: point.x + Math.cos(angle) * radius, y: point.y + Math.sin(angle) * radius }
  })
}

function boundsOf(ring: MapPoint[]): Bounds {
  return ring.reduce((bounds, point) => ({
    minX: Math.min(bounds.minX, point.x), minY: Math.min(bounds.minY, point.y),
    maxX: Math.max(bounds.maxX, point.x), maxY: Math.max(bounds.maxY, point.y),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity })
}

export function createLipasFeatures(project: (point: GeoPoint) => MapPoint) {
  const features: SportFeature[] = []
  const venues: { id: string; venue: LipasVenue }[] = []
  const groups = new Map<string, { site: LipasSite; coordinate: GeoPoint }[]>()
  sites.filter(({ site }) => isUserFacingSite(site)).forEach(({ site, coordinate }) => {
    const key = venueGroupName(site)
    groups.set(key, [...(groups.get(key) ?? []), { site, coordinate }])
  })
  groups.forEach((members, groupName) => {
    const clusters = splitNearbyGroups(members, groupName)
    clusters.forEach((cluster) => {
      const totals = cluster.reduce<GeoPoint>((total, member) => [total[0] + member.coordinate[0], total[1] + member.coordinate[1]], [0, 0])
      const coordinate: GeoPoint = [totals[0] / cluster.length, totals[1] / cluster.length]
      const point = project(coordinate)
      const ring = ringAround(point)
      const sports = [...new Set(cluster.flatMap(({ site }) => sportsFromSite(site)))]
      const priceClass = priceClassForSites(cluster.map(({ site }) => site))
      const representative = cluster.find(({ site }) => /yleisurheilukenttä|jalkapallostadion|maauimala|uimahalli/i.test(site.type?.fi ?? '')) ?? cluster[0]
      // Address is shown as a separate field in the card, not in the name.
      const displayName = groupName
      const id = `lipas-group:${groupName}:${representative.site.id}`
      features.push({ id, name: displayName, sport: sports[0] ?? 'multi', sports, priceClass, facilityType: `${cluster.length} facilities`, icon: iconFromSports(sports), rings: [ring], bounds: boundsOf(ring), center: coordinate })
      venues.push({ id, venue: { id: representative.site.id, name: displayName, typeName: cluster.length > 1 ? `${cluster.length} liikuntapaikkaa` : representative.site.type?.fi, typeNameEn: cluster.length > 1 ? `${cluster.length} sports facilities` : representative.site.type?.en, website: normalizeExternalUrl(representative.site.website), address: addressForCluster(cluster), updatedAt: representative.site.updatedAt, priceClass } })
    })
  })
  return { features, venues }
}

export function findLipasVenue(name: string | undefined, coordinate: GeoPoint): LipasVenue | undefined {
  if (!name) return undefined
  const normalizedName = normalized(name)
  const candidates = sites.filter(({ normalizedName: candidate }) => candidate.includes(normalizedName) || normalizedName.includes(candidate))
  const match = (candidates.length > 0 ? candidates : sites)
    .map((candidate) => ({ ...candidate, distance: distanceSquared(coordinate, candidate.coordinate) }))
    .sort((a, b) => a.distance - b.distance)[0]
  if (!match || match.distance > 0.000002) return undefined
  return {
    id: match.site.id,
    name: match.site.name,
    typeName: match.site.type?.fi,
    typeNameEn: match.site.type?.en,
    website: normalizeExternalUrl(match.site.website),
    address: match.site.address,
    updatedAt: match.site.updatedAt,
    priceClass: explicitPrice(match.site) ?? 'unknown',
    ...accessProfileForUrl(match.site.website),
  }
}
