import type { RouteResult } from './routing'
import type { AddressSuggestion } from './geocoding'
import type { SportFeature, SportsVenue } from './data/types'
import { type Locale, sportText, text } from './i18n'

export function formatDistance(locale: Locale, metres: number) {
  const tag = locale === 'fi' ? 'fi-FI' : 'en-GB'
  if (metres < 950) return `${new Intl.NumberFormat(tag).format(Math.max(10, Math.round(metres / 10) * 10))} m`
  return `${new Intl.NumberFormat(tag, { maximumFractionDigits: metres < 10_000 ? 1 : 0 }).format(metres / 1000)} km`
}

// Many LIPAS records point at a provider's front page rather than the venue.
// Those are not "official details" for this place, so they are not offered as such.
export function isGenericSite(url?: string) {
  if (!url) return true
  try { const parsed = new URL(url); return /^\/?((fi|en|sv)\/?)?$/.test(parsed.pathname) && !parsed.search } catch { return true }
}

export function serviceMapSearchUrl(locale: Locale, name: string) {
  return `https://palvelukartta.hel.fi/${locale}/search?q=${encodeURIComponent(name)}`
}

export function venueTypeLabel(venue: SportsVenue | undefined, locale: Locale) {
  const label = locale === 'en' ? venue?.lipas?.typeNameEn ?? venue?.lipas?.typeName : venue?.lipas?.typeName
  // Grouped records are typed as "3 sports facilities": a count, not a type, so it is left out of the row.
  return label && !/^\d+ (liikuntapaikkaa|sports facilities)$/i.test(label) ? label : undefined
}

export function featureDisplayName(feature: SportFeature, locale: Locale, fallback?: string) {
  return (locale === 'en' ? feature.nameEn : feature.name) ?? feature.name ?? fallback ?? text(locale, 'selectArea')
}

export function priceLabelKey(priceClass: SportFeature['priceClass']) {
  return priceClass === 'free' ? 'priceFree' : priceClass === 'paid' ? 'pricePaid' : priceClass === 'mixed' ? 'priceMixed' : 'priceUnknown'
}

export function formatRouteDuration(locale: Locale, seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60))
  if (minutes < 60) return `${minutes} ${text(locale, 'minutes')}`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours} h${remainingMinutes ? ` ${remainingMinutes} ${text(locale, 'minutes')}` : ''}`
}

export function transitModeLabel(locale: Locale, mode: string) {
  switch (mode.toUpperCase()) {
    case 'WALK': return text(locale, 'walkMode')
    case 'BUS': return text(locale, 'busMode')
    case 'TRAM': return text(locale, 'tramMode')
    case 'RAIL': return text(locale, 'trainMode')
    case 'SUBWAY': return text(locale, 'metroMode')
    case 'FERRY': return text(locale, 'ferryMode')
    default: return text(locale, 'transitMode')
  }
}

export function transitLegTitle(locale: Locale, leg: NonNullable<RouteResult['transit']>['legs'][number], index: number, total: number) {
  const mode = leg.mode.toUpperCase()
  if (mode === 'WALK') return text(locale, index === total - 1 ? 'transitWalkFrom' : 'transitWalkTo', { stop: index === total - 1 ? leg.from ?? 'your stop' : leg.to ?? 'your stop' })
  if (!leg.routeName) return transitModeLabel(locale, leg.mode)
  return text(locale, 'transitVehicle', { mode: transitModeLabel(locale, leg.mode), route: leg.routeName })
}

export function transitLegDetail(locale: Locale, leg: NonNullable<RouteResult['transit']>['legs'][number]) {
  const details = []
  if (leg.headsign) details.push(text(locale, 'transitTowards', { headsign: leg.headsign }))
  if (leg.from || leg.to) details.push(text(locale, 'transitStopPair', { from: leg.from ?? 'Start', to: leg.to ?? 'Destination' }))
  return details.join(' · ')
}

export function transitCompactLabel(locale: Locale, leg: NonNullable<RouteResult['transit']>['legs'][number]) {
  const mode = transitModeLabel(locale, leg.mode)
  return leg.routeName ? `${mode} ${leg.routeName}` : mode
}

export function hslTicketZones(zones: string[]) {
  const normalized = new Set(zones.map((zone) => zone.trim().toUpperCase()))
  if (normalized.has('A')) return normalized.has('C') ? 'ABC' : 'AB'
  if (normalized.has('B')) return normalized.has('C') ? 'BC' : 'AB'
  if (normalized.has('C')) return normalized.has('D') ? 'CD' : 'BC'
  if (normalized.has('D')) return 'D'
  return zones.join('') || 'HSL'
}

export function reportDataUrl(locale: Locale, feature: SportFeature, venue: SportsVenue | undefined) {
  const name = feature.name ?? venue?.name ?? (locale === 'fi' ? 'Nimetön liikuntapaikka' : 'Unnamed sports facility')
  const title = `${locale === 'fi' ? 'Virheellinen liikuntapaikkatieto' : 'Incorrect facility data'}: ${name}`
  const body = [
    locale === 'fi' ? 'Tässä liikuntapaikassa näyttää olevan virheellistä tai vanhentunutta tietoa.' : 'This facility appears to have incorrect or outdated information.',
    '',
    `${locale === 'fi' ? 'Liikuntapaikka' : 'Facility'}: ${name}`,
    `${locale === 'fi' ? 'Osoite' : 'Address'}: ${venue?.lipas?.address ?? '—'}`,
    `${locale === 'fi' ? 'Tunniste' : 'ID'}: ${feature.id}`,
    venue?.sourceUrl ? `Source: ${venue.sourceUrl}` : '',
    '',
    locale === 'fi' ? 'Mitä pitäisi korjata?' : 'What should be corrected?',
  ].filter(Boolean).join('\n')
  const url = new URL('https://github.com/petudesign/Helsinki-Sports-Map/issues/new')
  url.searchParams.set('title', title)
  url.searchParams.set('body', body)
  return url.toString()
}

export function summarizeActivities(labels: string[], locale: Locale, max = 3) {
  // A venue can list dozens of sports; a list row shows a few and the count of the rest.
  if (labels.length <= max + 1) return labels.join(', ')
  return `${labels.slice(0, max).join(', ')} ${locale === 'fi' ? `+${labels.length - max} muuta` : `+${labels.length - max} more`}`
}

export function venueActivityLabel(locale: Locale, sport: string) {
  const label = sportText(locale, sport)
  const firstCharacter = Array.from(label)[0]
  return firstCharacter ? `${firstCharacter.toLocaleUpperCase(locale === 'fi' ? 'fi-FI' : 'en-US')}${label.slice(firstCharacter.length)}` : label
}

export const placeKindLabel = (locale: Locale, kind: NonNullable<AddressSuggestion['kind']>) => ({
  area: locale === 'fi' ? 'Alue' : 'Area',
  station: locale === 'fi' ? 'Asema' : 'Station',
  place: locale === 'fi' ? 'Paikka' : 'Place',
})[kind]
