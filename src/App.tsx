import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { RiApps2Line, RiArrowLeftLine, RiArrowUpSLine, RiBasketballLine, RiBikeLine, RiBoxingLine, RiBus2Line, RiCarLine, RiCloseLine, RiEqualizer2Line, RiFireLine, RiFlagLine, RiFocus3Line, RiFootballLine, RiFootprintLine, RiFullscreenExitLine, RiLeafLine, RiMapPin2Line, RiMedal2Line, RiNavigationLine, RiPingPongLine, RiRunLine, RiSearchLine, RiShipLine, RiSubwayLine, RiTrainLine, RiWalkLine, RiWaterFlashLine, RiWaterPercentLine, RiWeightLine, type RemixiconComponentType } from '@remixicon/react'
import type { GeoPoint, LipasVenue, MapDataset, SportFeature, SportsVenue } from './data/types'
import { previewTrendingSignal, type TrendingSignal } from './data/trending'
import { activeCity } from './config/city'
import { SportsMap, type MapControls } from './components/SportsMap'
import { Segmented } from './ui/Segmented'
import { extraText, formatPlaceCount, sportText, text, type Locale } from './i18n'
import { geocodeAddress, reverseGeocode, routeByMode, routeByTransit, RouteRequestError, searchAddresses, transitDirectionsUrl, type AddressSuggestion, type RouteResult, type TravelMode } from './routing'
import { installStressEnvironment, stressInitialSearch } from './dev/stress'
import { getAnalyticsConsent, setAnalyticsConsent, type AnalyticsConsent } from './privacy'
const ReviewWorkbench = lazy(() => import('./review/ReviewWorkbench').then((module) => ({ default: module.ReviewWorkbench })))
const WikiWorkbench = lazy(() => import('./wiki/WikiWorkbench').then((module) => ({ default: module.WikiWorkbench })))

type Mode = '2d' | 'iso'
type SportFilter = 'all' | 'football' | 'basketball' | 'outdoor' | 'gym' | 'athletics' | 'swimming' | 'outdoor_swimming' | 'ice_hockey' | 'tennis' | 'padel' | 'martial_arts' | 'skateboarding'
type PriceFilter = 'all' | 'free' | 'paid'
type AccessibilityFilter = 'all' | 'stepFreeEntrance' | 'accessibleToilet' | 'accessibleParking'
type FamilyFilter = 'all' | 'family'

function FacilityBreakdown({ facilities, locale }: { facilities: NonNullable<LipasVenue['facilities']>; locale: Locale }) {
  if (facilities.length < 2) return null
  return <details className="disclosure facility-breakdown"><summary>{text(locale, 'facilityComponents', { count: String(facilities.length) })}</summary><ul>{facilities.map((facility) => {
    const sourceName = facility.name.split(' / ').slice(-1)[0] || facility.name
    const type = locale === 'en' ? facility.typeNameEn ?? facility.typeName : facility.typeName
    const name = locale === 'en' && sourceName.toLocaleLowerCase('fi-FI') === facility.typeName?.toLocaleLowerCase('fi-FI') ? type ?? sourceName : sourceName
    return <li key={facility.id}><strong>{name}</strong>{type && type.toLocaleLowerCase(locale) !== name.toLocaleLowerCase(locale) && <span>{type}</span>}{facility.address && <small>{facility.address}</small>}</li>
  })}</ul></details>
}

