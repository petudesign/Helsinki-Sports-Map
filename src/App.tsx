import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { RiApps2Line, RiArrowDownSLine, RiBasketballLine, RiBikeLine, RiBoxingLine, RiBus2Line, RiCarLine, RiCircleLine, RiCloseLine, RiEqualizer2Line, RiErrorWarningLine, RiFireLine, RiFocus3Line, RiFootballLine, RiFootprintLine, RiLeafLine, RiMapPin2Fill, RiMapPin2Line, RiMedal2Line, RiPingPongLine, RiRunLine, RiSearchLine, RiShipLine, RiSubwayLine, RiTrainLine, RiWalkLine, RiWaterFlashLine, RiWaterPercentLine, RiWeightLine, type RemixiconComponentType } from '@remixicon/react'
import type { LipasVenue, MapDataset, SportFeature, SportsVenue } from './data/types'
import { previewTrendingSignal, type TrendingSignal } from './data/trending'
import { activeCity } from './config/city'
import { SportsMap, type MapControls } from './components/SportsMap'
import { extraText, sportText, text, type Locale } from './i18n'
import { geocodeAddress, reverseGeocode, routeByMode, routeByTransit, RouteRequestError, searchAddresses, transitDirectionsUrl, type AddressSuggestion, type RouteResult, type TravelMode } from './routing'
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
  return <details className="facility-breakdown"><summary>{text(locale, 'facilityComponents', { count: String(facilities.length) })}</summary><ul>{facilities.map((facility) => {
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
  const hasOfficialDetails = Boolean(officialShortDescription?.trim() || officialDescription?.trim() || officialServices.length || officialOpeningHours?.trim() || officialPrice?.trim() || serviceMap?.links.length)
  return <div className="facility-card" aria-live="polite">
    {venue?.lipas?.parentName && <span className="facility-parent-name">{venue.lipas.parentName}</span>}
    {serviceMap?.pictureUrl && !photoFailed && <figure className="facility-photo"><img src={serviceMap.pictureUrl} alt={photoCaption ?? featureDisplayName(feature, locale, venue?.name)} loading="lazy" decoding="async" onError={() => setPhotoFailed(true)} />{(photoCaption || serviceMap.sourceUrl) && <figcaption>{photoCaption && <span>{photoCaption}</span>}{serviceMap.sourceUrl && <a href={serviceMap.sourceUrl} target="_blank" rel="noreferrer">{locale === 'fi' ? 'Helsingin palvelukartta' : 'Helsinki Service Map'} ↗</a>}</figcaption>}</figure>}
    {trend && trendingEnabled && <section className={`trend-summary trend-${trend.stage}`}><div><span>{text(locale, trend.source === 'preview' ? 'previewScore' : 'interestSignal')}</span><strong>{trend.interestScore}</strong></div><div className="trend-summary-bar"><span style={{ '--trend-progress': trend.interestScore / 100 } as CSSProperties} /></div><small>+{trend.recentChange}% · {text(locale, trend.stage === 'new' ? 'newOnList' : trend.stage === 'rising' ? 'risingInterest' : 'popularNow')}</small></section>}
    <div className="facility-location-row">
      {venue?.lipas?.address && <p className="facility-address"><RiMapPin2Line className="location-icon" aria-hidden="true" size={16} />{venue.lipas.address}</p>}
      <button className="directions-open" type="button" onClick={onDirections}>{locale === 'fi' ? 'Reittiohjeet' : 'Directions'}</button>
    </div>
    <dl className="facility-facts"><div><dt>{text(locale, 'priceFilter')}</dt><dd>{text(locale, priceLabelKey(venue?.lipas?.priceClass ?? feature.priceClass))}</dd></div><div><dt>{text(locale, 'access')}</dt><dd>{text(locale, venue?.lipas?.accessStatus === 'open' ? 'accessOpen' : venue?.lipas?.accessStatus === 'restricted' ? 'accessRestricted' : venue?.lipas?.accessStatus === 'booking' ? 'accessBooking' : 'accessUnknown')}</dd></div></dl>
    {!venue?.lipas?.accessNoteFi && (venue?.lipas?.accessSourceUrl ?? venue?.officialUrl) && <p className="facility-access-link"><a href={venue?.lipas?.accessSourceUrl ?? venue?.officialUrl} target="_blank" rel="noreferrer">{text(locale, 'verifyAccess')} ↗</a></p>}
    {venue?.lipas?.accessNoteFi && <div className="facility-access"><span className="facility-question">{text(locale, 'access')}</span><p>{locale === 'en' ? venue.lipas.accessNoteEn : venue.lipas.accessNoteFi}</p>{venue.lipas.accessSourceUrl && <a href={venue.lipas.accessSourceUrl} target="_blank" rel="noreferrer">{text(locale, 'verifyAccess')} ↗</a>}</div>}
    {route && <span className="facility-type">{text(locale, travelMode === 'walk' ? 'walkingRoute' : travelMode)}: {Math.max(1, Math.round(route.durationSeconds / 60))} {text(locale, 'minutes')} · {Math.round(route.distanceMetres)} m</span>}
    {venue?.lipas?.typeName && !hasFacilityBreakdown && <span className="facility-type">{locale === 'en' ? venue.lipas.typeNameEn ?? venue.lipas.typeName : venue.lipas.typeName}</span>}
    {venue?.sports.length ? <><span className="facility-question">{text(locale, 'activities')}</span><ul className="facility-activities">{venue.sports.map((sport) => <li key={sport}>{venueActivityLabel(locale, sport)}</li>)}</ul></> : <p className="facility-unknown">{text(locale, 'missingSports')}</p>}
    {venue && <div className="facility-more-info">
      <FacilityBreakdown facilities={venue.lipas?.facilities ?? []} locale={locale} />
      {serviceMap && hasOfficialDetails && <details className="official-details">
        <summary>{text(locale, 'officialInfo')}</summary>
        {officialShortDescription && <p>{officialShortDescription}</p>}
        {officialDescription && <p>{officialDescription}</p>}
        {officialServices.length > 0 && <><span className="facility-question">{text(locale, 'officialServices')}</span><ul className="official-services">{officialServices.map((service) => <li key={service}>{service}</li>)}</ul></>}
        {officialOpeningHours && <><span className="facility-question">{text(locale, 'openingHours')}</span><p className="official-hours">{officialOpeningHours}</p></>}
        {officialPrice && <><span className="facility-question">{text(locale, 'priceDetails')}</span>{serviceMap.priceGroups.length > 0 ? <div className="price-groups">{serviceMap.priceGroups.map((group) => <section key={group.heading}><strong>{group.heading}</strong><ul>{group.items.map((item) => <li key={item}>{item}</li>)}</ul></section>)}</div> : <p className="official-hours">{officialPrice}</p>}</>}
        {serviceMap.links.length > 0 && <><span className="facility-question">{text(locale, 'officialLinks')}</span><ul className="official-links">{serviceMap.links.map((link) => <li key={link.url}><a href={link.url} target="_blank" rel="noreferrer">{locale === 'en' ? link.labelEn : link.labelFi} ↗</a></li>)}</ul></>}
      </details>}
      <div className="facility-links"><a href={venue.officialUrl ?? venue.sourceUrl} target="_blank" rel="noreferrer">{venue.officialUrl ? text(locale, 'openOfficial') : text(locale, 'viewSource')} ↗</a></div>
    </div>}
  </div>
}

function featureDisplayName(feature: SportFeature, locale: Locale, fallback?: string) {
  return (locale === 'en' ? feature.nameEn : feature.name) ?? feature.name ?? fallback ?? text(locale, 'selectArea')
}

const allFilterOptions: { id: SportFilter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'football', label: 'Football' }, { id: 'basketball', label: 'Basketball' }, { id: 'outdoor', label: 'Outdoor' }, { id: 'gym', label: 'Gym' },
  { id: 'athletics', label: 'Athletics' }, { id: 'swimming', label: 'Swimming' }, { id: 'outdoor_swimming', label: 'Outdoor swimming' }, { id: 'ice_hockey', label: 'Ice hockey' }, { id: 'tennis', label: 'Tennis' }, { id: 'padel', label: 'Padel' }, { id: 'martial_arts', label: 'Martial arts' }, { id: 'skateboarding', label: 'Skateboarding' },
]

const quickFilterIds: SportFilter[] = allFilterOptions.map((option) => option.id)

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

function venueActivityLabel(locale: Locale, sport: string) {
  const label = sportText(locale, sport)
  const firstCharacter = Array.from(label)[0]
  return firstCharacter ? `${firstCharacter.toLocaleUpperCase(locale === 'fi' ? 'fi-FI' : 'en-US')}${label.slice(firstCharacter.length)}` : label
}

function App() {
  const reviewMode = new URLSearchParams(window.location.search).get('review') === '1'
  const wikiMode = new URLSearchParams(window.location.search).get('wiki') === '1'
  const mapRef = useRef<MapControls>(null)
  const filterDrawerRef = useRef<HTMLDetailsElement>(null)
  const sportDrawerRef = useRef<HTMLDetailsElement>(null)
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
  const [locale, setLocale] = useState<Locale>('en')
  const [searchQuery, setSearchQuery] = useState('')
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
  const locationTimeoutRef = useRef<number | undefined>(undefined)
  const acceptedStreetRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    const closeSportDrawerOnOutsideInteraction = (event: Event) => {
      const drawer = sportDrawerRef.current
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
  const visibleSports = useMemo(() => mapArea?.sports.filter((feature) => {
    if (!matchesFilter(feature, filter)) return false
    if (!matchesPrice(feature, priceFilter)) return false
    if (!matchesAccessibility(venuesById.get(feature.id), accessibilityFilter)) return false
    if (!matchesFamily(venuesById.get(feature.id), familyFilter)) return false
    if (!normalizedSearch) return true
    return searchIndex.get(feature.id)?.some((value) => value.includes(normalizedSearch)) ?? false
  }) ?? [], [mapArea, filter, priceFilter, accessibilityFilter, familyFilter, normalizedSearch, searchIndex, venuesById])
  const sortedSports = useMemo(() => [...visibleSports].sort((a, b) => featureDisplayName(a, locale).localeCompare(featureDisplayName(b, locale), locale)), [visibleSports, locale])
  useEffect(() => { setListLimit(60) }, [visibleSports])
  useEffect(() => { if (selected && !visibleSports.some(({ id }) => id === selected.id)) selectFeature(undefined) }, [visibleSports, selected, selectFeature])
  const trendingSignals = useMemo(() => new Map<string, TrendingSignal>(mapArea?.sports.map((feature) => [feature.id, previewTrendingSignal(feature)]) ?? []), [mapArea])
  const topTrending = useMemo(() => visibleSports
    .map((feature) => ({ feature, signal: trendingSignals.get(feature.id) }))
    .filter((item): item is { feature: SportFeature; signal: TrendingSignal } => Boolean(item.signal))
    .sort((a, b) => b.signal.recentChange - a.signal.recentChange || b.signal.interestScore - a.signal.interestScore)
    .slice(0, 3), [visibleSports, trendingSignals])
  const trendingIsPreview = topTrending.some(({ signal }) => signal.source === 'preview')
  const filterOptions = allFilterOptions.filter((option) => option.id === 'all' || mapArea?.sports.some((feature) => matchesFilter(feature, option.id)))
  const quickFilterOptions = filterOptions.filter((option) => quickFilterIds.includes(option.id) || option.id === filter)
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
      setRoutes(nextRoutes); setRouteStatus('idle')
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

  const chooseAnalyticsConsent = (consent: AnalyticsConsent) => {
    setAnalyticsConsent(consent)
    setAnalyticsConsentState(consent)
    setConsentVisible(false)
  }

  if (reviewMode) return <Suspense fallback={<p>Loading review…</p>}><ReviewWorkbench /></Suspense>
  if (wikiMode) return <Suspense fallback={<p>Loading wiki…</p>}><WikiWorkbench /></Suspense>
  if (loadError) return <main className="app-shell loading-shell"><p role="alert">{locale === 'fi' ? 'Kohdetietojen lataus epäonnistui.' : 'Could not load facilities.'}</p><button onClick={() => setLoadAttempt((value) => value + 1)}>{locale === 'fi' ? 'Yritä uudelleen' : 'Retry'}</button></main>
  if (!mapArea) return <main className="app-shell loading-shell"><div className="loading-state"><span className="status-dot" /><strong>{text(locale, 'loading', { city: activeCity.displayName })}</strong><span>{text(locale, 'preparing')}</span></div></main>

  return <main className={`app-shell ${selected ? 'has-selection' : ''} ${routePlannerOpen ? 'route-planner-open' : ''}`}>
    <header className="topbar">
      <div className="brand-block"><div className="brand-lockup"><img src="/helsinkisportsmaplogo.png" alt="" aria-hidden="true" /><h1>{activeCity.displayName} {text(locale, 'sportsMap')}</h1></div><p>{extraText(locale, 'areaLabel')}</p></div>
      <div className="topbar-right"><a className="wiki-entry" href="?wiki=1">Wiki</a><div className="mode-toggle" aria-label={extraText(locale, 'mapProjection')}><button className={mode === '2d' ? 'selected' : ''} aria-pressed={mode === '2d'} onClick={() => setMode('2d')}>{extraText(locale, 'mode2d')}</button><button className={mode === 'iso' ? 'selected' : ''} aria-pressed={mode === 'iso'} onClick={() => setMode('iso')}>{locale === 'fi' ? 'Vino' : 'Tilt'}</button></div><div className="language-toggle" aria-label={String(text(locale, 'language'))}><button className={locale === 'en' ? 'selected' : ''} aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>EN</button><button className={locale === 'fi' ? 'selected' : ''} aria-pressed={locale === 'fi'} onClick={() => setLocale('fi')}>FI</button></div></div>
    </header>
    <nav className="filter-bar" aria-label={extraText(locale, 'filterFacilities')}><div className="filter-options filter-quick-options">{quickFilterOptions.map((option) => <button key={option.id} className={filter === option.id ? 'selected' : ''} aria-pressed={filter === option.id} onClick={() => selectFilter(option.id)}><SportFilterIcon id={option.id} />{option.id === 'all' ? text(locale, 'all') : sportText(locale, option.id)}</button>)}</div><details ref={sportDrawerRef} className="sport-drawer"><summary className="filter-see-all"><span>{locale === 'fi' ? 'Kaikki kategoriat' : 'All categories'}</span><RiArrowDownSLine aria-hidden="true" size={15} /></summary><div className="sport-drawer-panel">{filterOptions.map((option) => <button key={option.id} className={filter === option.id ? 'selected' : ''} aria-pressed={filter === option.id} onClick={() => { selectFilter(option.id); if (sportDrawerRef.current) sportDrawerRef.current.open = false }}><SportFilterIcon id={option.id} />{option.id === 'all' ? text(locale, 'all') : sportText(locale, option.id)}</button>)}</div></details><button type="button" className={'trend-toggle trend-nav-toggle ' + (trendingEnabled ? 'selected' : '')} aria-label={text(locale, 'trending')} aria-pressed={trendingEnabled} onClick={() => setTrendingEnabled((value) => !value)}><RiFireLine className="trend-toggle-icon" aria-hidden="true" size={17} /><span className="trend-toggle-text">{text(locale, 'trending')}</span></button><details ref={filterDrawerRef} className="filter-drawer"><summary aria-label={text(locale, 'filters')}><RiEqualizer2Line className="filter-drawer-icon" aria-hidden="true" size={17} /><span className="filter-drawer-summary-text">{text(locale, 'filters')}</span>{activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}</summary><div className="filter-drawer-panel"><div className="filter-drawer-group filter-sport-group"><span className="filter-drawer-label">{text(locale, 'sport')}</span><div className="filter-options filter-drawer-sport-options">{filterOptions.map((option) => <button key={option.id} className={filter === option.id ? 'selected' : ''} aria-pressed={filter === option.id} onClick={() => selectFilter(option.id)}><SportFilterIcon id={option.id} />{option.id === 'all' ? text(locale, 'all') : sportText(locale, option.id)}</button>)}</div></div><div className="filter-drawer-group"><span className="filter-drawer-label">{text(locale, 'priceFilter')}</span><div className="filter-options">{(['all', 'free', 'paid'] as const).map((option) => <button key={option} className={priceFilter === option ? 'selected' : ''} aria-pressed={priceFilter === option} onClick={() => setPriceFilter(option)}>{text(locale, option === 'all' ? 'allPrices' : option === 'free' ? 'priceFree' : 'pricePaid')}</button>)}</div></div><div className="filter-drawer-group"><span className="filter-drawer-label">{text(locale, 'accessibilityFilter')}</span><div className="filter-options">{(['all', 'stepFreeEntrance', 'accessibleToilet', 'accessibleParking'] as const).map((option) => <button key={option} className={accessibilityFilter === option ? 'selected' : ''} aria-pressed={accessibilityFilter === option} onClick={() => setAccessibilityFilter(option)}>{text(locale, option === 'all' ? 'allAccessibility' : option)}</button>)}</div></div><div className="filter-drawer-group"><span className="filter-drawer-label">{text(locale, 'audienceFilter')}</span><div className="filter-options"><button className={familyFilter === 'all' ? 'selected' : ''} aria-pressed={familyFilter === 'all'} onClick={() => setFamilyFilter('all')}>{text(locale, 'allAudiences')}</button><button className={familyFilter === 'family' ? 'selected' : ''} aria-pressed={familyFilter === 'family'} onClick={() => setFamilyFilter('family')}>{text(locale, 'childrenFamilies')}</button></div></div></div></details><span className="result-count">{visibleSports.length} {text(locale, 'areas')}</span></nav>
    {routePlannerOpen && selected ? <div className="directions-panel" role="group" aria-label={locale === 'fi' ? 'Reittiohjeet' : 'Directions'}>
      <div className="directions-track" aria-hidden="true"><RiCircleLine size={17} /><span /><RiMapPin2Fill size={18} /></div>
      <div className="directions-fields">
        <div className="directions-origin">
          <label className="directions-field-label" htmlFor="starting-point">{text(locale, 'startingPoint')}</label>
          <input id="starting-point" value={startingPoint} onChange={(event) => { locationRequestRef.current += 1; acceptedStreetRef.current = undefined; setStartingPoint(event.target.value); setOriginCoordinates(undefined); setOriginSuggestions([]); setRoutes({}); setRouteStatus('idle'); setLocationStatus('idle') }} placeholder={text(locale, 'startingPointPlaceholder')} aria-label={text(locale, 'startingPoint')} autoComplete="off" />
          <button className="location-button" type="button" onClick={useCurrentLocation} disabled={locationStatus === 'loading'} aria-label={text(locale, 'useCurrentLocation')} title={text(locale, 'useCurrentLocation')}><RiFocus3Line aria-hidden="true" size={16} /></button>
          {originSuggestions.length > 0 && <div className="address-suggestions" role="listbox" aria-label={text(locale, 'addressSuggestions')}>{originSuggestions.map((suggestion) => <button key={`${suggestion.coordinates?.join(',') ?? suggestion.label}-${suggestion.label}`} type="button" role="option" onClick={() => { acceptedStreetRef.current = suggestion.coordinates ? undefined : suggestion.label; setStartingPoint(suggestion.label); setOriginCoordinates(suggestion.coordinates); setOriginSuggestions([]) }}>{suggestion.label}</button>)}</div>}
        </div>
        <div className="directions-destination"><span>{locale === 'fi' ? 'Määränpää' : 'Destination'}</span><strong>{featureDisplayName(selected, locale, selectedVenue?.lipas?.name)}</strong></div>
      </div>
      <button className="directions-close" type="button" onClick={closeRoutePlanner} aria-label={locale === 'fi' ? 'Sulje reittiohjeet' : 'Close directions'}><RiCloseLine aria-hidden="true" size={19} /></button>
      <button className="route-button directions-submit" type="button" onClick={calculateRoute} disabled={routeStatus === 'loading' || !startingPoint.trim() || !selected.center}>{routeStatus === 'loading' ? text(locale, 'routing') : text(locale, 'calculateRoute')}</button>
      {locationStatus === 'loading' && <span className="location-status" role="status">{text(locale, 'locationLoading')}</span>}
      {locationStatus === 'denied' && <span className="location-status error" role="status">{text(locale, 'locationDenied')}</span>}
      {locationStatus === 'error' && <span className="location-status error" role="status">{text(locale, 'locationError')}</span>}
       {routeStatus === 'error' && <span className="route-error">{text(locale, 'routeError')}</span>}
       {routeStatus === 'unavailable' && <span className="route-error">{text(locale, 'routeUnavailable')}</span>}
       {routeStatus === 'no-route' && <span className="route-error">{text(locale, 'routeNoRoute')}</span>}
       {routeStatus === 'outside-area' && <span className="route-error">{text(locale, 'routeOutsideArea')}</span>}
       {routeStatus === 'invalid' && <span className="route-error">{text(locale, 'routeInvalid')}</span>}
    </div> : <div className="search-row">
      <label className="search-control"><RiSearchLine className="search-icon" aria-hidden="true" size={16} /><input value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); selectFeature(undefined); setRoutes({}) }} placeholder={text(locale, 'searchPlaceholder')} aria-label={text(locale, 'searchPlaceholder')} />{searchQuery && <button type="button" onClick={() => setSearchQuery('')} aria-label={text(locale, 'clearSearch')}>×</button>}</label>
      {searchQuery.trim() && deferredSearchQuery === searchQuery && visibleSports.length === 1 && !selected && <button className="select-result-button" type="button" onClick={() => selectFeature(visibleSports[0], true)}>{text(locale, 'selectResult')}: {featureDisplayName(visibleSports[0], locale)}</button>}
    </div>}
    {canPlanRoute && <div className="travel-mode-row" aria-label={text(locale, 'travelMode')}><span className="travel-mode-label">{text(locale, 'travelMode')}</span>{(['walk', 'bike', 'transit', 'car'] as const).map((modeOption) => { const result = routes[modeOption]; const label = text(locale, modeOption); const ModeIcon = modeOption === 'walk' ? RiWalkLine : modeOption === 'bike' ? RiBikeLine : modeOption === 'transit' ? RiBus2Line : RiCarLine; return <button key={modeOption} className={`travel-mode mode-${modeOption} ${travelMode === modeOption ? 'selected' : ''} ${!result ? 'unavailable' : ''}`} type="button" disabled={routeStatus === 'loading' || !result} aria-label={label} title={label} onClick={() => setTravelMode(modeOption)}><ModeIcon className="travel-mode-icon" aria-hidden="true" size={20} /><span className="travel-mode-name">{label}</span>{result && <small>{formatRouteDuration(locale, result.durationSeconds)}</small>}</button> })}</div>}
    {travelMode === 'transit' && transitRoute && <aside className="transit-guidance" role="status">
      <div className="transit-guidance-heading"><div><strong>{text(locale, 'hslZones')}</strong><small>{text(locale, 'hslZonesUsed')}</small></div><span className="transit-zone-ticket" aria-label={`${text(locale, 'hslZones')}: ${transitTicketZones}`}>{transitTicketZones}</span></div>
      <div className="transit-route-summary" aria-label={text(locale, 'gettingThere')}>
        {transitRoute.legs.map((leg, index) => <span className={`transit-route-chip transit-route-chip-${leg.mode.toLowerCase()}`} key={`${leg.mode}-${leg.routeName ?? 'walk'}-${leg.from ?? index}`}><TransitLegIcon mode={leg.mode} /><strong>{transitCompactLabel(locale, leg)}</strong><time>{formatRouteDuration(locale, leg.durationSeconds)}</time></span>)}
      </div>
      <p className="transit-ticket-reminder">{text(locale, 'hslTicketReminder', { zones: transitTicketZones })}</p>
      <details className="transit-steps">
        <summary><span>{text(locale, 'transitSteps')}</span><small>{text(locale, 'transitStepsHint')}</small></summary>
        <div className="transit-leg-summary" aria-label={text(locale, 'gettingThere')}>
          {transitRoute.legs.map((leg, index) => <div className={`transit-leg transit-leg-${leg.mode.toLowerCase()}`} key={`${leg.mode}-${leg.routeName ?? 'walk'}-${leg.from ?? index}`}>
            <span className="transit-leg-icon"><TransitLegIcon mode={leg.mode} /></span>
            <div className="transit-leg-copy"><strong>{transitLegTitle(locale, leg, index, transitRoute.legs.length)}</strong>{transitLegDetail(locale, leg) && <span>{transitLegDetail(locale, leg)}</span>}</div>
            <time>{formatRouteDuration(locale, leg.durationSeconds)}</time>
          </div>)}
        </div>
      </details>
      <a href={locale === 'fi' ? 'https://www.hsl.fi/liput-ja-hinnat/hsl-alue-ja-vyohykkeet' : 'https://www.hsl.fi/en/tickets-and-fares/hsl-area-and-zones'} target="_blank" rel="noreferrer">{text(locale, 'hslTicketInfo')} ↗</a>
    </aside>}
    {travelMode === 'transit' && !transitRoute && transitStatus === 'unavailable' && <p className="journey-note" role="status">{text(locale, 'transitUnavailable')} {originCoordinates && selected?.center && <a href={transitDirectionsUrl(selected.center, originCoordinates)} target="_blank" rel="noreferrer">{text(locale, 'openTransitDirections')} ↗</a>}</p>}
    {travelMode === 'transit' && !transitRoute && transitStatus === 'no-route' && <p className="journey-note" role="status">{text(locale, 'transitNoRoute')}</p>}
    <div className="journey-feedback" role="status">
      {routePlannerOpen && suggestionStatus === 'loading' && <p>{locale === 'fi' ? 'Haetaan osoite-ehdotuksia…' : 'Finding address suggestions…'}</p>}
      {routePlannerOpen && suggestionStatus === 'empty' && <p>{locale === 'fi' ? 'Osoite-ehdotuksia ei löytynyt. Tarkista kadun nimi ja talonnumero.' : 'No address suggestions found. Check the street name and house number.'}</p>}
      {routePlannerOpen && suggestionStatus === 'error' && <p>{locale === 'fi' ? 'Osoitepalveluun ei saada yhteyttä. Tarkista verkkoyhteys ja että paikallinen palvelin on käynnissä.' : 'Cannot reach the address service. Check your connection and that the local server is running.'} <button type="button" onClick={() => setSuggestionRetry((value) => value + 1)}>{locale === 'fi' ? 'Yritä uudelleen' : 'Retry'}</button></p>}
      {routePlannerOpen && addressError && <p>{locale === 'fi' ? 'Lähtöpaikan osoitehaku epäonnistui. Tarkista osoite tai käytä nykyistä sijaintia.' : 'Starting-point lookup failed. Check the address or use your current location.'}</p>}
      {visibleSports.length === 0 && <p>{locale === 'fi' ? 'Näillä rajauksilla ei löytynyt liikuntapaikkoja.' : 'No facilities match these filters.'} <button type="button" onClick={() => { setSearchQuery(''); setFilter('all'); setPriceFilter('all'); setAccessibilityFilter('all'); setFamilyFilter('all') }}>{locale === 'fi' ? 'Poista hakurajaukset' : 'Clear search and filters'}</button></p>}
    </div>
    <div className="map-workspace">
      <aside className={`facility-sidebar ${sidebarExpanded ? 'is-expanded' : ''}`} aria-label={text(locale, 'facilityList')}>
        <header className="facility-sidebar-header">
          {sidebarView === 'detail' && selected && <button type="button" className="facility-sidebar-back" onClick={() => { setSidebarView('list'); setSidebarExpanded(true) }} aria-label={locale === 'fi' ? 'Takaisin liikuntapaikkalistaan' : 'Back to facility list'}>←</button>}
          <div className="facility-sidebar-heading">
            <h2>{sidebarView === 'detail' && selected ? featureDisplayName(selected, locale, selectedVenue?.lipas?.name) : text(locale, 'facilityList')}</h2>
            {sidebarView === 'list' && <span>{`${visibleSports.length} ${text(locale, 'areas')}`}</span>}
          </div>
          {sidebarView === 'detail' && selected && !routePlannerOpen && <button className="facility-report" type="button" onClick={() => setReportDialogOpen(true)} aria-label={locale === 'fi' ? 'Ilmoita virheellisestä tiedosta' : 'Report incorrect information'} title={locale === 'fi' ? 'Ilmoita virheellisestä tiedosta' : 'Report incorrect information'}><RiErrorWarningLine aria-hidden="true" size={19} /></button>}
          <button type="button" className="facility-sidebar-toggle" onClick={() => setSidebarExpanded((value) => !value)} aria-expanded={sidebarExpanded} aria-label={sidebarExpanded ? (locale === 'fi' ? 'Pienennä paneeli' : 'Collapse panel') : (locale === 'fi' ? 'Avaa paneeli' : 'Expand panel')}><RiArrowDownSLine aria-hidden="true" size={19} /></button>
        </header>
        <div key={sidebarView === 'detail' && selected ? selected.id : 'facility-list'} className="facility-sidebar-content">
          {sidebarView === 'detail' && selected ? <FacilityDetails feature={selected} venue={selectedVenue} trend={selectedTrend} trendingEnabled={trendingEnabled} locale={locale} route={route} travelMode={travelMode} onDirections={() => { setSearchQuery(''); setRoutePlannerOpen(true); setSidebarExpanded(false) }} /> : <>
            <p className="facility-list-hint">{text(locale, 'facilityListHint')}</p>
            <div className="facility-results" role="list">{sortedSports.slice(0, listLimit).map((feature) => { const venue = venuesById.get(feature.id); const activities = venue?.sports?.map((sport) => venueActivityLabel(locale, sport)).join(', '); return <div role="listitem" key={feature.id}><button type="button" className={selected?.id === feature.id ? 'selected' : ''} aria-pressed={selected?.id === feature.id} onClick={() => selectFeature(feature, true)}><strong>{featureDisplayName(feature, locale, venue?.lipas?.name)}</strong><span className="facility-list-activities">{activities || (venue?.lipas?.typeName ? locale === 'en' ? venue.lipas.typeNameEn ?? venue.lipas.typeName : venue.lipas.typeName : text(locale, 'missingSports'))}</span>{venue?.lipas?.address && <span className="facility-list-address">{venue.lipas.address}</span>}<span className="facility-price">{text(locale, priceLabelKey(feature.priceClass))}</span></button></div> })}</div>
            {listLimit < sortedSports.length && <button className="load-more" onClick={() => setListLimit((value) => value + 60)}>{locale === 'fi' ? 'Näytä lisää' : 'Show more'}</button>}
          </>}
        </div>
      </aside>
    <section className="map-stage" aria-label={locale === 'fi' ? 'Kartta ja kohteet' : 'Map and facilities'}>
      <SportsMap ref={mapRef} area={mapArea} features={visibleSports} selected={selected} onSelect={selectFeature} route={route} mode={mode} locale={locale} />
      {travelMode === 'transit' && transitRoute && <div className="transit-map-legend" aria-label={`${text(locale, 'hslZoneMap')}: ${transitRoute.zones.join(' · ')}`}><div className="transit-zone-key"><span className="transit-map-legend-swatch" /><strong>{text(locale, 'hslZoneMap')}</strong><span>{transitRoute.zones.join(' · ') || text(locale, 'hslZonesUnknown')}</span><small>{text(locale, 'hslZoneMapSource')}</small></div><div className="transit-route-key"><span><i className="transit-route-key-line transit-route-key-walk" />{text(locale, 'walkMode')}</span><span><i className="transit-route-key-line transit-route-key-transit" />{text(locale, 'transitMode')}</span></div></div>}
      {trendingEnabled && topTrending.length > 0 && <div className="trending-rail" aria-label={text(locale, 'trendingNow')}>
        <div className="trending-rail-heading"><span className="trend-pulse" /><div><strong>{text(locale, 'trendingNow')}{trendingIsPreview && <span className="trend-preview-badge">{text(locale, 'previewData')}</span>}</strong><small>{locale === 'fi' ? 'Valitse kohde, niin se nostetaan kartalta esiin.' : 'Select a place to lift it from the map.'}</small></div></div>
        <div className="trending-items">{topTrending.map(({ feature, signal }, index) => {
          const venue = venuesById.get(feature.id)
          const stageKey = signal.stage === 'new' ? 'newOnList' : signal.stage === 'rising' ? 'risingInterest' : 'popularNow'
          return <button key={feature.id} type="button" className={`trending-item trend-${signal.stage} ${selected?.id === feature.id ? 'selected' : ''}`} onClick={() => selectFeature(feature)} aria-pressed={selected?.id === feature.id}>
            <span className="trending-rank">0{index + 1}</span>
            <span className="trending-item-copy"><strong>{featureDisplayName(feature, locale, venue?.name)}</strong><small>{venue?.sports[0] ? venueActivityLabel(locale, venue.sports[0]) : venue?.facilityType ?? text(locale, 'sportsAreas')}</small></span>
            <span className="trending-score"><strong>{signal.interestScore}</strong><small>+{signal.recentChange}%</small></span>
            <span className="trending-stage">{text(locale, stageKey)}</span>
          </button>
        })}</div>
      </div>}
      {!selected && <div className="map-legend"><div><span className="legend-swatch facility" /> {text(locale, "selectArea")}</div><div><span className="legend-swatch park" /> {text(locale, "contextMap")}</div><div><span className="legend-swatch water" /> {text(locale, "water")}</div>{trendingEnabled && <><div className="legend-divider" /><div><span className="legend-swatch trend-new" /> {text(locale, "newOnList")}</div><div><span className="legend-swatch trend-rising" /> {text(locale, "risingInterest")}</div><div><span className="legend-swatch trend-popular" /> {text(locale, "popularNow")}</div>{trendingIsPreview && <small>{text(locale, "trendingNote")}</small>}</>}</div>}
     {debugVenues && <aside className="debug-venues" aria-label="Venue debug information"><strong>DEBUG / VENUES</strong><span>{venueDiagnostics.featureCount} map features · {venueDiagnostics.venueCount} venues · {venueDiagnostics.sourceCount} sources</span><span>{venueDiagnostics.duplicateNameGroups} duplicate-name groups after merge</span>{venueDiagnostics.duplicateNames.length > 0 && <span title={venueDiagnostics.duplicateNames.join(' · ')}>Examples: {venueDiagnostics.duplicateNames.join(' · ')}</span>}<span>URL flag: <code>?debug=venues</code></span></aside>}
      <button className="map-reset" onClick={() => { selectFeature(undefined); mapRef.current?.reset() }}>{text(locale, 'reset')}</button>
    </section>
      {reportDialogOpen && selected && !routePlannerOpen && <div className="report-dialog-backdrop" role="presentation" onClick={() => setReportDialogOpen(false)}>
        <aside className="report-dialog" role="dialog" aria-modal="true" aria-labelledby="report-dialog-title" onClick={(event) => event.stopPropagation()}>
          <button className="report-dialog-close" type="button" onClick={() => setReportDialogOpen(false)} aria-label={locale === 'fi' ? 'Sulje raportointi' : 'Close report dialog'}><RiCloseLine aria-hidden="true" size={18} /></button>
          <span className="report-dialog-kicker">{locale === 'fi' ? 'Tarkista tiedot' : 'Check this information'}</span>
          <h2 id="report-dialog-title">{locale === 'fi' ? 'Haluatko lähettää raportin?' : 'Want to send a report?'}</h2>
          <p>{locale === 'fi' ? 'Seuraavaksi avataan GitHub, jossa voit kertoa, mikä tiedoissa on väärin tai vanhentunutta.' : 'The next step opens GitHub, where you can describe what is incorrect or out of date.'}</p>
          <div className="report-dialog-actions">
            <button className="report-dialog-cancel" type="button" onClick={() => setReportDialogOpen(false)}>{locale === 'fi' ? 'Peruuta' : 'Cancel'}</button>
            <a className="report-dialog-confirm" href={reportDataUrl(locale, selected, selectedVenue)} target="_blank" rel="noreferrer" onClick={() => setReportDialogOpen(false)}>{locale === 'fi' ? 'Jatka GitHubiin' : 'Continue to GitHub'} ↗</a>
          </div>
        </aside>
      </div>}
    </div>
    <footer className="footer"><a href={mapArea.source} target="_blank" rel="noreferrer">{mapArea.attribution} · ODbL</a><span className="footer-disclaimer">{extraText(locale, 'officialDisclaimer')}</span><button className="privacy-link" type="button" onClick={() => setConsentVisible(true)}>{text(locale, 'privacySettings')}</button></footer>
    {consentVisible && <aside className="consent-banner" role="dialog" aria-labelledby="privacy-consent-title" aria-describedby="privacy-consent-body"><div><span className="consent-kicker">{text(locale, 'privacySettings')}</span><strong id="privacy-consent-title">{text(locale, 'analyticsConsentTitle')}</strong><p id="privacy-consent-body">{text(locale, 'analyticsConsentBody')}</p><details className="consent-details"><summary>{text(locale, 'privacyDetails')}</summary><p>{text(locale, 'privacyDetailsBody')}</p><p>{locale === 'fi' ? 'Taustakartta ladataan ensisijaisesti OpenFreeMap-palvelusta. Jos se ei ole käytettävissä, kartta käyttää OpenStreetMapin karttalaattoja. Käytetty karttapalvelu näkee verkkopyyntöjen IP-osoitteen ja pyydetyn kartta-alueen, mutta sille ei lähetetä hakutekstiä tai reittilomakkeen tietoja.' : 'The basemap loads from OpenFreeMap, with OpenStreetMap tiles as a fallback if needed. The map provider receives your IP address and requested map tile area, but not your search text or route form values.'}</p></details></div><div className="consent-actions"><button type="button" className="consent-secondary" onClick={() => chooseAnalyticsConsent('denied')}>{text(locale, 'onlyNecessary')}</button><button type="button" className="consent-primary" onClick={() => chooseAnalyticsConsent('granted')}>{text(locale, 'allowAnalytics')}</button></div></aside>}
  </main>
}

export default App
