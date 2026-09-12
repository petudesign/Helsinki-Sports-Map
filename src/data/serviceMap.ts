import payload from './service-map-kisahalli.json'
import snapshot from './service-map-helsinki.json'
import type { PriceClass } from './types'

export type TriState = 'yes' | 'no' | 'unknown'

export type VenueAccessibility = {
  stepFreeEntrance: TriState
  accessibleToilet: TriState
  accessibleParking: TriState
  lift: TriState
  ramp: TriState
  wheelchairSpace: TriState
  entranceSurface?: string
}

type ServiceMapConnection = {
  section_type: string
  name?: { fi?: string; en?: string }
  www?: { fi?: string; en?: string }
}

type ServiceMapPayload = {
  id: number
  name?: { fi?: string; en?: string }
  short_description?: { fi?: string; en?: string }
  description?: { fi?: string; en?: string }
  picture_url?: string
  street_address?: { fi?: string; en?: string }
  last_modified_time?: string
  connections?: ServiceMapConnection[]
  service_names_fi?: string[]
  service_names_en?: string[]
}

export type ServiceMapDetails = {
  id: number
  nameFi?: string
  nameEn?: string
  shortDescriptionFi?: string
  shortDescriptionEn?: string
  descriptionFi?: string
  descriptionEn?: string
  openingHoursFi?: string
  openingHoursEn?: string
  priceFi?: string
  priceEn?: string
  priceGroups: { heading: string; items: string[] }[]
  servicesFi: string[]
  servicesEn: string[]
  links: { labelFi: string; labelEn: string; url: string }[]
  pictureUrl?: string
  updatedAt?: string
  priceClass?: PriceClass
  usageStatus?: 'open' | 'restricted' | 'booking' | 'unknown'
  familySignals: string[]
  accessibility?: VenueAccessibility
  sourceUrl?: string
}

const source = payload as ServiceMapPayload

function openingHours(value: string | undefined, locale: 'fi' | 'en') {
  if (!value) return undefined
  const cleaned = value.replace(/^Valid for the time being:\s*/i, '').replace(/^Voimassa toistaiseksi:\s*/i, '').replace(/\s*–\s*/g, '\n')
  return cleaned.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const translated = locale === 'en'
      ? line.replace(/ma-pe/gi, 'Mon–Fri').replace(/la-su/gi, 'Sat–Sun').replace(/Sisäänpääsy päättyy kello 21/gi, 'entry ends at 21:00')
      : line.replace(/Mon-Fri/gi, 'Ma–pe').replace(/Sat-Sun/gi, 'La–su').replace(/entry ends at 21:00/gi, 'sisäänpääsy päättyy klo 21')
    return translated.replace(/(\d{1,2})\.(\d{2})/g, '$1:$2').replace(/\s+/g, ' ').trim()
  }).join('\n')
}

function priceGroups(value: string | undefined) {
  if (!value) return []
  return value.split(/\n\s*\n/).flatMap((block) => {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean)
    if (!lines.length) return []
    const heading = lines[0].replace(/:$/, '')
    const items = lines.slice(1).map((line) => line.replace(/^-\s*/, '').replace(/\s+/g, ' ').trim()).filter(Boolean)
    return items.length ? [{ heading, items }] : []
  })
}