function FacilityDetails({ feature, venue, trend, trendingEnabled, locale, route, travelMode, onDirections }: {
  feature: SportFeature
  venue?: SportsVenue
  trend?: TrendingSignal
  trendingEnabled: boolean
  locale: Locale
  route?: RouteResult
  travelMode: TravelMode
  onDirections: () => void
}) {
  const serviceMap = venue?.serviceMap
  const [photoFailed, setPhotoFailed] = useState(false)
  const photoCaption = locale === 'en' ? serviceMap?.pictureCaptionEn ?? serviceMap?.pictureCaptionFi : serviceMap?.pictureCaptionFi ?? serviceMap?.pictureCaptionEn
  const hasFacilityBreakdown = (venue?.lipas?.facilities?.length ?? 0) > 1
  const officialShortDescription = locale === 'en' ? serviceMap?.shortDescriptionEn : serviceMap?.shortDescriptionFi || serviceMap?.shortDescriptionEn
  const officialDescription = locale === 'en' ? serviceMap?.descriptionEn : serviceMap?.descriptionFi || serviceMap?.descriptionEn
  const officialOpeningHours = locale === 'en' ? serviceMap?.openingHoursEn : serviceMap?.openingHoursFi || serviceMap?.openingHoursEn
  const officialPrice = locale === 'en' ? serviceMap?.priceEn : serviceMap?.priceFi || serviceMap?.priceEn
  const officialServices = locale === 'en'
    ? serviceMap?.servicesEn ?? []
    : serviceMap?.servicesFi.length ? serviceMap.servicesFi : serviceMap?.servicesEn ?? []
  const displayName = featureDisplayName(feature, locale, venue?.name)
  const ownPage = [venue?.officialUrl, serviceMap?.sourceUrl].find((url) => url && !isGenericSite(url))
  const officialHref = ownPage ?? serviceMapSearchUrl(locale, displayName)
  const officialLabel = ownPage ? text(locale, 'openOfficial') : (locale === 'fi' ? 'Etsi Helsingin palvelukartalta' : 'Find on Helsinki Service Map')
  const accessLink = venue?.lipas?.accessSourceUrl && !isGenericSite(venue.lipas.accessSourceUrl) && venue.lipas.accessSourceUrl !== officialHref ? venue.lipas.accessSourceUrl : undefined
  const hasOfficialDetails = Boolean(officialShortDescription?.trim() || officialDescription?.trim() || officialServices.length || officialPrice?.trim() || serviceMap?.links.length)
  return <div className="facility-card">
    {venue?.lipas?.parentName && <span className="facility-parent-name">{venue.lipas.parentName}</span>}
    {serviceMap?.pictureUrl && !photoFailed && <figure className="facility-photo"><img src={serviceMap.pictureUrl} alt={photoCaption ?? featureDisplayName(feature, locale, venue?.name)} loading="lazy" decoding="async" onError={() => setPhotoFailed(true)} />{(photoCaption || serviceMap.sourceUrl) && <figcaption>{photoCaption && <span>{photoCaption}</span>}{serviceMap.sourceUrl && <a href={serviceMap.sourceUrl} target="_blank" rel="noreferrer">{locale === 'fi' ? 'Helsingin palvelukartta' : 'Helsinki Service Map'} ↗</a>}</figcaption>}</figure>}
    {trend && trendingEnabled && <section className={`trend-summary trend-${trend.stage}`}><div><span>{text(locale, trend.source === 'preview' ? 'previewScore' : 'interestSignal')}</span><strong>{trend.interestScore}</strong></div><div className="trend-summary-bar"><span style={{ '--trend-progress': trend.interestScore / 100 } as CSSProperties} /></div><small>+{trend.recentChange}% · {text(locale, trend.stage === 'new' ? 'newOnList' : trend.stage === 'rising' ? 'risingInterest' : 'popularNow')}</small></section>}
    <div className="facility-location-row">
      {venue?.lipas?.address && <p className="facility-address"><RiMapPin2Line className="location-icon" aria-hidden="true" size={16} />{venue.lipas.address}</p>}
      <button className="btn btn-primary directions-open" type="button" onClick={onDirections}>{locale === 'fi' ? 'Reittiohjeet' : 'Directions'}</button>
    </div>
    {(() => {
      // Show only facts the source actually has, and say once what is missing.
      const priceClass = venue?.lipas?.priceClass ?? feature.priceClass
      const accessStatus = venue?.lipas?.accessStatus
      const priceKnown = Boolean(priceClass && priceClass !== 'unknown')
      const hoursKnown = Boolean(officialOpeningHours?.trim())
      const facts = [
        priceKnown ? { label: text(locale, 'priceFilter'), value: text(locale, priceLabelKey(priceClass)) } : undefined,
        accessStatus && accessStatus !== 'unknown' ? { label: text(locale, 'access'), value: text(locale, accessStatus === 'open' ? 'accessOpen' : accessStatus === 'restricted' ? 'accessRestricted' : 'accessBooking') } : undefined,
        hoursKnown ? { label: text(locale, 'openingHours'), value: officialOpeningHours!.trim() } : undefined,
      ].filter((fact): fact is { label: string; value: string } => Boolean(fact))
      const missingKey = !priceKnown && !hoursKnown ? 'missingPriceAndHours' : !hoursKnown ? 'missingHours' : !priceKnown ? 'missingPrice' : undefined
      return <>
        {facts.length > 0 && <dl className="facility-facts">{facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>}
        {missingKey && <p className="facility-unknown">{text(locale, missingKey)}</p>}
        <a className="text-link facility-official-link" href={officialHref} target="_blank" rel="noreferrer">{officialLabel} ↗</a>
      </>
    })()}
    {!venue?.lipas?.accessNoteFi && accessLink && <p className="facility-access-link"><a href={accessLink} target="_blank" rel="noreferrer">{text(locale, 'verifyAccess')} ↗</a></p>}
    {venue?.lipas?.accessNoteFi && <div className="facility-access"><h3 className="section-title">{text(locale, 'access')}</h3><p>{locale === 'en' ? venue.lipas.accessNoteEn : venue.lipas.accessNoteFi}</p>{accessLink && <a href={accessLink} target="_blank" rel="noreferrer">{text(locale, 'verifyAccess')} ↗</a>}</div>}
    {route && <span className="facility-type">{text(locale, travelMode === 'walk' ? 'walkingRoute' : travelMode)}: {Math.max(1, Math.round(route.durationSeconds / 60))} {text(locale, 'minutes')} · {Math.round(route.distanceMetres)} m</span>}
    {venue?.lipas?.typeName && !hasFacilityBreakdown && <span className="facility-type">{locale === 'en' ? venue.lipas.typeNameEn ?? venue.lipas.typeName : venue.lipas.typeName}</span>}
    {venue?.sports.length ? <><h3 className="section-title">{text(locale, 'activities')}</h3><ul className="facility-activities">{venue.sports.map((sport) => <li key={sport}>{venueActivityLabel(locale, sport)}</li>)}</ul></> : <p className="facility-unknown">{text(locale, 'missingSports')}</p>}
    {venue && <div className="facility-more-info">
      <FacilityBreakdown facilities={venue.lipas?.facilities ?? []} locale={locale} />
      {serviceMap && hasOfficialDetails && <details className="disclosure official-details">
        <summary>{text(locale, 'officialInfo')}</summary>
        {officialShortDescription && <p>{officialShortDescription}</p>}
        {officialDescription && <p>{officialDescription}</p>}
        {officialServices.length > 0 && <><h3 className="section-title">{text(locale, 'officialServices')}</h3><ul className="official-services">{officialServices.map((service) => <li key={service}>{service}</li>)}</ul></>}
        {officialPrice && <><h3 className="section-title">{text(locale, 'priceDetails')}</h3>{serviceMap.priceGroups.length > 0 ? <div className="price-groups">{serviceMap.priceGroups.map((group) => <section key={group.heading}><strong>{group.heading}</strong><ul>{group.items.map((item) => <li key={item}>{item}</li>)}</ul></section>)}</div> : <p className="official-hours">{officialPrice}</p>}</>}
        {serviceMap.links.length > 0 && <><h3 className="section-title">{text(locale, 'officialLinks')}</h3><ul className="official-links">{serviceMap.links.map((link) => <li key={link.url}><a href={link.url} target="_blank" rel="noreferrer">{locale === 'en' ? link.labelEn : link.labelFi} ↗</a></li>)}</ul></>}
      </details>}
    </div>}
  </div>
}

const LOCALE_KEY = 'hsm-locale'
function initialLocale(): Locale {
  try { const stored = localStorage.getItem(LOCALE_KEY); if (stored === 'fi' || stored === 'en') return stored } catch { /* storage blocked */ }
  return navigator.languages?.some((language) => language.toLowerCase().startsWith('fi')) ? 'fi' : 'en'
}

function distanceMetres([lng1, lat1]: GeoPoint, [lng2, lat2]: GeoPoint) {
  const rad = Math.PI / 180
  const a = Math.sin((lat2 - lat1) * rad / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin((lng2 - lng1) * rad / 2) ** 2
  return 6_371_000 * 2 * Math.asin(Math.sqrt(a))
}

function formatDistance(locale: Locale, metres: number) {
  const tag = locale === 'fi' ? 'fi-FI' : 'en-GB'
  if (metres < 950) return `${new Intl.NumberFormat(tag).format(Math.max(10, Math.round(metres / 10) * 10))} m`
  return `${new Intl.NumberFormat(tag, { maximumFractionDigits: metres < 10_000 ? 1 : 0 }).format(metres / 1000)} km`
}

// Many LIPAS records point at a provider's front page rather than the venue.
// Those are not "official details" for this place, so they are not offered as such.
function isGenericSite(url?: string) {
  if (!url) return true
  try { const parsed = new URL(url); return /^\/?((fi|en|sv)\/?)?$/.test(parsed.pathname) && !parsed.search } catch { return true }
}

function serviceMapSearchUrl(locale: Locale, name: string) {
  return `https://palvelukartta.hel.fi/${locale}/search?q=${encodeURIComponent(name)}`
}

function venueTypeLabel(venue: SportsVenue | undefined, locale: Locale) {
  const label = locale === 'en' ? venue?.lipas?.typeNameEn ?? venue?.lipas?.typeName : venue?.lipas?.typeName
  // Grouped records are typed as "3 sports facilities": a count, not a type, so it is left out of the row.
  return label && !/^\d+ (liikuntapaikkaa|sports facilities)$/i.test(label) ? label : undefined
}

function featureDisplayName(feature: SportFeature, locale: Locale, fallback?: string) {
  return (locale === 'en' ? feature.nameEn : feature.name) ?? feature.name ?? fallback ?? text(locale, 'selectArea')
}

const allFilterOptions: { id: SportFilter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'football', label: 'Football' }, { id: 'basketball', label: 'Basketball' }, { id: 'outdoor', label: 'Outdoor' }, { id: 'gym', label: 'Gym' },
  { id: 'athletics', label: 'Athletics' }, { id: 'swimming', label: 'Swimming' }, { id: 'outdoor_swimming', label: 'Outdoor swimming' }, { id: 'ice_hockey', label: 'Ice hockey' }, { id: 'tennis', label: 'Tennis' }, { id: 'padel', label: 'Padel' }, { id: 'martial_arts', label: 'Martial arts' }, { id: 'skateboarding', label: 'Skateboarding' },
]


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

function SportFilterIcon({ id }: { id: SportFilter }) {
  const Icon = sportIcons[id]
  return <Icon className="sport-filter-icon" aria-hidden="true" size={15} />
}

const outdoorSports = new Set(['athletics', 'basketball', 'beachvolleyball', 'football', 'soccer', 'ice_hockey', 'outdoor_fitness', 'outdoor_swimming', 'padel', 'skateboarding', 'skating', 'skiing', 'tennis', 'volleyball'])

function isOutdoorFeature(feature: SportFeature) {
  const sports = feature.sports?.length ? feature.sports : [feature.sport]
  if (sports.some((sport) => outdoorSports.has(sport))) return true
  return /beach|court|field|fitness.station|hiihto|kenttä|kuntorata|luist|outdoor|park|pitch|puisto|ranta|rata|stadium|stadion|skate|track|trail|ulko|uimar/i.test(`${feature.name ?? ''} ${feature.facilityType ?? ''}`)
}

function matchesFilter(feature: SportFeature, filter: SportFilter) {
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

function matchesPrice(feature: SportFeature, filter: PriceFilter) {
  return filter === 'all' || feature.priceClass === filter || feature.priceClass === 'mixed'
}

function matchesAccessibility(venue: SportsVenue | undefined, filter: AccessibilityFilter) {
  if (filter === 'all') return true
  return venue?.serviceMap?.accessibility?.[filter] === 'yes'
}

function matchesFamily(venue: SportsVenue | undefined, filter: FamilyFilter) {
  return filter === 'all' || Boolean(venue?.serviceMap?.familySignals.length)
}

function priceLabelKey(priceClass: SportFeature['priceClass']) {
  return priceClass === 'free' ? 'priceFree' : priceClass === 'paid' ? 'pricePaid' : priceClass === 'mixed' ? 'priceMixed' : 'priceUnknown'
}

function formatRouteDuration(locale: Locale, seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60))
  if (minutes < 60) return `${minutes} ${text(locale, 'minutes')}`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours} h${remainingMinutes ? ` ${remainingMinutes} ${text(locale, 'minutes')}` : ''}`
}

function transitModeLabel(locale: Locale, mode: string) {
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

function TransitLegIcon({ mode }: { mode: string }) {
  const normalizedMode = mode.toUpperCase()
  const Icon = normalizedMode === 'WALK' ? RiWalkLine : normalizedMode === 'BUS' ? RiBus2Line : normalizedMode === 'TRAM' ? RiTrainLine : normalizedMode === 'RAIL' ? RiTrainLine : normalizedMode === 'SUBWAY' ? RiSubwayLine : normalizedMode === 'FERRY' ? RiShipLine : RiBus2Line
  return <Icon aria-hidden="true" size={17} />
}

function transitLegTitle(locale: Locale, leg: NonNullable<RouteResult['transit']>['legs'][number], index: number, total: number) {
  const mode = leg.mode.toUpperCase()
  if (mode === 'WALK') return text(locale, index === total - 1 ? 'transitWalkFrom' : 'transitWalkTo', { stop: index === total - 1 ? leg.from ?? 'your stop' : leg.to ?? 'your stop' })
  if (!leg.routeName) return transitModeLabel(locale, leg.mode)
  return text(locale, 'transitVehicle', { mode: transitModeLabel(locale, leg.mode), route: leg.routeName })
}

function transitLegDetail(locale: Locale, leg: NonNullable<RouteResult['transit']>['legs'][number]) {
  const details = []
  if (leg.headsign) details.push(text(locale, 'transitTowards', { headsign: leg.headsign }))
  if (leg.from || leg.to) details.push(text(locale, 'transitStopPair', { from: leg.from ?? 'Start', to: leg.to ?? 'Destination' }))
  return details.join(' · ')
}

function transitCompactLabel(locale: Locale, leg: NonNullable<RouteResult['transit']>['legs'][number]) {
  const mode = transitModeLabel(locale, leg.mode)
  return leg.routeName ? `${mode} ${leg.routeName}` : mode
}

function hslTicketZones(zones: string[]) {
  const normalized = new Set(zones.map((zone) => zone.trim().toUpperCase()))
  if (normalized.has('A')) return normalized.has('C') ? 'ABC' : 'AB'
  if (normalized.has('B')) return normalized.has('C') ? 'BC' : 'AB'
  if (normalized.has('C')) return normalized.has('D') ? 'CD' : 'BC'
  if (normalized.has('D')) return 'D'
  return zones.join('') || 'HSL'
}

function reportDataUrl(locale: Locale, feature: SportFeature, venue: SportsVenue | undefined) {
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

function summarizeActivities(labels: string[], locale: Locale, max = 3) {
  // A venue can list dozens of sports; a list row shows a few and the count of the rest.
  if (labels.length <= max + 1) return labels.join(', ')
  return `${labels.slice(0, max).join(', ')} ${locale === 'fi' ? `+${labels.length - max} muuta` : `+${labels.length - max} more`}`
}

function venueActivityLabel(locale: Locale, sport: string) {
  const label = sportText(locale, sport)
  const firstCharacter = Array.from(label)[0]
  return firstCharacter ? `${firstCharacter.toLocaleUpperCase(locale === 'fi' ? 'fi-FI' : 'en-US')}${label.slice(firstCharacter.length)}` : label
}

if (import.meta.env.DEV) installStressEnvironment()

function App() {
  const reviewMode = new URLSearchParams(window.location.search).get('review') === '1'
  const wikiMode = new URLSearchParams(window.location.search).get('wiki') === '1'
  const mapRef = useRef<MapControls>(null)
  const filterDrawerRef = useRef<HTMLDetailsElement>(null)
  const [loadError, setLoadError] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [sidebarView, setSidebarView] = useState<'list' | 'detail'>('list')
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [listLimit, setListLimit] = useState(60)
  const [mapArea, setMapArea] = useState<MapDataset>()
  const [mode, setMode] = useState<Mode>('2d')
  const [filter, setFilter] = useState<SportFilter>('all')
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all')
  const [accessibilityFilter, setAccessibilityFilter] = useState<AccessibilityFilter>('all')
  const [familyFilter, setFamilyFilter] = useState<FamilyFilter>('all')
  const [selected, setSelected] = useState<SportFeature>()
  const [routePlannerOpen, setRoutePlannerOpen] = useState(false)
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [trendingEnabled, setTrendingEnabled] = useState(false)
  const [locale, setLocale] = useState<Locale>(initialLocale)
  const [nearOrigin, setNearOrigin] = useState<{ coordinates: GeoPoint; label: string }>()
  const [nearStatus, setNearStatus] = useState<'idle' | 'locating' | 'denied' | 'error' | 'geocoding' | 'notfound'>('idle')
  const [resolvedOrigin, setResolvedOrigin] = useState<GeoPoint>()
  const detailHeadingRef = useRef<HTMLHeadingElement>(null)
  const returnFocusIdRef = useRef<string | undefined>(undefined)
  const focusDetailRef = useRef(false)
  const showMoreFromRef = useRef<number | undefined>(undefined)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [searchQuery, setSearchQuery] = useState(() => import.meta.env.DEV ? stressInitialSearch() : '')
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const [startingPoint, setStartingPoint] = useState('')
  const [originCoordinates, setOriginCoordinates] = useState<[number, number]>()
  const [originSuggestions, setOriginSuggestions] = useState<AddressSuggestion[]>([])
  const [suggestionStatus, setSuggestionStatus] = useState<'idle' | 'loading' | 'empty' | 'error'>('idle')
  const [suggestionRetry, setSuggestionRetry] = useState(0)
  const [travelMode, setTravelMode] = useState<TravelMode>('walk')
  const [routes, setRoutes] = useState<Partial<Record<TravelMode, RouteResult>>>({})
  const [routeStatus, setRouteStatus] = useState<'idle' | 'loading' | 'error' | 'unavailable' | 'no-route' | 'outside-area' | 'invalid'>('idle')
  const [transitStatus, setTransitStatus] = useState<'idle' | 'loading' | 'unavailable' | 'no-route'>('idle')
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'denied' | 'error'>('idle')
  const [, setAnalyticsConsentState] = useState<AnalyticsConsent>()
  const [consentVisible, setConsentVisible] = useState(false)
  const [debugVenues] = useState(() => new URLSearchParams(window.location.search).get('debug') === 'venues')
  const locationRequestRef = useRef(0)
  useEffect(() => { document.documentElement.lang = locale; try { localStorage.setItem(LOCALE_KEY, locale) } catch { /* storage blocked */ } }, [locale])
  const locationTimeoutRef = useRef<number | undefined>(undefined)
  const acceptedStreetRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    const closeSportDrawerOnOutsideInteraction = (event: Event) => {
      const drawer = filterDrawerRef.current
      if (drawer?.open && !event.composedPath().includes(drawer)) drawer.open = false
    }
    document.addEventListener('click', closeSportDrawerOnOutsideInteraction)
    document.addEventListener('focusin', closeSportDrawerOnOutsideInteraction)
    return () => {
      document.removeEventListener('click', closeSportDrawerOnOutsideInteraction)
      document.removeEventListener('focusin', closeSportDrawerOnOutsideInteraction)
    }
  }, [])
  useEffect(() => {
    if (reviewMode || wikiMode) return
    let cancelled = false
    setLoadError(false)
    activeCity.loadDataset().then((data) => { if (!cancelled) setMapArea(data) })
      .catch(() => { if (!cancelled) setLoadError(true) })
    return () => { cancelled = true }
  }, [reviewMode, wikiMode, loadAttempt])
  const selectFeature = useCallback((feature: SportFeature | undefined, expandSidebar = false) => {
    if (feature) { returnFocusIdRef.current = feature.id; focusDetailRef.current = true }
    setSelected(feature)
    setSidebarView(feature ? 'detail' : 'list')
    setSidebarExpanded(expandSidebar)
    setRoutePlannerOpen(false)
    setReportDialogOpen(false)
  }, [])
  useEffect(() => { const stored = getAnalyticsConsent(); setAnalyticsConsentState(stored); setConsentVisible(stored === undefined) }, [])
  const venuesById = useMemo(() => new Map(mapArea?.venues.map((venue) => [venue.id, venue]) ?? []), [mapArea])
  const searchIndex = useMemo(() => new Map((mapArea?.sports ?? []).map((feature) => {
    const venue = venuesById.get(feature.id)
    const searchable = [feature.name, feature.nameEn, venue?.name, venue?.lipas?.name, venue?.lipas?.parentName, venue?.lipas?.address, feature.facilityType, feature.sport, ...(feature.sports ?? []), ...(venue?.lipas?.facilities ?? []).flatMap(({ name, typeName, typeNameEn, address }) => [name, typeName, typeNameEn, address])]
      .filter((value): value is string => Boolean(value))
    const searchText = searchable.flatMap((value) => [value, sportText('en', value), sportText('fi', value)]).map((value) => value.toLocaleLowerCase('fi-FI'))
    return [feature.id, searchText]
  })), [mapArea, venuesById])
  const normalizedSearch = deferredSearchQuery.trim().toLocaleLowerCase('fi-FI')
  // Every word must match somewhere (name, type, sport, address), so "Pirkkolan uimahalli" finds "Pirkkolan liikuntapuisto / Uimahalli".
  const matchesSearch = useCallback((id: string) => {
    if (!normalizedSearch) return true
    const values = searchIndex.get(id)
    return values ? normalizedSearch.split(/\s+/).every((word) => values.some((value) => value.includes(word))) : false
  }, [normalizedSearch, searchIndex])
  const visibleSports = useMemo(() => mapArea?.sports.filter((feature) => {
    if (!matchesFilter(feature, filter)) return false
    if (!matchesPrice(feature, priceFilter)) return false
    if (!matchesAccessibility(venuesById.get(feature.id), accessibilityFilter)) return false
    if (!matchesFamily(venuesById.get(feature.id), familyFilter)) return false
    return matchesSearch(feature.id)
  }) ?? [], [mapArea, filter, priceFilter, accessibilityFilter, familyFilter, matchesSearch, venuesById])
  const distances = useMemo(() => nearOrigin ? new Map(visibleSports.flatMap((feature) => feature.center ? [[feature.id, distanceMetres(nearOrigin.coordinates, feature.center)] as const] : [])) : undefined, [visibleSports, nearOrigin])
  const sortedSports = useMemo(() => [...visibleSports].sort((a, b) => distances
    ? (distances.get(a.id) ?? Infinity) - (distances.get(b.id) ?? Infinity)
    : featureDisplayName(a, locale).localeCompare(featureDisplayName(b, locale), locale)), [visibleSports, locale, distances])
  const hiddenUnknownPrice = useMemo(() => priceFilter === 'all' ? 0 : (mapArea?.sports ?? []).filter((feature) => (feature.priceClass ?? 'unknown') === 'unknown'
    && matchesFilter(feature, filter) && matchesAccessibility(venuesById.get(feature.id), accessibilityFilter) && matchesFamily(venuesById.get(feature.id), familyFilter)
    && matchesSearch(feature.id)).length, [mapArea, priceFilter, filter, accessibilityFilter, familyFilter, matchesSearch, venuesById])
  const mapFitKey = [filter, priceFilter, accessibilityFilter, familyFilter, normalizedSearch, nearOrigin?.label ?? ''].join('|')
  const mapFitTargets = useMemo<GeoPoint[]>(() => nearOrigin
    ? [nearOrigin.coordinates, ...sortedSports.slice(0, 8).flatMap((feature) => feature.center ? [feature.center] : [])]
    : visibleSports.flatMap((feature) => feature.center ? [feature.center] : []), [nearOrigin, sortedSports, visibleSports])
  const announcement = sidebarView === 'detail' && selected ? `${locale === 'fi' ? 'Avattu' : 'Opened'}: ${featureDisplayName(selected, locale)}` : formatPlaceCount(locale, visibleSports.length)
  useEffect(() => { setListLimit(60) }, [visibleSports])
  // Focus follows the panel: opening a place moves focus to its heading, going back returns it to the row.
  useEffect(() => {
    if (sidebarView === 'detail' && focusDetailRef.current) { focusDetailRef.current = false; detailHeadingRef.current?.focus({ preventScroll: true }); return }
    if (sidebarView === 'list' && returnFocusIdRef.current) {
      const row = document.querySelector<HTMLButtonElement>(`[data-feature-id="${CSS.escape(returnFocusIdRef.current)}"]`)
      returnFocusIdRef.current = undefined
      ;(row ?? searchInputRef.current)?.focus({ preventScroll: false })
    }
  }, [sidebarView, selected?.id])
  useEffect(() => {
    if (showMoreFromRef.current === undefined) return
    document.querySelectorAll<HTMLButtonElement>('.place-list .place-row')[showMoreFromRef.current]?.focus()
    showMoreFromRef.current = undefined
  }, [listLimit])
  useEffect(() => { if (selected && !visibleSports.some(({ id }) => id === selected.id)) selectFeature(undefined) }, [visibleSports, selected, selectFeature])
  const trendingSignals = useMemo(() => new Map<string, TrendingSignal>(mapArea?.sports.map((feature) => [feature.id, previewTrendingSignal(feature)]) ?? []), [mapArea])
  const topTrending = useMemo(() => visibleSports
    .map((feature) => ({ feature, signal: trendingSignals.get(feature.id) }))
    .filter((item): item is { feature: SportFeature; signal: TrendingSignal } => Boolean(item.signal))
    .sort((a, b) => b.signal.recentChange - a.signal.recentChange || b.signal.interestScore - a.signal.interestScore)
    .slice(0, 3), [visibleSports, trendingSignals])
  const trendingIsPreview = topTrending.some(({ signal }) => signal.source === 'preview')
  const filterOptions = allFilterOptions.filter((option) => option.id === 'all' || mapArea?.sports.some((feature) => matchesFilter(feature, option.id)))
  const activeFilterCount = Number(priceFilter !== 'all') + Number(accessibilityFilter !== 'all') + Number(familyFilter !== 'all')
  const venueDiagnostics = useMemo(() => {
    const names = new Map<string, { name: string; count: number }>()
    mapArea?.venues.forEach((venue) => { const key = (venue.name ?? '').trim().toLocaleLowerCase('fi-FI').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ''); if (key) { const current = names.get(key); names.set(key, { name: current?.name ?? venue.name ?? key, count: (current?.count ?? 0) + 1 }) } })
    const duplicateNames = [...names.values()].filter(({ count }) => count > 1).sort((a, b) => b.count - a.count).slice(0, 3).map(({ name, count }) => `${name} (${count})`)
    return { duplicateNames, duplicateNameGroups: [...names.values()].filter(({ count }) => count > 1).length, venueCount: mapArea?.venues.length ?? 0, featureCount: mapArea?.sports.length ?? 0, sourceCount: new Set(mapArea?.venues.map((venue) => venue.source.provider)).size }
  }, [mapArea])
  const selectedVenue = selected ? venuesById.get(selected.id) : undefined
  const selectedTrend = selected ? trendingSignals.get(selected.id) : undefined
  const route = routes[travelMode]
  const transitRoute = routes.transit?.transit
  const transitTicketZones = hslTicketZones(transitRoute?.zones ?? [])
  const canPlanRoute = routePlannerOpen && Object.keys(routes).length > 0
  const [addressError, setAddressError] = useState(false)
  const routeRequestRef = useRef(0)
  useEffect(() => {
    routeRequestRef.current += 1
    setRoutes({})
    setRouteStatus('idle')
    setTransitStatus('idle')
    setAddressError(false)
  }, [selected?.id, startingPoint, originCoordinates])

  useEffect(() => () => { if (locationTimeoutRef.current) window.clearTimeout(locationTimeoutRef.current); locationRequestRef.current += 1 }, [])

  useEffect(() => {
    const query = startingPoint.trim()
    if (query.length < 2 || originCoordinates || acceptedStreetRef.current === query) { setOriginSuggestions([]); setSuggestionStatus('idle'); return }
    const controller = new AbortController()
    setSuggestionStatus('loading')
    const timer = window.setTimeout(() => {
      searchAddresses(query, controller.signal).then((suggestions) => {
        if (controller.signal.aborted) return
        setOriginSuggestions(suggestions)
        setSuggestionStatus(suggestions.length ? 'idle' : 'empty')
      }).catch(() => {
        if (controller.signal.aborted) return
        setOriginSuggestions([])
        setSuggestionStatus('error')
      })
    }, 350)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [startingPoint, originCoordinates, suggestionRetry])

  const selectFilter = (nextFilter: SportFilter) => {
    setFilter(nextFilter)
    if (selected && !matchesFilter(selected, nextFilter)) selectFeature(undefined)
  }
  const closeRoutePlanner = () => {
    routeRequestRef.current += 1
    locationRequestRef.current += 1
    if (locationTimeoutRef.current) window.clearTimeout(locationTimeoutRef.current)
    acceptedStreetRef.current = undefined
    setRoutePlannerOpen(false)
    setStartingPoint('')
    setOriginCoordinates(undefined)
    setOriginSuggestions([])
    setRoutes({})
    setRouteStatus('idle')
    setTransitStatus('idle')
    setLocationStatus('idle')
  }
  const calculateRoute = async () => {
    if (!startingPoint.trim() || !selected?.center) return
    const requestId = ++routeRequestRef.current
    setRouteStatus('loading')
    setTransitStatus('loading')
    setAddressError(false)
    let origin = originCoordinates
    if (!origin) {
      try { origin = await geocodeAddress(startingPoint.trim()) }
      catch {
        if (requestId !== routeRequestRef.current) return
        setAddressError(true); setRouteStatus('idle'); setTransitStatus('idle'); setRoutes({}); return
      }
    }
    if (requestId !== routeRequestRef.current) return
    try {
      setOriginSuggestions([])
      const results = await Promise.allSettled([
        routeByMode(origin, selected.center!, 'walk'),
        routeByMode(origin, selected.center!, 'bike'),
        routeByTransit(origin, selected.center!, locale),
        routeByMode(origin, selected.center!, 'car'),
      ])
      if (requestId !== routeRequestRef.current) return
      const nextRoutes: Partial<Record<TravelMode, RouteResult>> = {}
      results.forEach((result) => { if (result.status === 'fulfilled') nextRoutes[result.value.mode] = result.value })
      const transitResult = results[2]
      setTransitStatus(transitResult.status === 'fulfilled' ? 'idle' : transitResult.reason instanceof RouteRequestError && transitResult.reason.code === 'no-route' ? 'no-route' : 'unavailable')
      if (!Object.keys(nextRoutes).length) {
        const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected').map((result) => result.reason)
        const failure = failures.find((reason) => reason instanceof RouteRequestError && reason.code === 'unavailable') ?? failures[0]
        throw failure instanceof RouteRequestError ? failure : new RouteRequestError('no-route')
      }
      // If one provider/profile fails, display a successful route rather than
      // leaving the selected mode pointing at an empty map layer.
      if (!nextRoutes[travelMode]) setTravelMode((['walk', 'bike', 'transit', 'car'] as const).find((mode) => nextRoutes[mode])!)
      setRoutes(nextRoutes); setRouteStatus('idle'); setSuggestionStatus('idle'); setResolvedOrigin(origin)
    } catch (error) {
      if (requestId === routeRequestRef.current) {
        setRoutes({})
        setTransitStatus('unavailable')
        setRouteStatus(error instanceof RouteRequestError ? error.code : 'error')
      }
    }
  }

  const useCurrentLocation = () => {
    if (!navigator.geolocation) { setLocationStatus('error'); return }
    const requestId = ++locationRequestRef.current
    if (locationTimeoutRef.current) window.clearTimeout(locationTimeoutRef.current)
    setLocationStatus('loading')
    locationTimeoutRef.current = window.setTimeout(() => { if (requestId === locationRequestRef.current) setLocationStatus('error') }, 12000)
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (requestId !== locationRequestRef.current) return
      if (locationTimeoutRef.current) window.clearTimeout(locationTimeoutRef.current)
      const coordinates: [number, number] = [coords.longitude, coords.latitude]
      setOriginCoordinates(coordinates)
      setStartingPoint(text(locale, 'currentLocation'))
      setOriginSuggestions([])
      setRoutes({})
      setRouteStatus('idle')
      setLocationStatus('idle')
      reverseGeocode(coordinates).then((suggestion) => { if (requestId === locationRequestRef.current) setStartingPoint(suggestion.label) }).catch(() => undefined)
    }, (error) => {
      if (requestId !== locationRequestRef.current) return
      if (locationTimeoutRef.current) window.clearTimeout(locationTimeoutRef.current)
      setLocationStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'error')
    }, { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 })
  }

  const findNearMe = () => {
    if (!navigator.geolocation) { setNearStatus('error'); return }
    setNearStatus('locating')
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setNearOrigin({ coordinates: [coords.longitude, coords.latitude], label: text(locale, 'currentLocation') })
      setNearStatus('idle')
      selectFeature(undefined)
    }, (error) => setNearStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'error'), { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 })
  }
  const findNearAddress = async (query: string) => {
    setNearStatus('geocoding')
    try {
      const coordinates = await geocodeAddress(query)
      setNearOrigin({ coordinates, label: query })
      setSearchQuery('')
      setNearStatus('idle')
    } catch { setNearStatus('notfound') }
  }
  const clearNear = () => { setNearOrigin(undefined); setNearStatus('idle') }
  const closeDetail = () => { setSidebarView('list'); setSidebarExpanded(true) }

  const chooseAnalyticsConsent = (consent: AnalyticsConsent) => {
    setAnalyticsConsent(consent)
    setAnalyticsConsentState(consent)
    setConsentVisible(false)
    window.requestAnimationFrame(() => searchInputRef.current?.focus({ preventScroll: true }))
  }

  if (reviewMode) return <Suspense fallback={<p>Loading review…</p>}><ReviewWorkbench /></Suspense>
  if (wikiMode) return <Suspense fallback={<p>Loading wiki…</p>}><WikiWorkbench /></Suspense>
  if (loadError) return <main className="app-shell loading-shell"><div className="state-panel" role="alert"><img src="/helsinkisportsmaplogo.png" alt="" width="40" height="40" /><h1>{locale === 'fi' ? 'Liikuntapaikkoja ei voitu ladata' : 'Sports places couldn’t load'}</h1><p>{locale === 'fi' ? 'Yhteys katkesi tai palvelu ei vastannut. Tietojasi ei menetetty.' : 'The connection dropped or the service didn’t respond. Nothing you entered was lost.'}</p><button type="button" className="state-panel-action" onClick={() => setLoadAttempt((value) => value + 1)}>{locale === 'fi' ? 'Yritä uudelleen' : 'Try again'}</button></div></main>
  if (!mapArea) return <main className="app-shell loading-shell"><div className="loading-state"><span className="status-dot" /><strong>{text(locale, 'loading', { city: activeCity.displayName })}</strong><span>{text(locale, 'preparing')}</span></div></main>

  const sportChipLabel = (id: SportFilter) => id === 'all' ? text(locale, 'all') : sportText(locale, id)
  const clearAllFilters = () => { setFilter('all'); setPriceFilter('all'); setAccessibilityFilter('all'); setFamilyFilter('all') }
  return <main className={`app ${selected ? 'has-selection' : ''} ${routePlannerOpen ? 'route-planner-open' : ''}`}>
    <p className="sr-only" role="status">{announcement}</p>

    <div className="side">
      <header className="topbar">
        <a className="brand" href="/"><img src="/helsinkisportsmaplogo.png" alt="" width="32" height="32" /><h1>{activeCity.displayName} {text(locale, 'sportsMap')}</h1></a>
        <Segmented className="lang-switch" label={text(locale, 'language')} value={locale} onChange={setLocale} options={[{ value: 'en', label: 'EN', ariaLabel: 'English', lang: 'en' }, { value: 'fi', label: 'FI', ariaLabel: 'Suomi', lang: 'fi' }]} />
        {routePlannerOpen && selected ? <div className="directions-panel" role="group" aria-label={locale === 'fi' ? 'Reittiohjeet' : 'Directions'}>
          <div className="directions-fields">
            <div className="field directions-origin">
              <label className="field-label" htmlFor="starting-point">{text(locale, 'startingPoint')}</label>
              <input id="starting-point" autoFocus={window.matchMedia('(pointer: fine)').matches} value={startingPoint} onChange={(event) => { locationRequestRef.current += 1; acceptedStreetRef.current = undefined; setStartingPoint(event.target.value); setOriginCoordinates(undefined); setOriginSuggestions([]); setRoutes({}); setRouteStatus('idle'); setLocationStatus('idle') }} placeholder={text(locale, 'startingPointPlaceholder')} autoComplete="off" enterKeyHint="go" onKeyDown={(event) => { if (event.key === 'Enter') calculateRoute() }} />
              <button className="icon-btn location-button" type="button" onClick={useCurrentLocation} disabled={locationStatus === 'loading'} aria-label={text(locale, 'useCurrentLocation')} title={text(locale, 'useCurrentLocation')}><RiFocus3Line aria-hidden="true" size={18} /></button>
              {originSuggestions.length > 0 && <div className="address-suggestions" role="listbox" aria-label={text(locale, 'addressSuggestions')}>{originSuggestions.map((suggestion) => <button key={`${suggestion.coordinates?.join(',') ?? suggestion.label}-${suggestion.label}`} type="button" role="option" aria-selected="false" onClick={() => { acceptedStreetRef.current = suggestion.coordinates ? undefined : suggestion.label; setStartingPoint(suggestion.label); setOriginCoordinates(suggestion.coordinates); setOriginSuggestions([]) }}>{suggestion.label}</button>)}</div>}
            </div>
            <div className="field directions-destination"><span className="field-label">{locale === 'fi' ? 'Määränpää' : 'Destination'}</span><strong>{featureDisplayName(selected, locale, selectedVenue?.lipas?.name)}</strong></div>
          </div>
          <div className="directions-actions">
            <button className="btn btn-primary" type="button" onClick={calculateRoute} disabled={routeStatus === 'loading' || !startingPoint.trim() || !selected.center}>{routeStatus === 'loading' ? text(locale, 'routing') : text(locale, 'calculateRoute')}</button>
            <button className="btn btn-ghost" type="button" onClick={closeRoutePlanner}>{locale === 'fi' ? 'Sulje' : 'Close'}</button>
          </div>
          {locationStatus === 'loading' && <p className="inline-status" role="status">{text(locale, 'locationLoading')}</p>}
          {(locationStatus === 'denied' || locationStatus === 'error') && <p className="inline-status is-error" role="status">{text(locale, locationStatus === 'denied' ? 'locationDenied' : 'locationError')}</p>}
          {routeStatus !== 'idle' && routeStatus !== 'loading' && <p className="inline-status is-error" role="status">{text(locale, routeStatus === 'error' ? 'routeError' : routeStatus === 'unavailable' ? 'routeUnavailable' : routeStatus === 'no-route' ? 'routeNoRoute' : routeStatus === 'outside-area' ? 'routeOutsideArea' : 'routeInvalid')}</p>}
          {suggestionStatus === 'loading' && <p className="inline-status" role="status">{locale === 'fi' ? 'Haetaan osoite-ehdotuksia…' : 'Finding address suggestions…'}</p>}
          {suggestionStatus === 'empty' && <p className="inline-status" role="status">{locale === 'fi' ? 'Ehdotuksia ei löytynyt. Voit silti hakea reitin kirjoittamallasi osoitteella.' : 'No suggestions. You can still find a route with what you typed.'}</p>}
          {suggestionStatus === 'error' && <p className="inline-status" role="status">{locale === 'fi' ? 'Osoite-ehdotuksia ei saatu. Voit silti hakea reitin kirjoittamallasi osoitteella.' : 'Address suggestions aren’t available. You can still find a route with what you typed.'} <button type="button" className="link-btn" onClick={() => setSuggestionRetry((value) => value + 1)}>{locale === 'fi' ? 'Yritä uudelleen' : 'Retry'}</button></p>}
          {addressError && <p className="inline-status is-error" role="status">{locale === 'fi' ? 'Lähtöpaikkaa ei löytynyt. Tarkista osoite tai käytä nykyistä sijaintia.' : 'Starting point not found. Check the address or use your current location.'}</p>}
        </div> : <div className="search-row">
          <label className="search-field">
            <RiSearchLine className="search-icon" aria-hidden="true" size={18} />
            <input ref={searchInputRef} type="search" enterKeyHint="search" value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); selectFeature(undefined); setRoutes({}) }} placeholder={text(locale, 'searchPlaceholder')} aria-label={text(locale, 'searchPlaceholder')} />
            {searchQuery && <button type="button" className="icon-btn icon-btn-sm search-clear" onClick={() => { setSearchQuery(''); searchInputRef.current?.focus() }} aria-label={text(locale, 'clearSearch')}><RiCloseLine aria-hidden="true" size={16} /></button>}
          </label>
          <button type="button" className={`btn btn-secondary near-button ${nearOrigin ? 'is-active' : ''}`} aria-pressed={Boolean(nearOrigin)} onClick={() => nearOrigin ? clearNear() : findNearMe()} disabled={nearStatus === 'locating'}><RiNavigationLine aria-hidden="true" size={16} /><span>{nearStatus === 'locating' ? (locale === 'fi' ? 'Paikannetaan…' : 'Locating…') : locale === 'fi' ? 'Lähelläni' : 'Near me'}</span></button>
          {(nearStatus === 'denied' || nearStatus === 'error') && <p className="inline-status is-error near-status" role="status">{text(locale, nearStatus === 'denied' ? 'locationDenied' : 'locationError')}</p>}
        </div>}
        {!routePlannerOpen && <nav className="chip-row" aria-label={extraText(locale, 'filterFacilities')}>
          <details ref={filterDrawerRef} className="filters">
            <summary className={`chip chip-filters ${activeFilterCount ? 'is-active' : ''}`} aria-label={activeFilterCount ? `${text(locale, 'filters')}, ${activeFilterCount}` : text(locale, 'filters')}><RiEqualizer2Line aria-hidden="true" size={16} /><span>{text(locale, 'filters')}</span>{activeFilterCount > 0 && <span className="chip-count" aria-hidden="true">{activeFilterCount}</span>}</summary>
            <div className="popover filters-panel">
              <fieldset className="filter-group"><legend>{text(locale, 'priceFilter')}</legend><Segmented label={text(locale, 'priceFilter')} value={priceFilter} onChange={setPriceFilter} options={[{ value: 'all', label: text(locale, 'allPrices') }, { value: 'free', label: text(locale, 'priceFree') }, { value: 'paid', label: text(locale, 'pricePaid') }]} /></fieldset>
              <fieldset className="filter-group"><legend>{text(locale, 'accessibilityFilter')}</legend><div className="chip-wrap">{(['stepFreeEntrance', 'accessibleToilet', 'accessibleParking'] as const).map((option) => <button key={option} type="button" className="chip" aria-pressed={accessibilityFilter === option} onClick={() => setAccessibilityFilter(accessibilityFilter === option ? 'all' : option)}>{text(locale, option)}</button>)}</div></fieldset>
              <fieldset className="filter-group"><legend>{text(locale, 'audienceFilter')}</legend><div className="chip-wrap"><button type="button" className="chip" aria-pressed={familyFilter === 'family'} onClick={() => setFamilyFilter(familyFilter === 'family' ? 'all' : 'family')}>{text(locale, 'childrenFamilies')}</button></div></fieldset>
              <div className="filters-actions">
                <button type="button" className="btn btn-ghost" onClick={clearAllFilters} disabled={!activeFilterCount && filter === 'all'}>{locale === 'fi' ? 'Tyhjennä' : 'Clear all'}</button>
                <button type="button" className="btn btn-primary" onClick={() => { if (filterDrawerRef.current) filterDrawerRef.current.open = false }}>{locale === 'fi' ? `Näytä ${formatPlaceCount(locale, visibleSports.length)}` : `Show ${formatPlaceCount(locale, visibleSports.length)}`}</button>
              </div>
            </div>
          </details>
          {/* One Tab stop for the whole row; arrow keys move between chips (WAI-ARIA toolbar). */}
          <div className="chip-scroller" role="toolbar" aria-label={text(locale, 'sport')} onKeyDown={(event) => {
            if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return
            const chips = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('.chip')]
            const index = chips.indexOf(document.activeElement as HTMLButtonElement)
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? chips.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + chips.length) % chips.length
            event.preventDefault(); chips.forEach((chip, i) => { chip.tabIndex = i === next ? 0 : -1 }); chips[next]?.focus()
          }}>
            {filterOptions.map((option) => <button key={option.id} type="button" className="chip" tabIndex={filter === option.id ? 0 : -1} aria-pressed={filter === option.id} onClick={() => selectFilter(option.id === filter && option.id !== 'all' ? 'all' : option.id)}><SportFilterIcon id={option.id} />{sportChipLabel(option.id)}</button>)}
            <button type="button" className="chip" tabIndex={-1} aria-pressed={trendingEnabled} onClick={() => setTrendingEnabled((value) => !value)}><RiFireLine aria-hidden="true" size={16} />{text(locale, 'trending')}</button>
          </div>
        </nav>}
        {canPlanRoute && <div className="travel-modes" role="group" aria-label={text(locale, 'travelMode')}>{(['walk', 'bike', 'transit', 'car'] as const).map((modeOption) => { const result = routes[modeOption]; const label = text(locale, modeOption); const ModeIcon = modeOption === 'walk' ? RiWalkLine : modeOption === 'bike' ? RiBikeLine : modeOption === 'transit' ? RiBus2Line : RiCarLine; return <button key={modeOption} className="travel-mode" type="button" aria-pressed={travelMode === modeOption} disabled={routeStatus === 'loading' || !result} aria-label={result ? `${label}, ${formatRouteDuration(locale, result.durationSeconds)}` : `${label}, ${locale === 'fi' ? 'ei saatavilla' : 'not available'}`} onClick={() => setTravelMode(modeOption)}><ModeIcon aria-hidden="true" size={18} /><small>{result ? formatRouteDuration(locale, result.durationSeconds) : '–'}</small></button> })}</div>}
        {travelMode === 'transit' && transitRoute && <section className="transit-guidance" aria-label={text(locale, 'gettingThere')}>
          <div className="transit-guidance-heading"><div><strong>{text(locale, 'hslZones')}</strong><small>{text(locale, 'hslZonesUsed')}</small></div><span className="transit-zone-ticket" aria-label={`${text(locale, 'hslZones')}: ${transitTicketZones}`}>{transitTicketZones}</span></div>
          <div className="transit-route-summary">
            {transitRoute.legs.map((leg, index) => <span className="transit-route-chip" key={`${leg.mode}-${leg.routeName ?? 'walk'}-${leg.from ?? index}`}><TransitLegIcon mode={leg.mode} /><strong>{transitCompactLabel(locale, leg)}</strong><time>{formatRouteDuration(locale, leg.durationSeconds)}</time></span>)}
          </div>
          <p>{text(locale, 'hslTicketReminder', { zones: transitTicketZones })}</p>
          <details className="disclosure">
            <summary>{text(locale, 'transitSteps')}</summary>
            <ol className="transit-legs">
              {transitRoute.legs.map((leg, index) => <li className="transit-leg" key={`${leg.mode}-${leg.routeName ?? 'walk'}-${leg.from ?? index}`}>
                <span className="transit-leg-icon"><TransitLegIcon mode={leg.mode} /></span>
                <div className="transit-leg-copy"><strong>{transitLegTitle(locale, leg, index, transitRoute.legs.length)}</strong>{transitLegDetail(locale, leg) && <span>{transitLegDetail(locale, leg)}</span>}</div>
                <time>{formatRouteDuration(locale, leg.durationSeconds)}</time>
              </li>)}
            </ol>
          </details>
          <a className="text-link" href={locale === 'fi' ? 'https://www.hsl.fi/liput-ja-hinnat/hsl-alue-ja-vyohykkeet' : 'https://www.hsl.fi/en/tickets-and-fares/hsl-area-and-zones'} target="_blank" rel="noreferrer">{text(locale, 'hslTicketInfo')} ↗</a>
        </section>}
        {canPlanRoute && !transitRoute && transitStatus === 'unavailable' && <p className="inline-status" role="status">{text(locale, 'transitUnavailable')} {selected?.center && <a className="text-link" href={transitDirectionsUrl(selected.center, resolvedOrigin ?? originCoordinates)} target="_blank" rel="noreferrer">{text(locale, 'openTransitDirections')} ↗</a>}</p>}
        {canPlanRoute && !transitRoute && transitStatus === 'no-route' && <p className="inline-status" role="status">{text(locale, 'transitNoRoute')}</p>}
      </header>

      <aside className={`sheet ${sidebarExpanded ? 'is-expanded' : ''} ${sidebarView === 'detail' && selected ? 'is-detail' : ''}`} aria-label={text(locale, 'facilityList')} onKeyDown={(event) => { if (event.key === 'Escape' && sidebarView === 'detail' && !reportDialogOpen) { event.preventDefault(); closeDetail() } }}>
        {consentVisible && <section className="consent" aria-labelledby="privacy-consent-title">
          <div className="consent-copy">
            <h2 id="privacy-consent-title">{text(locale, 'analyticsConsentTitle')}</h2>
            <p>{text(locale, 'analyticsConsentBody')}</p>
            <details className="disclosure disclosure-inline"><summary>{text(locale, 'privacyDetails')}</summary><p>{text(locale, 'privacyDetailsBody')}</p><p>{locale === 'fi' ? 'Taustakartta ladataan ensisijaisesti OpenFreeMap-palvelusta. Jos se ei ole käytettävissä, kartta käyttää OpenStreetMapin karttalaattoja. Käytetty karttapalvelu näkee verkkopyyntöjen IP-osoitteen ja pyydetyn kartta-alueen, mutta sille ei lähetetä hakutekstiä tai reittilomakkeen tietoja.' : 'The basemap loads from OpenFreeMap, with OpenStreetMap tiles as a fallback if needed. The map provider receives your IP address and requested map tile area, but not your search text or route form values.'}</p></details>
          </div>
          <div className="consent-actions">
            <button type="button" className="btn btn-secondary consent-secondary" onClick={() => chooseAnalyticsConsent('denied')}>{text(locale, 'onlyNecessary')}</button>
            <button type="button" className="btn btn-secondary consent-primary" onClick={() => chooseAnalyticsConsent('granted')}>{text(locale, 'allowAnalytics')}</button>
          </div>
        </section>}
        <header className="sheet-header">
          <span className="sheet-handle" aria-hidden="true" />
          {sidebarView === 'detail' && selected && <button type="button" className="icon-btn" onClick={closeDetail} aria-label={locale === 'fi' ? 'Takaisin listaan' : 'Back to the list'}><RiArrowLeftLine aria-hidden="true" size={20} /></button>}
          <div className="sheet-title">
            <h2 ref={detailHeadingRef} tabIndex={-1}>{sidebarView === 'detail' && selected ? featureDisplayName(selected, locale, selectedVenue?.lipas?.name) : (locale === 'fi' ? 'Paikat' : 'Places')}</h2>
            {sidebarView === 'list' && <span>{formatPlaceCount(locale, visibleSports.length)}{nearOrigin ? (locale === 'fi' ? ' · lähimmät ensin' : ' · nearest first') : ''}</span>}
          </div>
          {sidebarView === 'detail' && selected && !routePlannerOpen && <button className="icon-btn" type="button" onClick={() => setReportDialogOpen(true)} aria-label={locale === 'fi' ? 'Ilmoita virheellisestä tiedosta' : 'Report incorrect information'} title={locale === 'fi' ? 'Ilmoita virheestä' : 'Report a mistake'}><RiFlagLine aria-hidden="true" size={18} /></button>}
          <button type="button" className="icon-btn sheet-toggle" onClick={() => setSidebarExpanded((value) => !value)} aria-expanded={sidebarExpanded} aria-label={sidebarExpanded ? (locale === 'fi' ? 'Pienennä paneeli' : 'Collapse panel') : (locale === 'fi' ? 'Avaa paneeli' : 'Expand panel')}><RiArrowUpSLine aria-hidden="true" size={20} /></button>
        </header>
        <div key={sidebarView === 'detail' && selected ? selected.id : 'facility-list'} className="sheet-body">
          {sidebarView === 'detail' && selected ? <FacilityDetails feature={selected} venue={selectedVenue} trend={selectedTrend} trendingEnabled={trendingEnabled} locale={locale} route={route} travelMode={travelMode} onDirections={() => { setRoutePlannerOpen(true); setSidebarExpanded(false); if (nearOrigin && !startingPoint) { setStartingPoint(nearOrigin.label); setOriginCoordinates(nearOrigin.coordinates) } }} /> : <>
            <p className="sr-only">{text(locale, 'facilityListHint')}</p>
            {nearOrigin && <div className="note"><span>{locale === 'fi' ? 'Etäisyys kohteesta ' : 'Distance from '}<strong>{nearOrigin.label}</strong></span><button type="button" className="btn btn-ghost btn-sm" onClick={clearNear}>{locale === 'fi' ? 'Poista' : 'Clear'}</button></div>}
            {hiddenUnknownPrice > 0 && <div className="note"><span>{locale === 'fi' ? `${formatPlaceCount(locale, hiddenUnknownPrice)}, joiden hintaa ei ole ilmoitettu, on piilotettu.` : `${formatPlaceCount(locale, hiddenUnknownPrice)} with no listed price are hidden.`}</span><button type="button" className="btn btn-ghost btn-sm" onClick={() => setPriceFilter('all')}>{locale === 'fi' ? 'Näytä nekin' : 'Show them'}</button></div>}
            {visibleSports.length === 0 && (() => {
              const query = searchQuery.trim()
              const activeFilters = [
                filter !== 'all' && { label: sportText(locale, filter), clear: () => setFilter('all') },
                priceFilter !== 'all' && { label: text(locale, priceFilter === 'free' ? 'priceFree' : 'pricePaid'), clear: () => setPriceFilter('all') },
                accessibilityFilter !== 'all' && { label: text(locale, accessibilityFilter), clear: () => setAccessibilityFilter('all') },
                familyFilter !== 'all' && { label: text(locale, 'childrenFamilies'), clear: () => setFamilyFilter('all') },
              ].filter((item): item is { label: string; clear: () => void } => Boolean(item))
              return <div className="empty-state" role="status">
                <h3>{query ? (locale === 'fi' ? `Haulla ”${query}” ei löytynyt paikkoja` : `No places match “${query}”`) : (locale === 'fi' ? 'Näillä rajauksilla ei löytynyt paikkoja' : 'No places match these filters')}</h3>
                {activeFilters.length > 0 && <><p>{locale === 'fi' ? 'Rajaukset, jotka voivat piilottaa paikkoja:' : 'Filters that may be hiding places:'}</p><div className="chip-wrap">{activeFilters.map((item) => <button key={item.label} type="button" className="chip" onClick={item.clear} aria-label={`${locale === 'fi' ? 'Poista rajaus' : 'Remove filter'} ${item.label}`}>{item.label}<RiCloseLine aria-hidden="true" size={14} /></button>)}</div></>}
                {query.length >= 3 && !nearOrigin && <button type="button" className="btn btn-secondary" onClick={() => findNearAddress(query)} disabled={nearStatus === 'geocoding'}><RiNavigationLine aria-hidden="true" size={16} />{locale === 'fi' ? `Näytä paikat lähellä: ${query}` : `Show places near ${query}`}</button>}
                {nearStatus === 'notfound' && <p>{locale === 'fi' ? 'Osoitetta tai paikkaa ei löytynyt.' : 'That address or place wasn’t found.'}</p>}
                <button type="button" className="btn btn-ghost" onClick={() => { setSearchQuery(''); clearAllFilters() }}>{locale === 'fi' ? 'Tyhjennä haku ja rajaukset' : 'Clear search and filters'}</button>
              </div>
            })()}
            <ul className="place-list">{sortedSports.slice(0, listLimit).map((feature) => {
              const venue = venuesById.get(feature.id)
              const activities = summarizeActivities(venue?.sports?.map((sport) => venueActivityLabel(locale, sport)) ?? [], locale)
              const type = venueTypeLabel(venue, locale)
              const kind = [type, activities].filter(Boolean).join(' · ')
              const distance = distances?.get(feature.id)
              const price = feature.priceClass && feature.priceClass !== 'unknown' ? text(locale, priceLabelKey(feature.priceClass)) : undefined
              return <li key={feature.id}><button type="button" data-feature-id={feature.id} className="place-row" aria-current={selected?.id === feature.id ? 'true' : undefined} onClick={() => selectFeature(feature, true)}>
                <span className="place-row-main">
                  <strong>{featureDisplayName(feature, locale, venue?.lipas?.name)}</strong>
                  <span className="place-row-meta">{kind || text(locale, 'missingSports')}</span>
                  {venue?.lipas?.address && <span className="place-row-address">{venue.lipas.address}</span>}
                </span>
                {(distance !== undefined || price) && <span className="place-row-aside">{distance !== undefined && <span className="place-row-distance">{formatDistance(locale, distance)}</span>}{price && <span className="badge">{price}</span>}</span>}
              </button></li>
            })}</ul>
            {listLimit < sortedSports.length && <button className="btn btn-secondary load-more" onClick={() => { showMoreFromRef.current = listLimit; setListLimit((value) => value + 60) }}>{locale === 'fi' ? `Näytä lisää (${formatPlaceCount(locale, sortedSports.length - listLimit)} jäljellä)` : `Show more (${formatPlaceCount(locale, sortedSports.length - listLimit)} left)`}</button>}
          </>}
          <footer className="panel-footer">
            <Segmented className="lang-switch lang-switch-footer" label={text(locale, 'language')} value={locale} onChange={setLocale} options={[{ value: 'en', label: 'EN', ariaLabel: 'English', lang: 'en' }, { value: 'fi', label: 'FI', ariaLabel: 'Suomi', lang: 'fi' }]} />
            <span>{extraText(locale, 'officialDisclaimer')}</span>
            <span><a href={mapArea.source} target="_blank" rel="noreferrer">© OpenStreetMap</a> · <a href="https://www.lipas.fi/" target="_blank" rel="noreferrer">LIPAS</a> · <a href="?wiki=1">Wiki</a> · <button className="link-btn privacy-link" type="button" onClick={() => setConsentVisible(true)}>{locale === 'fi' ? 'Yksityisyys' : 'Privacy'}</button></span>
          </footer>
        </div>
      </aside>
    </div>

    <section className="map-stage" aria-label={locale === 'fi' ? 'Kartta ja kohteet' : 'Map and facilities'}>
      <SportsMap ref={mapRef} area={mapArea} features={visibleSports} selected={selected} onSelect={selectFeature} route={route} mode={mode} locale={locale} origin={nearOrigin?.coordinates} fitKey={mapFitKey} fitTargets={mapFitTargets} />
      <div className="map-controls">
        <Segmented className="segmented-vertical" orientation="vertical" label={extraText(locale, 'mapProjection')} value={mode} onChange={setMode} options={[{ value: '2d', label: '2D', ariaLabel: locale === 'fi' ? '2D-näkymä' : '2D view' }, { value: 'iso', label: locale === 'fi' ? 'Vino' : 'Tilt', ariaLabel: locale === 'fi' ? 'Vino näkymä' : 'Tilted view' }]} />
        <button type="button" className="icon-btn map-reset" onClick={() => { selectFeature(undefined); mapRef.current?.reset() }} aria-label={locale === 'fi' ? 'Palauta koko kaupungin näkymä' : 'Reset to the whole city'} title={locale === 'fi' ? 'Palauta näkymä' : 'Reset view'}><RiFullscreenExitLine aria-hidden="true" size={18} /></button>
      </div>
      {travelMode === 'transit' && transitRoute && <div className="transit-map-legend" aria-label={`${text(locale, 'hslZoneMap')}: ${transitRoute.zones.join(' · ')}`}><div className="transit-zone-key"><span className="transit-map-legend-swatch" /><strong>{text(locale, 'hslZoneMap')}</strong><span>{transitRoute.zones.join(' · ') || text(locale, 'hslZonesUnknown')}</span><small>{text(locale, 'hslZoneMapSource')}</small></div><div className="transit-route-key"><span><i className="transit-route-key-line transit-route-key-walk" />{text(locale, 'walkMode')}</span><span><i className="transit-route-key-line transit-route-key-transit" />{text(locale, 'transitMode')}</span></div></div>}
      {trendingEnabled && topTrending.length > 0 && <div className="trending-rail" aria-label={text(locale, 'trendingNow')}>
        <div className="trending-rail-heading"><strong>{text(locale, 'trendingNow')}</strong>{trendingIsPreview && <span className="badge">{text(locale, 'previewData')}</span>}</div>
        <div className="trending-items">{topTrending.map(({ feature, signal }) => {
          const venue = venuesById.get(feature.id)
          const stageKey = signal.stage === 'new' ? 'newOnList' : signal.stage === 'rising' ? 'risingInterest' : 'popularNow'
          return <button key={feature.id} type="button" className={`trending-item ${selected?.id === feature.id ? 'selected' : ''}`} onClick={() => selectFeature(feature)} aria-pressed={selected?.id === feature.id}>
            <span className="trending-item-copy"><strong>{featureDisplayName(feature, locale, venue?.name)}</strong><small>{text(locale, stageKey)} · {venue?.sports[0] ? venueActivityLabel(locale, venue.sports[0]) : venue?.facilityType ?? text(locale, 'sportsAreas')}</small></span>
            <span className="trending-score"><strong>{signal.interestScore}</strong><small>+{signal.recentChange}%</small></span>
          </button>
        })}</div>
      </div>}
      {debugVenues && <aside className="debug-venues" aria-label="Venue debug information"><strong>Debug: venues</strong><span>{venueDiagnostics.featureCount} map features · {venueDiagnostics.venueCount} venues · {venueDiagnostics.sourceCount} sources</span><span>{venueDiagnostics.duplicateNameGroups} duplicate-name groups after merge</span>{venueDiagnostics.duplicateNames.length > 0 && <span title={venueDiagnostics.duplicateNames.join(' · ')}>Examples: {venueDiagnostics.duplicateNames.join(' · ')}</span>}<span>URL flag: <code>?debug=venues</code></span></aside>}
    </section>

    {reportDialogOpen && selected && !routePlannerOpen && <div className="dialog-backdrop" role="presentation" onClick={() => setReportDialogOpen(false)}>
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="report-dialog-title" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); setReportDialogOpen(false) } }}>
        <h2 id="report-dialog-title">{locale === 'fi' ? 'Ilmoita virheestä' : 'Report a mistake'}</h2>
        <p>{locale === 'fi' ? 'Seuraavaksi avataan GitHub, jossa voit kertoa, mikä tiedoissa on väärin tai vanhentunutta.' : 'The next step opens GitHub, where you can describe what is incorrect or out of date.'}</p>
        <div className="dialog-actions">
          <button className="btn btn-ghost" type="button" autoFocus onClick={() => setReportDialogOpen(false)}>{locale === 'fi' ? 'Peruuta' : 'Cancel'}</button>
          <a className="btn btn-primary" href={reportDataUrl(locale, selected, selectedVenue)} target="_blank" rel="noreferrer" onClick={() => setReportDialogOpen(false)}>{locale === 'fi' ? 'Jatka GitHubiin' : 'Continue to GitHub'} ↗</a>
        </div>
      </section>
    </div>}
  </main>
}

export default App
