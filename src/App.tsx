import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { RiArrowLeftLine, RiArrowLeftSLine, RiArrowRightSLine, RiArrowUpSLine, RiBikeLine, RiBus2Line, RiCarLine, RiCheckLine, RiCloseLine, RiEqualizer2Line, RiFireLine, RiFlagLine, RiFocus3Line, RiFullscreenExitLine, RiMapPin2Line, RiNavigationLine, RiPencilLine, RiSearchLine, RiShareForwardLine, RiWalkLine } from '@remixicon/react'
import type { GeoPoint, MapDataset, SportFeature } from './data/types'
import { previewTrendingSignal, type TrendingSignal } from './data/trending'
import { activeCity } from './config/city'
import { distanceMetres } from './data/geometry'
import { nameKey } from './data/text'
import type { MapControls } from './components/SportsMap'
// MapLibre is ~1 MB: load it in its own chunk, starting immediately, so the panel can paint first.
const sportsMapModule = import('./components/SportsMap')
const SportsMap = lazy(() => sportsMapModule.then((module) => ({ default: module.SportsMap })))
import { Segmented } from './ui/Segmented'
import { ErrorBoundary, reloadPage } from './ui/ErrorBoundary'
import { useSheetDrag, type SheetSnap } from './ui/useSheetDrag'
import { useHorizontalScroll } from './ui/useHorizontalScroll'
import { extraText, formatPlaceCount, sportText, text, type Locale } from './i18n'
import { type SportFilter, type PriceFilter, type AccessibilityFilter, type FamilyFilter, allFilterOptions, matchesFilter, matchesPrice, matchesAccessibility, matchesFamily } from './filters'
import { AREA_FALLBACK_RADIUS_METRES, buildSearchEntry, evaluateSearchMatch, parseSearchQuery } from './search'
import { formatDistance, venueTypeLabel, featureDisplayName, priceLabelKey, formatRouteDuration, transitLegTitle, transitLegDetail, transitCompactLabel, hslTicketZones, reportDataUrl, summarizeActivities, venueActivityLabel, placeKindLabel } from './format'
import { PlaceTile, SportFilterIcon, TransitLegIcon, SuggestionIcon } from './components/icons'
import { FacilityDetails } from './components/FacilityDetails'
import { routeByMode, routeByTransit, RouteRequestError, transitDirectionsUrl, type RouteResult, type TravelMode } from './routing'
import { geocodeAddress, reverseGeocode, searchAddresses, type AddressSuggestion } from './geocoding'
import { installStressEnvironment, stressInitialSearch } from './dev/stress'
import { getAnalyticsConsent, setAnalyticsConsent, type AnalyticsConsent } from './privacy'
// Dev-only: the ternary lets the production build drop these chunks entirely.
const ReviewWorkbench = import.meta.env.DEV ? lazy(() => import('./review/ReviewWorkbench').then((module) => ({ default: module.ReviewWorkbench }))) : () => null
const WikiWorkbench = import.meta.env.DEV ? lazy(() => import('./wiki/WikiWorkbench').then((module) => ({ default: module.WikiWorkbench }))) : () => null

type Mode = '2d' | 'iso'

const LOCALE_KEY = 'hsm-locale'
function initialLocale(): Locale {
  const param = new URLSearchParams(window.location.search).get('lang')
  if (param === 'fi' || param === 'en') return param
  try { const stored = localStorage.getItem(LOCALE_KEY); if (stored === 'fi' || stored === 'en') return stored } catch { /* storage blocked */ }
  return navigator.languages?.some((language) => language.toLowerCase().startsWith('fi')) ? 'fi' : 'en'
}
function initialSportFilter(): SportFilter {
  const param = new URLSearchParams(window.location.search).get('sport')
  return allFilterOptions.some((option) => option.id === param) ? (param as SportFilter) : 'all'
}
function placeSlug(feature: SportFeature) {
  const numericId = feature.id.match(/(\d+)$/)?.[1]
  const base = (feature.name ?? feature.id)
    .toLocaleLowerCase('fi-FI')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return numericId ? `${base}-${numericId}` : base || feature.id
}

const prefetchedPhotos = new Set<string>()
function prefetchPhoto(url: string | undefined) {
  if (!url || prefetchedPhotos.has(url)) return
  prefetchedPhotos.add(url)
  const img = new Image()
  img.decoding = 'async'
  img.src = url
}

if (import.meta.env.DEV) installStressEnvironment()