export const serviceMapDetails: Record<number, ServiceMapDetails> = {
  [source.id]: {
    id: source.id,
    nameFi: source.name?.fi,
    nameEn: source.name?.en,
    shortDescriptionFi: source.short_description?.fi,
    shortDescriptionEn: source.short_description?.en,
    descriptionFi: source.description?.fi,
    descriptionEn: source.description?.en,
    openingHoursFi: openingHours(source.connections?.find((connection) => connection.section_type === 'OPENING_HOURS')?.name?.fi, 'fi'),
    openingHoursEn: openingHours(source.connections?.find((connection) => connection.section_type === 'OPENING_HOURS')?.name?.en, 'en'),
    priceFi: source.connections?.find((connection) => connection.section_type === 'PRICE')?.name?.fi,
    priceEn: source.connections?.find((connection) => connection.section_type === 'PRICE')?.name?.en,
    priceGroups: priceGroups(source.connections?.find((connection) => connection.section_type === 'PRICE')?.name?.en),
    servicesFi: source.service_names_fi ?? [],
    servicesEn: source.service_names_en ?? [],
    links: source.connections?.flatMap((connection) => connection.section_type === 'LINK' && connection.name?.fi && connection.name.en && connection.www?.fi && connection.www.en ? [{ labelFi: connection.name.fi, labelEn: connection.name.en, url: connection.www.en }] : []) ?? [],
    pictureUrl: source.picture_url,
    updatedAt: source.last_modified_time,
    familySignals: [],
  },
}

type ServiceMapSnapshot = {
  serviceMapId: number
  lipasId?: number
  nameFi?: string
  nameEn?: string
  shortDescriptionFi?: string
  shortDescriptionEn?: string
  descriptionFi?: string
  descriptionEn?: string
  openingHoursFi?: string
  openingHoursEn?: string
  priceFi?: string
  priceEn?: string
  priceClass: PriceClass
  usageStatus: 'open' | 'restricted' | 'booking' | 'unknown'
  familySignals: string[]
  accessibility: VenueAccessibility
  links: { labelFi: string; labelEn: string; url: string }[]
  sourceUrl: string
  updatedAt?: string
}

const snapshotUnits = (snapshot.units ?? []) as ServiceMapSnapshot[]
const snapshotsByServiceMapId = new Map(snapshotUnits.map((unit) => [unit.serviceMapId, unit]))
const snapshotsByLipasId = new Map(snapshotUnits.filter((unit) => unit.lipasId !== undefined).map((unit) => [unit.lipasId as number, unit]))

function detailsFromSnapshot(unit: ServiceMapSnapshot): ServiceMapDetails {
  return {
    id: unit.serviceMapId,
    nameFi: unit.nameFi,
    nameEn: unit.nameEn,
    shortDescriptionFi: unit.shortDescriptionFi,
    shortDescriptionEn: unit.shortDescriptionEn,
    descriptionFi: unit.descriptionFi,
    descriptionEn: unit.descriptionEn,
    openingHoursFi: openingHours(unit.openingHoursFi, 'fi'),
    openingHoursEn: openingHours(unit.openingHoursEn, 'en'),
    priceFi: unit.priceFi,
    priceEn: unit.priceEn,
    priceGroups: priceGroups(unit.priceEn ?? unit.priceFi),
    servicesFi: [],
    servicesEn: [],
    links: unit.links,
    updatedAt: unit.updatedAt,
    priceClass: unit.priceClass,
    usageStatus: unit.usageStatus,
    familySignals: unit.familySignals,
    accessibility: unit.accessibility,
    sourceUrl: unit.sourceUrl,
  }
}

export function serviceMapForUnit(id: number | undefined) {
  if (id === undefined) return undefined
  const aliases: Record<number, number> = { 520304: 45925 }
  const serviceMapId = aliases[id] ?? id
  const manual = serviceMapDetails[serviceMapId]
  const snapshotUnit = snapshotsByServiceMapId.get(serviceMapId) ?? snapshotsByLipasId.get(id)
  if (!snapshotUnit) return manual
  return manual ? { ...detailsFromSnapshot(snapshotUnit), ...manual, familySignals: snapshotUnit.familySignals, accessibility: snapshotUnit.accessibility, priceClass: snapshotUnit.priceClass, usageStatus: snapshotUnit.usageStatus, sourceUrl: snapshotUnit.sourceUrl } : detailsFromSnapshot(snapshotUnit)
}

export function serviceMapForUrl(url: string | undefined) {
  const match = url?.match(/\/unit\/(\d+)/)
  return serviceMapForUnit(match ? Number(match[1]) : undefined)
}