function App() {
  // Internal tools are local-only and stay out of the production bundle.
  const reviewMode = import.meta.env.DEV && new URLSearchParams(window.location.search).get('review') === '1'
  const wikiMode = import.meta.env.DEV && new URLSearchParams(window.location.search).get('wiki') === '1'
  const mapRef = useRef<MapControls>(null)
  const filterDrawerRef = useRef<HTMLDetailsElement>(null)
  const [loadError, setLoadError] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [sidebarView, setSidebarView] = useState<'list' | 'detail'>('list')
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>('peek')
  const sheetRef = useRef<HTMLElement>(null)
  const sheetHeaderRef = useRef<HTMLElement>(null)
  const topbarRef = useRef<HTMLElement>(null)
  const [isPhone, setIsPhone] = useState(() => window.matchMedia('(max-width: 720px)').matches)
  useEffect(() => { const query = window.matchMedia('(max-width: 720px)'); const update = () => setIsPhone(query.matches); query.addEventListener('change', update); return () => query.removeEventListener('change', update) }, [])
  const sheetExpanded = sheetSnap !== 'peek'
  const [listLimit, setListLimit] = useState(60)
  const [mapArea, setMapArea] = useState<MapDataset>()
  const [mode, setMode] = useState<Mode>('2d')
  const [filter, setFilter] = useState<SportFilter>(initialSportFilter)
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all')
  const [accessibilityFilter, setAccessibilityFilter] = useState<AccessibilityFilter>('all')
  const [familyFilter, setFamilyFilter] = useState<FamilyFilter>('all')
  const [selected, setSelected] = useState<SportFeature>()
  const [routePlannerOpen, setRoutePlannerOpen] = useState(false)
  const [editingRoute, setEditingRoute] = useState(true)
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [copiedShare, setCopiedShare] = useState(false)
  const shareTimerRef = useRef<number | undefined>(undefined)
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
  const reportButtonRef = useRef<HTMLButtonElement>(null)
  const wasReportOpen = useRef(false)
  // Focus returns to the button that opened the dialog.
  useEffect(() => { if (wasReportOpen.current && !reportDialogOpen) reportButtonRef.current?.focus(); wasReportOpen.current = reportDialogOpen }, [reportDialogOpen])
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
  const chipScroll = useHorizontalScroll<HTMLDivElement>()
  const [debugVenues] = useState(() => new URLSearchParams(window.location.search).get('debug') === 'venues')
  const locationRequestRef = useRef(0)
  const initialPlaceIdRef = useRef<string | null>(new URLSearchParams(window.location.search).get('place'))
  useEffect(() => {
    if (!mapArea || !initialPlaceIdRef.current) return
    const targetId = initialPlaceIdRef.current
    initialPlaceIdRef.current = null
    const match = mapArea.sports.find((feature) => feature.id === targetId || placeSlug(feature) === targetId)
    if (match) {
      setSelected(match)
      setSidebarView('detail')
      setSheetSnap('half')
    }
  }, [mapArea])
  useEffect(() => {
    if (reviewMode || wikiMode) return
    const params = new URLSearchParams(window.location.search)
    params.set('lang', locale)
    if (filter !== 'all') params.set('sport', filter)
    else params.delete('sport')
    if (selected) params.set('place', placeSlug(selected))
    else if (!initialPlaceIdRef.current) params.delete('place')
    const query = params.toString()
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
    if (nextUrl !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(null, '', nextUrl)
    }
    const appTitle = text(locale, 'appName')
    document.title = selected
      ? `${featureDisplayName(selected, locale)} · ${appTitle}`
      : filter !== 'all'
        ? `${sportText(locale, filter)} · ${appTitle}`
        : appTitle
  }, [locale, filter, selected, reviewMode, wikiMode])
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
    // Opening a place shows it at half height with the pin above; closing keeps the sheet where it was.
    if (feature) setSheetSnap('half')
    void expandSidebar
    setRoutePlannerOpen(false)
    setReportDialogOpen(false)
  }, [])
  useEffect(() => { const stored = getAnalyticsConsent(); setAnalyticsConsentState(stored); setConsentVisible(stored === undefined) }, [])
  const venuesById = useMemo(() => new Map(mapArea?.venues.map((venue) => [venue.id, venue]) ?? []), [mapArea])
  const parsedSearch = useMemo(() => parseSearchQuery(deferredSearchQuery), [deferredSearchQuery])
  const hasSearch = parsedSearch.raw.length > 0
  // Build the folded search index once when the dataset loads, never on the first keystroke.
  const searchIndex = useMemo(() => new Map((mapArea?.sports ?? []).map((feature) => [feature.id, buildSearchEntry(feature, venuesById.get(feature.id))])), [mapArea, venuesById])
  const normalizedSearch = parsedSearch.raw
  const searchMatches = useMemo(() => {
    if (!hasSearch) return undefined
    const collect = (radius?: number) => {
      const map = new Map<string, { score: number; areaDistance?: number }>()
      for (const feature of mapArea?.sports ?? []) {
        const result = evaluateSearchMatch(searchIndex.get(feature.id), parsedSearch, radius)
        if (result.matched) map.set(feature.id, { score: result.score, areaDistance: result.areaDistance })
      }
      return map
    }
    const tight = collect()
    return parsedSearch.area && tight.size < 3 ? collect(AREA_FALLBACK_RADIUS_METRES) : tight
  }, [hasSearch, mapArea, searchIndex, parsedSearch])
  const visibleSports = useMemo(() => mapArea?.sports.filter((feature) => {
    if (!matchesFilter(feature, filter)) return false
    if (!matchesPrice(feature, priceFilter)) return false
    if (!matchesAccessibility(venuesById.get(feature.id), accessibilityFilter)) return false
    if (!matchesFamily(venuesById.get(feature.id), familyFilter)) return false
    return !searchMatches || searchMatches.has(feature.id)
  }) ?? [], [mapArea, filter, priceFilter, accessibilityFilter, familyFilter, searchMatches, venuesById])
  const effectiveOrigin = nearOrigin ?? (parsedSearch.area ? { coordinates: parsedSearch.area.point, label: parsedSearch.area.name } : undefined)
  const distances = useMemo(() => effectiveOrigin ? new Map(visibleSports.flatMap((feature) => feature.center ? [[feature.id, distanceMetres(effectiveOrigin.coordinates, feature.center)] as const] : [])) : undefined, [visibleSports, effectiveOrigin])
  const sortedSports = useMemo(() => [...visibleSports].sort((a, b) => {
    if (nearOrigin && distances) return (distances.get(a.id) ?? Infinity) - (distances.get(b.id) ?? Infinity)
    if (parsedSearch.area && distances) {
      const distA = distances.get(a.id) ?? Infinity
      const distB = distances.get(b.id) ?? Infinity
      if (distA !== distB) return distA - distB
    }
    if (searchMatches) {
      const diff = (searchMatches.get(b.id)?.score ?? 0) - (searchMatches.get(a.id)?.score ?? 0)
      if (diff !== 0) return diff
    }
    return featureDisplayName(a, locale).localeCompare(featureDisplayName(b, locale), locale)
  }), [visibleSports, locale, nearOrigin, parsedSearch.area, distances, searchMatches])
  const hiddenUnknownPrice = useMemo(() => priceFilter === 'all' ? 0 : (mapArea?.sports ?? []).filter((feature) => (feature.priceClass ?? 'unknown') === 'unknown'
    && matchesFilter(feature, filter) && matchesAccessibility(venuesById.get(feature.id), accessibilityFilter) && matchesFamily(venuesById.get(feature.id), familyFilter)
    && (!searchMatches || searchMatches.has(feature.id))).length, [mapArea, priceFilter, filter, accessibilityFilter, familyFilter, searchMatches, venuesById])
  const mapFitKey = [filter, priceFilter, accessibilityFilter, familyFilter, normalizedSearch, effectiveOrigin?.label ?? '', visibleSports.length].join('|')
  const mapFitTargets = useMemo<GeoPoint[]>(() => nearOrigin
    ? [nearOrigin.coordinates, ...sortedSports.slice(0, 8).flatMap((feature) => feature.center ? [feature.center] : [])]
    : [
      ...(parsedSearch.area ? [parsedSearch.area.point] : []),
      ...visibleSports.flatMap((feature) => feature.center ? [feature.center] : []),
    ], [nearOrigin, parsedSearch.area, sortedSports, visibleSports])
  const sheetDrag = useSheetDrag(sheetRef, sheetSnap, setSheetSnap, isPhone)
  // The peek shows the sheet header (and the consent card while it is open); its height is measured, not guessed.
  // The topbar bottom is measured too so an expanded mobile sheet never slides under the floating route card.
  useLayoutEffect(() => {
    const header = sheetHeaderRef.current, topbar = topbarRef.current, app = sheetRef.current?.closest<HTMLElement>('.app')
    if (!header || !app) return
    const update = () => {
      app.style.setProperty('--sheet-peek-px', `${header.offsetTop + header.offsetHeight}px`)
      if (topbar) app.style.setProperty('--topbar-bottom-px', `${Math.ceil(topbar.offsetTop + topbar.offsetHeight + 8)}px`)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(header)
    if (header.parentElement) observer.observe(header.parentElement)
    if (topbar) observer.observe(topbar)
    return () => observer.disconnect()
  }, [consentVisible, sidebarView, selected?.id, mapArea, routePlannerOpen, travelMode, Boolean(routes.transit?.transit)])
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
  const trendingSignals = useMemo(() => new Map<string, TrendingSignal>(trendingEnabled ? mapArea?.sports.map((feature) => [feature.id, previewTrendingSignal(feature)]) ?? [] : []), [mapArea, trendingEnabled])
  const topTrending = useMemo(() => visibleSports
    .map((feature) => ({ feature, signal: trendingSignals.get(feature.id) }))
    .filter((item): item is { feature: SportFeature; signal: TrendingSignal } => Boolean(item.signal))
    .sort((a, b) => b.signal.recentChange - a.signal.recentChange || b.signal.interestScore - a.signal.interestScore)
    .slice(0, 3), [visibleSports, trendingSignals])
  const trendingIsPreview = topTrending.some(({ signal }) => signal.source === 'preview')
  // Which sport chips exist depends only on the data, so it is computed once, not on every keystroke.
  const filterOptions = useMemo(() => allFilterOptions.filter((option) => option.id === 'all' || !mapArea || mapArea.sports.some((feature) => matchesFilter(feature, option.id))), [mapArea])
  const measureChips = chipScroll.measure
  useEffect(() => { measureChips() }, [measureChips, filterOptions, locale, routePlannerOpen])
  const activeFilterCount = Number(priceFilter !== 'all') + Number(accessibilityFilter !== 'all') + Number(familyFilter !== 'all')
  const venueDiagnostics = useMemo(() => {
    if (!debugVenues) return { duplicateNames: [] as string[], duplicateNameGroups: 0, venueCount: 0, featureCount: 0, sourceCount: 0 }
    const names = new Map<string, { name: string; count: number }>()
    mapArea?.venues.forEach((venue) => { const key = nameKey(venue.name); if (key) { const current = names.get(key); names.set(key, { name: current?.name ?? venue.name ?? key, count: (current?.count ?? 0) + 1 }) } })
    const duplicateNames = [...names.values()].filter(({ count }) => count > 1).sort((a, b) => b.count - a.count).slice(0, 3).map(({ name, count }) => `${name} (${count})`)
    return { duplicateNames, duplicateNameGroups: [...names.values()].filter(({ count }) => count > 1).length, venueCount: mapArea?.venues.length ?? 0, featureCount: mapArea?.sports.length ?? 0, sourceCount: new Set(mapArea?.venues.map((venue) => venue.source.provider)).size }
  }, [mapArea, debugVenues])
  const selectedVenue = selected ? venuesById.get(selected.id) : undefined
  const selectedTrend = selected ? trendingSignals.get(selected.id) : undefined
  const route = routes[travelMode]
  const transitRoute = routes.transit?.transit
  const transitTicketZones = hslTicketZones(transitRoute?.zones ?? [])
  const canPlanRoute = routePlannerOpen && Object.keys(routes).length > 0
  const phoneTransitInSheet = isPhone && canPlanRoute && travelMode === 'transit' && Boolean(transitRoute)
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
      searchAddresses(query, controller.signal, locale).then((suggestions) => {
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
  }, [startingPoint, originCoordinates, suggestionRetry, locale])

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
    setEditingRoute(true)
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
      try { origin = await geocodeAddress(startingPoint.trim(), locale) }
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
      setRoutes(nextRoutes); setRouteStatus('idle'); setSuggestionStatus('idle'); setResolvedOrigin(origin); setEditingRoute(false)
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
      reverseGeocode(coordinates).then((suggestion) => { if (requestId === locationRequestRef.current) setStartingPoint(suggestion.label) }).catch((error) => {
        // The field keeps "Current location"; the coordinates are already set, so routing still works.
        if (import.meta.env.DEV) console.warn('Reverse geocoding failed', error)
      })
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
      const coordinates = await geocodeAddress(query, locale)
      setNearOrigin({ coordinates, label: query })
      setSearchQuery('')
      setNearStatus('idle')
    } catch { setNearStatus('notfound') }
  }
  const clearNear = () => { setNearOrigin(undefined); setNearStatus('idle') }
  // Back is also "deselect": the map highlight and the camera return with the list.
  const closeDetail = () => selectFeature(undefined)
  const shareSelectedPlace = async () => {
    if (!selected) return
    const url = window.location.href
    const title = featureDisplayName(selected, locale, selectedVenue?.lipas?.name)
    if (typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches) {
      try { await navigator.share({ title, url }); return } catch { /* user cancelled or share unavailable */ }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopiedShare(true)
      if (shareTimerRef.current) window.clearTimeout(shareTimerRef.current)
      shareTimerRef.current = window.setTimeout(() => setCopiedShare(false), 2000)
    } catch { /* clipboard blocked */ }
  }

  const chooseAnalyticsConsent = (consent: AnalyticsConsent) => {
    setAnalyticsConsent(consent)
    setAnalyticsConsentState(consent)
    setConsentVisible(false)
    window.requestAnimationFrame(() => searchInputRef.current?.focus({ preventScroll: true }))
  }

  if (reviewMode) return <Suspense fallback={<p>Loading review…</p>}><ReviewWorkbench /></Suspense>
  if (wikiMode) return <Suspense fallback={<p>Loading wiki…</p>}><WikiWorkbench /></Suspense>
  if (loadError) return <main className="app-shell loading-shell"><div className="state-panel" role="alert"><img src="/logo-64.png" alt="" width="40" height="40" /><h1>{locale === 'fi' ? 'Liikuntapaikkoja ei voitu ladata' : 'Sports places couldn’t load'}</h1><p>{locale === 'fi' ? 'Yhteys katkesi tai palvelu ei vastannut. Tietojasi ei menetetty.' : 'The connection dropped or the service didn’t respond. Nothing you entered was lost.'}</p><button type="button" className="state-panel-action" onClick={() => setLoadAttempt((value) => value + 1)}>{locale === 'fi' ? 'Yritä uudelleen' : 'Try again'}</button></div></main>

  const sportChipLabel = (id: SportFilter) => id === 'all' ? text(locale, 'all') : sportText(locale, id)
  const clearAllFilters = () => { setFilter('all'); setPriceFilter('all'); setAccessibilityFilter('all'); setFamilyFilter('all') }
  const transitLegsList = transitRoute ? <ol className="transit-legs">
    {transitRoute.legs.map((leg, index) => <li className="transit-leg" data-mode={leg.mode.toUpperCase() === 'WALK' ? 'walk' : 'transit'} key={`${leg.mode}-${leg.routeName ?? 'walk'}-${leg.from ?? index}`}>
      <span className="transit-leg-icon"><TransitLegIcon mode={leg.mode} /></span>
      <div className="transit-leg-copy"><strong>{transitLegTitle(locale, leg, index, transitRoute.legs.length)}</strong>{transitLegDetail(locale, leg) && <span>{transitLegDetail(locale, leg)}</span>}</div>
      <time>{formatRouteDuration(locale, leg.durationSeconds)}</time>
    </li>)}
  </ol> : null
  const transitGuidanceBlock = transitRoute ? <section className={`transit-guidance ${phoneTransitInSheet ? 'is-sheet' : ''}`} aria-label={text(locale, 'gettingThere')}>
    {phoneTransitInSheet ? <>
      <h3 className="transit-steps-heading">{text(locale, 'transitSteps')}</h3>
      {transitLegsList}
      <div className="transit-ticket-footer">
        <p>{text(locale, 'hslTicketReminder', { zones: transitTicketZones })}</p>
        <a className="text-link" href={locale === 'fi' ? 'https://www.hsl.fi/liput-ja-hinnat/hsl-alue-ja-vyohykkeet' : 'https://www.hsl.fi/en/tickets-and-fares/hsl-area-and-zones'} target="_blank" rel="noreferrer">{text(locale, 'hslTicketInfo')} ↗</a>
      </div>
      <div className="transit-guidance-legend">
        <div className="transit-route-key"><span><i className="transit-route-key-line transit-route-key-walk" />{text(locale, 'walkMode')}</span><span><i className="transit-route-key-line transit-route-key-transit" />{text(locale, 'transitMode')}</span></div>
        <small>{text(locale, 'hslZoneMapSource')}</small>
      </div>
    </> : <>
      <div className="transit-guidance-heading"><div><strong>{text(locale, 'hslZones')}</strong><small>{text(locale, 'hslZonesUsed')}</small></div><span className="transit-zone-ticket" aria-label={`${text(locale, 'hslZones')}: ${transitTicketZones}`}>{transitTicketZones}</span></div>
      <div className="transit-route-summary">
        {transitRoute.legs.map((leg, index) => <span className="transit-route-chip" key={`${leg.mode}-${leg.routeName ?? 'walk'}-${leg.from ?? index}`}><TransitLegIcon mode={leg.mode} /><strong>{transitCompactLabel(locale, leg)}</strong><time>{formatRouteDuration(locale, leg.durationSeconds)}</time></span>)}
      </div>
      <p>{text(locale, 'hslTicketReminder', { zones: transitTicketZones })}</p>
      <details className="disclosure">
        <summary>{text(locale, 'transitSteps')}</summary>
        {transitLegsList}
      </details>
      <a className="text-link" href={locale === 'fi' ? 'https://www.hsl.fi/liput-ja-hinnat/hsl-alue-ja-vyohykkeet' : 'https://www.hsl.fi/en/tickets-and-fares/hsl-area-and-zones'} target="_blank" rel="noreferrer">{text(locale, 'hslTicketInfo')} ↗</a>
    </>}
  </section> : null
  return <main className={`app ${selected ? 'has-selection' : ''} ${routePlannerOpen ? 'route-planner-open' : ''}`}>
    <p className="sr-only" role="status">{announcement}</p>

    <div className="side">
      <header ref={topbarRef} className="topbar">
        <a className="brand" href="/"><img src="/logo-32.png" srcSet="/logo-32.png 1x, /logo-64.png 2x" alt="" width="32" height="32" /><h1>{text(locale, 'appName')}</h1></a>
        <Segmented className="lang-switch" label={text(locale, 'language')} value={locale} onChange={setLocale} options={[{ value: 'en', label: <>EN<span className="sr-only"> English</span></>, lang: 'en' }, { value: 'fi', label: <>FI<span className="sr-only"> Suomi</span></>, lang: 'fi' }]} />
        {routePlannerOpen && selected ? (canPlanRoute && !editingRoute ? (() => {
          const stopDotCount = travelMode === 'transit' && transitRoute
            ? Math.min(3, Math.max(0, transitRoute.legs.filter((leg) => leg.mode.toUpperCase() !== 'WALK').length))
            : 0
          return <div className="directions-compact" role="group" aria-label={locale === 'fi' ? 'Reittiohjeet' : 'Directions'}>
            <button className="directions-compact-trigger" type="button" onClick={() => setEditingRoute(true)} aria-label={locale === 'fi' ? `Muokkaa reittiä: ${startingPoint} – ${featureDisplayName(selected, locale, selectedVenue?.lipas?.name)}` : `Edit route: ${startingPoint} to ${featureDisplayName(selected, locale, selectedVenue?.lipas?.name)}`}>
              <span className="directions-dot is-start" aria-hidden="true" />
              <span className="directions-compact-origin">{startingPoint}</span>
              <span className="directions-compact-line" aria-hidden="true">
                {Array.from({ length: stopDotCount }, (_, index) => <span key={index} className={`directions-stop-dot ${stopDotCount > 1 && index > 0 ? 'is-transfer' : ''}`} />)}
              </span>
              <span className="directions-dot is-end" aria-hidden="true" />
              <span className="directions-compact-dest">{featureDisplayName(selected, locale, selectedVenue?.lipas?.name)}</span>
              <RiPencilLine className="directions-compact-edit" aria-hidden="true" size={14} />
            </button>
            <button className="icon-btn icon-btn-sm" type="button" onClick={closeRoutePlanner} aria-label={locale === 'fi' ? 'Sulje reittiohjeet' : 'Close directions'} title={locale === 'fi' ? 'Sulje' : 'Close'}><RiCloseLine aria-hidden="true" size={18} /></button>
          </div>
        })() : <div className="directions-panel" role="group" aria-label={locale === 'fi' ? 'Reittiohjeet' : 'Directions'}>
          <div className="directions-fields">
            <div className="field directions-origin">
              <label className="field-label" htmlFor="starting-point">{text(locale, 'startingPoint')}</label>
              <input id="starting-point" autoFocus={window.matchMedia('(pointer: fine)').matches || editingRoute} value={startingPoint} onChange={(event) => { locationRequestRef.current += 1; acceptedStreetRef.current = undefined; setStartingPoint(event.target.value); setOriginCoordinates(undefined); setOriginSuggestions([]); setRoutes({}); setRouteStatus('idle'); setLocationStatus('idle') }} placeholder={text(locale, 'startingPointPlaceholder')} autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="go" onKeyDown={(event) => { if (event.key === 'Enter') calculateRoute() }} />
              <button className="icon-btn location-button" type="button" onClick={useCurrentLocation} disabled={locationStatus === 'loading'} aria-label={text(locale, 'useCurrentLocation')} title={text(locale, 'useCurrentLocation')}><RiFocus3Line aria-hidden="true" size={18} /></button>
              {originSuggestions.length > 0 && <div className="address-suggestions" role="listbox" aria-label={text(locale, 'addressSuggestions')}>{originSuggestions.map((suggestion) => <button key={`${suggestion.coordinates?.join(',') ?? suggestion.label}-${suggestion.label}`} type="button" role="option" aria-selected="false" onClick={() => { acceptedStreetRef.current = suggestion.coordinates ? undefined : suggestion.label; setStartingPoint(suggestion.label); setOriginCoordinates(suggestion.coordinates); setOriginSuggestions([]) }}><SuggestionIcon kind={suggestion.kind} /><span className="suggestion-text"><span>{suggestion.label}</span>{(suggestion.kind || suggestion.detail) && <small>{[suggestion.kind && placeKindLabel(locale, suggestion.kind), suggestion.detail].filter(Boolean).join(' · ')}</small>}</span></button>)}</div>}
            </div>
            <div className="field directions-destination"><span className="field-label">{locale === 'fi' ? 'Määränpää' : 'Destination'}</span><strong>{featureDisplayName(selected, locale, selectedVenue?.lipas?.name)}</strong></div>
          </div>
          <div className="directions-actions">
            <button className={`btn ${canPlanRoute ? 'btn-secondary btn-sm' : 'btn-primary'}`} type="button" onClick={calculateRoute} disabled={routeStatus === 'loading' || !startingPoint.trim() || !selected.center}>{routeStatus === 'loading' ? text(locale, 'routing') : text(locale, 'calculateRoute')}</button>
            <button className={`btn btn-ghost ${canPlanRoute ? 'btn-sm' : ''}`} type="button" onClick={closeRoutePlanner}>{locale === 'fi' ? 'Sulje' : 'Close'}</button>
          </div>
          {locationStatus === 'loading' && <p className="inline-status" role="status">{text(locale, 'locationLoading')}</p>}
          {(locationStatus === 'denied' || locationStatus === 'error') && <p className="inline-status is-error" role="status">{text(locale, locationStatus === 'denied' ? 'locationDenied' : 'locationError')}</p>}
          {routeStatus !== 'idle' && routeStatus !== 'loading' && <p className="inline-status is-error" role="status">{text(locale, routeStatus === 'error' ? 'routeError' : routeStatus === 'unavailable' ? 'routeUnavailable' : routeStatus === 'no-route' ? 'routeNoRoute' : routeStatus === 'outside-area' ? 'routeOutsideArea' : 'routeInvalid')}</p>}
          {suggestionStatus === 'loading' && <p className="inline-status" role="status">{locale === 'fi' ? 'Haetaan osoite-ehdotuksia…' : 'Finding address suggestions…'}</p>}
          {suggestionStatus === 'empty' && <p className="inline-status" role="status">{locale === 'fi' ? 'Ehdotuksia ei löytynyt. Voit silti hakea reitin kirjoittamallasi osoitteella.' : 'No suggestions. You can still find a route with what you typed.'}</p>}
          {suggestionStatus === 'error' && <p className="inline-status" role="status">{locale === 'fi' ? 'Osoite-ehdotuksia ei saatu. Voit silti hakea reitin kirjoittamallasi osoitteella.' : 'Address suggestions aren’t available. You can still find a route with what you typed.'} <button type="button" className="link-btn" onClick={() => setSuggestionRetry((value) => value + 1)}>{locale === 'fi' ? 'Yritä uudelleen' : 'Retry'}</button></p>}
          {addressError && <p className="inline-status is-error" role="status">{locale === 'fi' ? 'Lähtöpaikkaa ei löytynyt. Tarkista osoite tai käytä nykyistä sijaintia.' : 'Starting point not found. Check the address or use your current location.'}</p>}
        </div>) : <div className="search-row">
          <label className="search-field">
            <RiSearchLine className="search-icon" aria-hidden="true" size={18} />
            <input ref={searchInputRef} type="search" autoCorrect="off" spellCheck={false} enterKeyHint="search" value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); selectFeature(undefined); setRoutes({}) }} placeholder={text(locale, 'searchPlaceholder')} aria-label={text(locale, 'searchPlaceholder')} />
            {searchQuery && <button type="button" className="icon-btn icon-btn-sm search-clear" onClick={() => { setSearchQuery(''); searchInputRef.current?.focus() }} aria-label={text(locale, 'clearSearch')}><RiCloseLine aria-hidden="true" size={16} /></button>}
          </label>
          <button type="button" className={`btn btn-secondary near-button ${nearOrigin ? 'is-active' : ''}`} aria-pressed={Boolean(nearOrigin)} onClick={() => nearOrigin ? clearNear() : findNearMe()} disabled={nearStatus === 'locating'}><RiNavigationLine aria-hidden="true" size={16} /><span>{nearStatus === 'locating' ? (locale === 'fi' ? 'Paikannetaan…' : 'Locating…') : locale === 'fi' ? 'Lähelläni' : 'Near me'}</span></button>
          {(nearStatus === 'denied' || nearStatus === 'error') && <p className="inline-status is-error near-status" role="status">{text(locale, nearStatus === 'denied' ? 'locationDenied' : 'locationError')}</p>}
        </div>}
        {!routePlannerOpen && <nav className="chip-row" aria-label={extraText(locale, 'filterFacilities')}>
          <details ref={filterDrawerRef} className="filters" onKeyDown={(event) => { if (event.key === 'Escape' && event.currentTarget.open) { event.preventDefault(); event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus() } }}>
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
          <div className="chip-scroll" data-start={chipScroll.canStart || undefined} data-end={chipScroll.canEnd || undefined}>
          <div ref={chipScroll.ref} className="chip-scroller" role="toolbar" aria-label={text(locale, 'sport')} onKeyDown={(event) => {
            if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return
            const chips = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('.chip')]
            const index = chips.indexOf(document.activeElement as HTMLButtonElement)
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? chips.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + chips.length) % chips.length
            event.preventDefault(); chips.forEach((chip, i) => { chip.tabIndex = i === next ? 0 : -1 }); chips[next]?.focus()
          }}>
            {filterOptions.map((option) => <button key={option.id} type="button" className="chip" tabIndex={filter === option.id ? 0 : -1} aria-pressed={filter === option.id} onClick={() => selectFilter(option.id === filter && option.id !== 'all' ? 'all' : option.id)}><SportFilterIcon id={option.id} />{sportChipLabel(option.id)}</button>)}
            <button type="button" className="chip" tabIndex={-1} aria-pressed={trendingEnabled} onClick={() => setTrendingEnabled((value) => !value)}><RiFireLine aria-hidden="true" size={16} />{text(locale, 'trending')}</button>
          </div>
          {/* Mouse affordance only: keyboard users move with the arrow keys, touch users swipe. */}
          <button type="button" className="chip-scroll-button is-start" tabIndex={-1} aria-hidden="true" onClick={() => chipScroll.page(-1)}><RiArrowLeftSLine size={18} /></button>
          <button type="button" className="chip-scroll-button is-end" tabIndex={-1} aria-hidden="true" onClick={() => chipScroll.page(1)}><RiArrowRightSLine size={18} /></button>
          </div>
        </nav>}
        {canPlanRoute && (() => {
          const travelOptions = ['walk', 'bike', 'transit', 'car'] as const
          const activeModeIndex = Math.max(0, travelOptions.indexOf(travelMode))
          return <div className="travel-modes" role="group" aria-label={text(locale, 'travelMode')}>
            <span className="travel-modes-thumb" aria-hidden="true" style={{ transform: `translate3d(${activeModeIndex * 100}%, 0, 0)` }} />
            {travelOptions.map((modeOption) => { const result = routes[modeOption]; const label = text(locale, modeOption); const ModeIcon = modeOption === 'walk' ? RiWalkLine : modeOption === 'bike' ? RiBikeLine : modeOption === 'transit' ? RiBus2Line : RiCarLine; return <button key={modeOption} className="travel-mode" type="button" aria-pressed={travelMode === modeOption} disabled={routeStatus === 'loading' || !result} aria-label={result ? `${label}, ${formatRouteDuration(locale, result.durationSeconds)}, ${formatDistance(locale, result.distanceMetres)}` : `${label}, ${locale === 'fi' ? 'ei saatavilla' : 'not available'}`} onClick={() => setTravelMode(modeOption)}><ModeIcon aria-hidden="true" size={18} /><small>{result ? formatRouteDuration(locale, result.durationSeconds) : '–'}</small></button> })}
          </div>
        })()}
        {canPlanRoute && route && <div className="route-summary" aria-live="polite">
          <span className="route-summary-mode">{(() => { const ModeIcon = travelMode === 'walk' ? RiWalkLine : travelMode === 'bike' ? RiBikeLine : travelMode === 'transit' ? RiBus2Line : RiCarLine; return <ModeIcon aria-hidden="true" size={16} /> })()}{text(locale, travelMode)}</span>
          <span className="route-summary-metrics">{phoneTransitInSheet && <button type="button" className="transit-zone-ticket transit-zone-trigger" onClick={() => setSheetSnap(sheetExpanded ? 'peek' : 'half')} aria-expanded={sheetExpanded} aria-label={`${text(locale, 'hslZones')}: ${transitTicketZones}`}>{transitTicketZones}</button>}<strong>{formatDistance(locale, route.distanceMetres)}</strong></span>
        </div>}
        {!isPhone && travelMode === 'transit' && transitRoute && transitGuidanceBlock}
        {canPlanRoute && !transitRoute && transitStatus === 'unavailable' && <p className="inline-status transit-notice" role="status">{text(locale, 'transitUnavailable')} {selected?.center && <a className="text-link" href={transitDirectionsUrl(selected.center, resolvedOrigin ?? originCoordinates)} target="_blank" rel="noreferrer">{text(locale, 'openTransitDirections')} ↗</a>}</p>}
        {canPlanRoute && !transitRoute && transitStatus === 'no-route' && <p className="inline-status transit-notice" role="status">{text(locale, 'transitNoRoute')}</p>}
      </header>

      <aside ref={sheetRef} data-snap={sheetSnap} className={`sheet ${sheetExpanded ? 'is-expanded' : ''} ${sidebarView === 'detail' && selected ? 'is-detail' : ''}`} aria-label={text(locale, 'facilityList')} onKeyDown={(event) => { if (event.key === 'Escape' && sidebarView === 'detail' && !reportDialogOpen) { event.preventDefault(); closeDetail() } }}
        onFocus={(event) => {
          // Keyboard focus reaching the collapsed sheet opens it, so the (otherwise inert) results are the next Tab stop.
          if (isPhone && sheetSnap === 'peek' && (event.target as HTMLElement).matches(':focus-visible')) setSheetSnap(sidebarView === 'detail' ? 'half' : 'full')
        }}>
        {consentVisible && <section className="consent" aria-labelledby="privacy-consent-title">
          <div className="consent-copy">
            <h2 id="privacy-consent-title">{text(locale, 'analyticsConsentTitle')}</h2>
            <p>{text(locale, 'analyticsConsentBody')}</p>
            <details className="disclosure disclosure-inline"><summary>{text(locale, 'privacyDetails')}</summary><p>{text(locale, 'privacyDetailsBody')}</p><p>{locale === 'fi' ? 'Taustakartta ladataan ensisijaisesti OpenFreeMap-palvelusta. Jos se ei ole käytettävissä, kartta käyttää OpenStreetMapin karttalaattoja. Käytetty karttapalvelu näkee verkkopyyntöjen IP-osoitteen ja pyydetyn kartta-alueen, mutta sille ei lähetetä hakutekstiä tai reittilomakkeen tietoja.' : 'The basemap loads from OpenFreeMap, with OpenStreetMap tiles as a fallback if needed. The map provider receives your IP address and requested map tile area, but not your search text or route form values.'}</p></details>
          </div>
          <div className="consent-actions">
            <button type="button" className="btn btn-secondary consent-secondary" onClick={() => chooseAnalyticsConsent('denied')}>{text(locale, 'onlyNecessary')}</button>
            <button type="button" className="btn btn-primary consent-primary" onClick={() => chooseAnalyticsConsent('granted')}>{text(locale, 'allowAnalytics')}</button>
          </div>
        </section>}
        <header ref={sheetHeaderRef} className="sheet-header" {...sheetDrag}>
          <span className="sheet-handle" aria-hidden="true" />
          {sidebarView === 'detail' && selected && <button type="button" className="icon-btn" onClick={closeDetail} aria-label={locale === 'fi' ? 'Takaisin listaan' : 'Back to the list'}><RiArrowLeftLine aria-hidden="true" size={20} /></button>}
          <div className="sheet-title">
            <h2 ref={detailHeadingRef} tabIndex={-1}>{phoneTransitInSheet && route ? <span className="sheet-transit-heading"><strong>{formatRouteDuration(locale, route.durationSeconds)}</strong><span className="sheet-transit-meta">{text(locale, 'hslZones')} {transitTicketZones}</span></span> : sidebarView === 'detail' && selected ? featureDisplayName(selected, locale, selectedVenue?.lipas?.name) : (locale === 'fi' ? 'Paikat' : 'Places')}</h2>
            {!phoneTransitInSheet && sidebarView === 'detail' && selected && (venueTypeLabel(selectedVenue, locale) || distances?.get(selected.id) !== undefined) && <span>{[venueTypeLabel(selectedVenue, locale), distances?.get(selected.id) !== undefined ? formatDistance(locale, distances.get(selected.id)!) : undefined].filter(Boolean).join(' · ')}</span>}
            {!phoneTransitInSheet && sidebarView === 'list' && <span>{!mapArea ? (locale === 'fi' ? 'Ladataan paikkoja…' : 'Loading places…') : formatPlaceCount(locale, visibleSports.length)}{effectiveOrigin ? (locale === 'fi' ? ` · lähimmät (${effectiveOrigin.label})` : ` · nearest to ${effectiveOrigin.label}`) : ''}</span>}
          </div>
          {sidebarView === 'detail' && selected && !routePlannerOpen && <>
            <button className={`icon-btn share-btn ${copiedShare ? 'is-copied' : ''}`} type="button" onClick={shareSelectedPlace} aria-label={copiedShare ? (locale === 'fi' ? 'Linkki kopioitu' : 'Link copied') : (locale === 'fi' ? 'Jaa paikka' : 'Share place')} title={copiedShare ? (locale === 'fi' ? 'Linkki kopioitu' : 'Link copied') : (locale === 'fi' ? 'Jaa paikka' : 'Share place')}>{copiedShare ? <RiCheckLine aria-hidden="true" size={18} /> : <RiShareForwardLine aria-hidden="true" size={18} />}</button>
            <button ref={reportButtonRef} className="icon-btn" type="button" onClick={() => setReportDialogOpen(true)} aria-label={locale === 'fi' ? 'Ilmoita virheellisestä tiedosta' : 'Report incorrect information'} title={locale === 'fi' ? 'Ilmoita virheestä' : 'Report a mistake'}><RiFlagLine aria-hidden="true" size={18} /></button>
          </>}
          <button type="button" className="icon-btn sheet-toggle" onClick={() => setSheetSnap(sheetExpanded ? 'peek' : sidebarView === 'detail' ? 'half' : 'full')} aria-expanded={sheetExpanded} aria-label={sheetExpanded ? (locale === 'fi' ? 'Pienennä paneeli' : 'Collapse panel') : (locale === 'fi' ? 'Avaa paneeli' : 'Expand panel')}><RiArrowUpSLine aria-hidden="true" size={20} /></button>
        </header>
        <div key={sidebarView === 'detail' && selected ? selected.id : 'facility-list'} className="sheet-body" inert={isPhone && !sheetExpanded}>
          {phoneTransitInSheet && transitGuidanceBlock && <div className="sheet-transit-section">{transitGuidanceBlock}</div>}
          {sidebarView === 'detail' && selected ? <FacilityDetails feature={selected} venue={selectedVenue} trend={selectedTrend} trendingEnabled={trendingEnabled} locale={locale} directionsOpen={routePlannerOpen} onDirections={() => { if (routePlannerOpen) { setEditingRoute(true); window.requestAnimationFrame(() => document.getElementById('starting-point')?.focus()); return } setRoutePlannerOpen(true); setEditingRoute(true); setSheetSnap('peek'); if (nearOrigin && !startingPoint) { setStartingPoint(nearOrigin.label); setOriginCoordinates(nearOrigin.coordinates) } }} /> : <>
            <p className="sr-only">{text(locale, 'facilityListHint')}</p>
            {nearOrigin && <div className="note"><span>{locale === 'fi' ? 'Etäisyys kohteesta ' : 'Distance from '}<strong>{nearOrigin.label}</strong></span><button type="button" className="btn btn-ghost btn-sm" onClick={clearNear}>{locale === 'fi' ? 'Poista' : 'Clear'}</button></div>}
            {hiddenUnknownPrice > 0 && <div className="note"><span>{locale === 'fi' ? `${formatPlaceCount(locale, hiddenUnknownPrice)}, joiden hintaa ei ole ilmoitettu, on piilotettu.` : `${formatPlaceCount(locale, hiddenUnknownPrice)} with no listed price are hidden.`}</span><button type="button" className="btn btn-ghost btn-sm" onClick={() => setPriceFilter('all')}>{locale === 'fi' ? 'Näytä nekin' : 'Show them'}</button></div>}
            {!mapArea && <ul className="place-list" aria-hidden="true">{Array.from({ length: 7 }, (_, index) => <li key={index} className="place-row place-row-skeleton"><span className="place-tile" /><span className="place-row-main"><span className="skeleton-bar" style={{ width: `${62 - (index % 3) * 12}%` }} /><span className="skeleton-bar skeleton-bar-sm" style={{ width: `${44 + (index % 2) * 18}%` }} /></span></li>)}</ul>}
            {mapArea && visibleSports.length === 0 && (() => {
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
              return <li key={feature.id}><button type="button" data-feature-id={feature.id} className="place-row" aria-current={selected?.id === feature.id ? 'true' : undefined} onMouseEnter={() => prefetchPhoto(venue?.serviceMap?.pictureUrl)} onPointerDown={() => prefetchPhoto(venue?.serviceMap?.pictureUrl)} onClick={() => selectFeature(feature, true)}>
                <PlaceTile feature={feature} />
                <span className="place-row-main">
                  <strong>{featureDisplayName(feature, locale, venue?.lipas?.name)}</strong>
                  <span className="place-row-meta">{kind || text(locale, 'missingSports')}</span>
                  {venue?.lipas?.address && <span className="place-row-address"><RiMapPin2Line aria-hidden="true" size={12} /><span>{venue.lipas.address}</span></span>}
                </span>
                {(distance !== undefined || price) && <span className="place-row-aside">{distance !== undefined && <span className="place-row-distance">{formatDistance(locale, distance)}</span>}{price && <span className={`badge badge-${feature.priceClass}`}>{price}</span>}</span>}
              </button></li>
            })}</ul>
            {listLimit < sortedSports.length && <button className="btn btn-secondary load-more" onClick={() => { showMoreFromRef.current = listLimit; setListLimit((value) => value + 60) }}>{locale === 'fi' ? `Näytä lisää (${formatPlaceCount(locale, sortedSports.length - listLimit)} jäljellä)` : `Show more (${formatPlaceCount(locale, sortedSports.length - listLimit)} left)`}</button>}
          </>}
          {mapArea && <footer className="panel-footer">
            <Segmented className="lang-switch lang-switch-footer" label={text(locale, 'language')} value={locale} onChange={setLocale} options={[{ value: 'en', label: <>EN<span className="sr-only"> English</span></>, lang: 'en' }, { value: 'fi', label: <>FI<span className="sr-only"> Suomi</span></>, lang: 'fi' }]} />
            <span>{extraText(locale, 'officialDisclaimer')}</span>
            <span><a href={mapArea?.source ?? 'https://www.openstreetmap.org/copyright'} target="_blank" rel="noreferrer">© OpenStreetMap</a> · <a href="https://www.lipas.fi/" target="_blank" rel="noreferrer">LIPAS</a> · <a href="https://hri.fi/data/fi/dataset/helsingin-piirijako" target="_blank" rel="noreferrer">{locale === 'fi' ? 'Helsingin kaupunki' : 'City of Helsinki'}</a> · <a href="https://digitransit.fi/" target="_blank" rel="noreferrer">Digitransit</a> · <a href="?wiki=1">Wiki</a> · <button className="link-btn privacy-link" type="button" onClick={() => setConsentVisible(true)}>{locale === 'fi' ? 'Yksityisyys' : 'Privacy'}</button></span>
          </footer>}
        </div>
      </aside>
    </div>

    <section className="map-stage" aria-label={locale === 'fi' ? 'Kartta ja kohteet' : 'Map and facilities'}>
      {mapArea && <ErrorBoundary fallback={<div className="map-status is-error" role="alert"><span><strong>{locale === 'fi' ? 'Kartta ei latautunut.' : 'The map didn’t load.'}</strong> {locale === 'fi' ? 'Paikat löytyvät silti listasta.' : 'You can still browse places in the list.'}</span><button type="button" onClick={reloadPage}>{locale === 'fi' ? 'Lataa sivu uudelleen' : 'Reload page'}</button></div>}><Suspense fallback={null}><SportsMap ref={mapRef} area={mapArea} features={visibleSports} selected={selected} onSelect={selectFeature} route={route} mode={mode} locale={locale} origin={nearOrigin?.coordinates} fitKey={mapFitKey} fitTargets={mapFitTargets} /></Suspense></ErrorBoundary>}
      <div className="map-controls">
        <Segmented className="segmented-vertical" orientation="vertical" label={extraText(locale, 'mapProjection')} value={mode} onChange={setMode} options={[{ value: '2d', label: '2D' }, { value: 'iso', label: locale === 'fi' ? 'Vino' : 'Tilt' }]} />
        <button type="button" className="icon-btn map-reset" onClick={() => { selectFeature(undefined); mapRef.current?.reset() }} aria-label={locale === 'fi' ? 'Palauta koko kaupungin näkymä' : 'Reset to the whole city'} title={locale === 'fi' ? 'Palauta näkymä' : 'Reset view'}><RiFullscreenExitLine aria-hidden="true" size={18} /></button>
      </div>
      {travelMode === 'transit' && transitRoute && <div className="transit-map-legend" aria-label={`${text(locale, 'hslZoneMap')}: ${transitRoute.zones.join(' · ')}`}><div className="transit-zone-key"><span className="transit-map-legend-swatch" /><strong>{text(locale, 'hslZoneMap')}</strong><span>{transitRoute.zones.join(' · ') || text(locale, 'hslZonesUnknown')}</span><small>{text(locale, 'hslZoneMapSource')}</small></div><div className="transit-route-key"><span><i className="transit-route-key-line transit-route-key-walk" />{text(locale, 'walkMode')}</span><span><i className="transit-route-key-line transit-route-key-transit" />{text(locale, 'transitMode')}</span></div></div>}
      {trendingEnabled && topTrending.length > 0 && <div className="trending-rail" aria-label={text(locale, 'trendingNow')}>
        <div className="trending-rail-heading"><strong>{text(locale, 'trendingNow')}</strong>{trendingIsPreview && <span className="badge">{text(locale, 'previewData')}</span>}</div>
        <div className="trending-items">{topTrending.map(({ feature, signal }) => {
          const venue = venuesById.get(feature.id)
          const stageKey = signal.stage === 'new' ? 'newOnList' : signal.stage === 'rising' ? 'risingInterest' : 'popularNow'
          return <button key={feature.id} type="button" className={`trending-item ${selected?.id === feature.id ? 'selected' : ''}`} onClick={() => selectFeature(selected?.id === feature.id ? undefined : feature)} aria-pressed={selected?.id === feature.id}>
            <span className="trending-item-copy"><strong>{featureDisplayName(feature, locale, venue?.name)}</strong><small>{text(locale, stageKey)} · {venue?.sports[0] ? venueActivityLabel(locale, venue.sports[0]) : venue?.facilityType ?? text(locale, 'sportsAreas')}</small></span>
            <span className="trending-score"><strong>{signal.interestScore}</strong><small>+{signal.recentChange}%</small></span>
          </button>
        })}</div>
      </div>}
      {debugVenues && <aside className="debug-venues" aria-label="Venue debug information"><strong>Debug: venues</strong><span>{venueDiagnostics.featureCount} map features · {venueDiagnostics.venueCount} venues · {venueDiagnostics.sourceCount} sources</span><span>{venueDiagnostics.duplicateNameGroups} duplicate-name groups after merge</span>{venueDiagnostics.duplicateNames.length > 0 && <span title={venueDiagnostics.duplicateNames.join(' · ')}>Examples: {venueDiagnostics.duplicateNames.join(' · ')}</span>}<span>URL flag: <code>?debug=venues</code></span></aside>}
    </section>

    {reportDialogOpen && selected && !routePlannerOpen && <div className="dialog-backdrop" role="presentation" onClick={() => setReportDialogOpen(false)}>
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="report-dialog-title" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => {
        if (event.key === 'Escape') { event.stopPropagation(); setReportDialogOpen(false); return }
        if (event.key !== 'Tab') return
        // Focus trap: aria-modal promises the rest of the page is out of reach.
        const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>('button, a[href]')]
        const first = focusable[0], last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }}>
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
