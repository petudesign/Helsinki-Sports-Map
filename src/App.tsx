import { useEffect, useLayoutEffect, useMemo, useRef, useState, type WheelEvent } from 'react'
import type { MapDataset, MapViewport, SportFeature, SportsVenue } from './data/types'
import { previewTrendingSignal, type TrendingSignal } from './data/trending'
import { activeCity } from './config/city'
import { pickMapTarget, renderMap } from './renderer/mapRenderer'
import { createBackgroundRenderer } from './renderer/backgroundRenderer'
import { extraText, sportText, text, type Locale } from './i18n'
import { geocodeAddress, reverseGeocode, routeByMode, searchAddresses, type AddressSuggestion, type RouteResult, type TravelMode } from './routing'
import { getAnalyticsConsent, setAnalyticsConsent, type AnalyticsConsent } from './privacy'
import { ReviewWorkbench } from './review/ReviewWorkbench'

type Mode = '2d' | 'iso'
type SportFilter = 'all' | 'football' | 'athletics' | 'swimming' | 'outdoor_swimming' | 'ice_hockey' | 'basketball' | 'tennis' | 'padel' | 'outdoor_fitness' | 'martial_arts' | 'skateboarding'
type PriceFilter = 'all' | 'free' | 'paid'
type AccessibilityFilter = 'all' | 'stepFreeEntrance' | 'accessibleToilet' | 'accessibleParking'
type FamilyFilter = 'all' | 'family'
type Camera = { zoom: number; pan: { x: number; y: number } }
const MAX_ZOOM = 10

const allFilterOptions: { id: SportFilter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'football', label: 'Football' }, { id: 'athletics', label: 'Athletics' },
  { id: 'swimming', label: 'Swimming' }, { id: 'outdoor_swimming', label: 'Outdoor swimming' }, { id: 'ice_hockey', label: 'Ice hockey' }, { id: 'basketball', label: 'Basketball' }, { id: 'tennis', label: 'Tennis' }, { id: 'padel', label: 'Padel' }, { id: 'outdoor_fitness', label: 'Outdoor gym' }, { id: 'martial_arts', label: 'Martial arts' }, { id: 'skateboarding', label: 'Skateboarding' },
]

function matchesFilter(feature: SportFeature, filter: SportFilter) {
  if (filter === 'all') return true
  const sports = feature.sports?.length ? feature.sports : [feature.sport]
  if (filter === 'football') return sports.some((sport) => ['soccer', 'football'].includes(sport))
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

function venueForFeature(venues: SportsVenue[], feature: SportFeature) {
  return venues.find((venue) => venue.id === feature.id)
}

function venueActivityLabel(locale: Locale, sport: string) {
  return sportText(locale, sport)
}

function App() {
  const reviewMode = new URLSearchParams(window.location.search).get('review') === '1'
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mapArea, setMapArea] = useState<MapDataset>()
  const [mode, setMode] = useState<Mode>('2d')
  const [filter, setFilter] = useState<SportFilter>('all')
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all')
  const [accessibilityFilter, setAccessibilityFilter] = useState<AccessibilityFilter>('all')
  const [familyFilter, setFamilyFilter] = useState<FamilyFilter>('all')
  const [selected, setSelected] = useState<SportFeature>()
  const [trendingEnabled, setTrendingEnabled] = useState(false)
  const [locale, setLocale] = useState<Locale>('en')
  const [searchQuery, setSearchQuery] = useState('')
  const [startingPoint, setStartingPoint] = useState('')
  const [originCoordinates, setOriginCoordinates] = useState<[number, number]>()
  const [originSuggestions, setOriginSuggestions] = useState<AddressSuggestion[]>([])
  const [travelMode, setTravelMode] = useState<TravelMode>('walk')
  const [routes, setRoutes] = useState<Partial<Record<Exclude<TravelMode, 'transit'>, RouteResult>>>({})
  const [routeStatus, setRouteStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'denied' | 'error'>('idle')
  const [, setAnalyticsConsentState] = useState<AnalyticsConsent>()
  const [consentVisible, setConsentVisible] = useState(false)
  const [debugVenues] = useState(() => new URLSearchParams(window.location.search).get('debug') === 'venues')
  const cameraRef = useRef<Camera>({ zoom: 1, pan: { x: 0, y: 0 } })
  const backgroundRef = useRef<ReturnType<typeof createBackgroundRenderer>>(undefined)
  const draggingRef = useRef(false)
  const scheduleDrawRef = useRef<(() => void) | null>(null)
  const drag = useRef<{ x: number; y: number; startX: number; startY: number; moved: boolean } | null>(null)
  const viewportLoadTimerRef = useRef<number | undefined>(undefined)
  const viewportLoadRequestRef = useRef(0)
  const locationRequestRef = useRef(0)
  const locationTimeoutRef = useRef<number | undefined>(undefined)
  useEffect(() => { if (!reviewMode) activeCity.loadDataset().then(setMapArea) }, [reviewMode])
  useEffect(() => { const stored = getAnalyticsConsent(); setAnalyticsConsentState(stored); setConsentVisible(stored === undefined) }, [])
  const venuesById = useMemo(() => new Map(mapArea?.venues.map((venue) => [venue.id, venue]) ?? []), [mapArea])
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase('fi-FI')
  const visibleSports = mapArea?.sports.filter((feature) => {
    if (!matchesFilter(feature, filter)) return false
    if (!matchesPrice(feature, priceFilter)) return false
    if (!matchesAccessibility(venuesById.get(feature.id), accessibilityFilter)) return false
    if (!matchesFamily(venuesById.get(feature.id), familyFilter)) return false
    if (!normalizedSearch) return true
    const venue = venuesById.get(feature.id)
    const searchable = [feature.name, venue?.name, venue?.lipas?.name, venue?.lipas?.address, feature.facilityType, feature.sport, ...(feature.sports ?? [])].filter((value): value is string => Boolean(value))
    return searchable.flatMap((value) => [value, sportText('en', value), sportText('fi', value)]).some((value) => value?.toLocaleLowerCase('fi-FI').includes(normalizedSearch))
  }) ?? []
  const trendingSignals = useMemo(() => new Map<string, TrendingSignal>(mapArea?.sports.map((feature) => [feature.id, previewTrendingSignal(feature)]) ?? []), [mapArea])
  const visibleSportIds = new Set(visibleSports.map(({ id }) => id))
  const filterOptions = allFilterOptions.filter((option) => option.id === 'all' || mapArea?.sports.some((feature) => matchesFilter(feature, option.id)))
  const activeFilterCount = Number(priceFilter !== 'all') + Number(accessibilityFilter !== 'all') + Number(familyFilter !== 'all')
  const venueDiagnostics = useMemo(() => {
    const names = new Map<string, { name: string; count: number }>()
    mapArea?.venues.forEach((venue) => { const key = (venue.name ?? '').trim().toLocaleLowerCase('fi-FI').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ''); if (key) { const current = names.get(key); names.set(key, { name: current?.name ?? venue.name ?? key, count: (current?.count ?? 0) + 1 }) } })
    const duplicateNames = [...names.values()].filter(({ count }) => count > 1).sort((a, b) => b.count - a.count).slice(0, 3).map(({ name, count }) => `${name} (${count})`)
    return { duplicateNames, duplicateNameGroups: [...names.values()].filter(({ count }) => count > 1).length, venueCount: mapArea?.venues.length ?? 0, featureCount: mapArea?.sports.length ?? 0, sourceCount: new Set(mapArea?.venues.map((venue) => venue.source.provider)).size }
  }, [mapArea])
  const selectedVenue = selected ? venuesById.get(selected.id) : undefined
  const serviceMap = selectedVenue?.serviceMap
  const route = travelMode === 'transit' ? undefined : routes[travelMode]
  const canPlanRoute = Boolean(selected?.center && startingPoint.trim())
  const [addressError, setAddressError] = useState(false)
  const routeRequestRef = useRef(0)
  useEffect(() => {
    routeRequestRef.current += 1
    setRoutes({})
    setRouteStatus('idle')
    setAddressError(false)
  }, [selected?.id, startingPoint, originCoordinates])

  const scheduleViewportLoad = (viewport: MapViewport) => {
    const loader = activeCity.loadDatasetForViewport
    if (!loader) return
    const requestId = ++viewportLoadRequestRef.current
    if (viewportLoadTimerRef.current) window.clearTimeout(viewportLoadTimerRef.current)
    viewportLoadTimerRef.current = window.setTimeout(() => {
      loader(viewport).then((nextArea) => { if (requestId === viewportLoadRequestRef.current) setMapArea(nextArea) }).catch(() => undefined)
    }, 140)
  }

  useEffect(() => () => { if (viewportLoadTimerRef.current) window.clearTimeout(viewportLoadTimerRef.current); if (locationTimeoutRef.current) window.clearTimeout(locationTimeoutRef.current); viewportLoadRequestRef.current += 1; locationRequestRef.current += 1 }, [])
  useEffect(() => () => { backgroundRef.current?.dispose(); backgroundRef.current = undefined }, [])

  useEffect(() => {
    const query = startingPoint.trim()
    if (query.length < 3 || originCoordinates) { setOriginSuggestions([]); return }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      searchAddresses(query, controller.signal).then(setOriginSuggestions).catch(() => { if (!controller.signal.aborted) setOriginSuggestions([]) })
    }, 650)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [startingPoint, originCoordinates])

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !mapArea) return
    if (mode === 'iso') backgroundRef.current ??= createBackgroundRenderer(() => scheduleDrawRef.current?.())
    let frame = 0
    const draw = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const currentVisibleIds = new Set(visibleSports.map(({ id }) => id))
        const currentSelectedIds = new Set(selected ? mapArea.sports.filter((feature) => selected.name ? feature.name === selected.name : feature.id === selected.id).map(({ id }) => id) : [])
        const currentCamera = cameraRef.current
        const view = { mode, zoom: currentCamera.zoom, pan: currentCamera.pan }
        // 2D draws cached vectors directly at the current camera. Avoid duplicate
        // worker preparation/rasterization and bitmap swaps after every gesture.
        const background = mode === 'iso'
          ? backgroundRef.current?.update(mapArea, view, canvas.clientWidth, canvas.clientHeight, [...currentSelectedIds])
          : undefined
        renderMap(canvas, mapArea, view, activeCity.landmarks, { visibleSportIds: currentVisibleIds, selectedSportIds: currentSelectedIds, trendingEnabled, trendingSignals }, { background, mapLabels: activeCity.mapLabels, route })
      })
    }
    scheduleDrawRef.current = draw
    const observer = new ResizeObserver(draw)
    observer.observe(canvas.parentElement ?? canvas)
    window.addEventListener('resize', draw)
    draw()
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', draw); if (scheduleDrawRef.current === draw) scheduleDrawRef.current = null }
  }, [mapArea, mode, filter, priceFilter, accessibilityFilter, familyFilter, searchQuery, selected, trendingEnabled, trendingSignals, route])

  const reset = () => {
    cameraRef.current = { zoom: 1, pan: { x: 0, y: 0 } }
    scheduleDrawRef.current?.()
    const canvas = canvasRef.current
    if (canvas) scheduleViewportLoad({ width: canvas.clientWidth, height: canvas.clientHeight, mode: '2d', zoom: 1, pan: { x: 0, y: 0 } })
  }
  const zoomTo = (anchor: { x: number; y: number }, direction: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const current = cameraRef.current
    const nextZoom = Math.min(MAX_ZOOM, Math.max(.55, current.zoom * direction))
    const ratio = nextZoom / current.zoom
    const nextPan = { x: anchor.x - rect.width / 2 - (anchor.x - rect.width / 2 - current.pan.x) * ratio, y: anchor.y - rect.height / 2 - (anchor.y - rect.height / 2 - current.pan.y) * ratio }
    cameraRef.current = { zoom: nextZoom, pan: nextPan }
    scheduleDrawRef.current?.()
    scheduleViewportLoad({ width: rect.width, height: rect.height, mode, zoom: nextZoom, pan: nextPan })
  }
  const zoomAt = (event: WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1
    const delta = Math.max(-240, Math.min(240, event.deltaY * unit))
    if (!delta) return
    zoomTo({ x: event.clientX - rect.left, y: event.clientY - rect.top }, Math.exp(-delta * (event.ctrlKey ? .008 : .0015)))
  }
  const zoomAtCenter = (direction: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    zoomTo({ x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 }, direction)
  }
  const selectMode = (nextMode: Mode) => {
    setMode(nextMode)
    const canvas = canvasRef.current
    if (canvas) scheduleViewportLoad({ width: canvas.clientWidth, height: canvas.clientHeight, mode: nextMode, zoom: cameraRef.current.zoom, pan: cameraRef.current.pan })
  }
  const selectFilter = (nextFilter: SportFilter) => {
    setFilter(nextFilter)
    if (selected && !matchesFilter(selected, nextFilter)) setSelected(undefined)
  }
  const calculateRoute = async () => {
    if (!startingPoint.trim() || !selected?.center) return
    const requestId = ++routeRequestRef.current
    setRouteStatus('loading')
    setAddressError(false)
    let origin = originCoordinates
    if (!origin) {
      try { origin = await geocodeAddress(startingPoint.trim()) }
      catch {
        if (requestId !== routeRequestRef.current) return
        setAddressError(true); setRouteStatus('idle'); setRoutes({}); return
      }
    }
    if (requestId !== routeRequestRef.current) return
    try {
      setOriginSuggestions([])
      const results = await Promise.allSettled((['walk', 'bike', 'car'] as const).map((mode) => routeByMode(origin, selected.center!, mode)))
      if (requestId !== routeRequestRef.current) return
      const nextRoutes: Partial<Record<Exclude<TravelMode, 'transit'>, RouteResult>> = {}
      results.forEach((result) => { if (result.status === 'fulfilled') nextRoutes[result.value.mode] = result.value })
      if (!Object.keys(nextRoutes).length) throw new Error('No routes')
      setRoutes(nextRoutes); setRouteStatus('idle')
    } catch { if (requestId === routeRequestRef.current) { setRoutes({}); setRouteStatus('error') } }
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

  if (reviewMode) return <ReviewWorkbench />
  if (!mapArea) return <main className="app-shell loading-shell"><div className="loading-state"><span className="status-dot" /><strong>{text(locale, 'loading', { city: activeCity.displayName })}</strong><span>{text(locale, 'preparing')}</span></div></main>

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand-block"><div className="brand-lockup"><img src="/helsinkisportsmaplogo.png" alt="" aria-hidden="true" /><h1>{activeCity.displayName} {text(locale, 'sportsMap')}</h1></div><p>{extraText(locale, 'areaLabel')}</p></div>
      <div className="topbar-right"><div className="mode-toggle" aria-label={extraText(locale, 'mapProjection')}><button className={mode === '2d' ? 'selected' : ''} aria-pressed={mode === '2d'} onClick={() => selectMode('2d')}>{extraText(locale, 'mode2d')}</button><button className={mode === 'iso' ? 'selected' : ''} aria-pressed={mode === 'iso'} onClick={() => selectMode('iso')}>{extraText(locale, 'modeIso')}</button></div><div className="language-toggle" aria-label={String(text(locale, 'language'))}><button className={locale === 'en' ? 'selected' : ''} aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>EN</button><button className={locale === 'fi' ? 'selected' : ''} aria-pressed={locale === 'fi'} onClick={() => setLocale('fi')}>FI</button></div></div>
    </header>
    <nav className="filter-bar" aria-label={extraText(locale, 'filterFacilities')}><span className="filter-label">{text(locale, 'sport')}</span><div className="filter-options">{filterOptions.map((option) => <button key={option.id} className={filter === option.id ? 'selected' : ''} aria-pressed={filter === option.id} onClick={() => selectFilter(option.id)}>{option.id === 'all' ? text(locale, 'all') : sportText(locale, option.id)}</button>)}</div><details className="filter-drawer"><summary>{text(locale, 'filters')}{activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}</summary><div className="filter-drawer-panel"><div className="filter-drawer-group"><span className="filter-drawer-label">{text(locale, 'priceFilter')}</span><div className="filter-options">{(['all', 'free', 'paid'] as const).map((option) => <button key={option} className={priceFilter === option ? 'selected' : ''} aria-pressed={priceFilter === option} onClick={() => setPriceFilter(option)}>{text(locale, option === 'all' ? 'allPrices' : option === 'free' ? 'priceFree' : 'pricePaid')}</button>)}</div></div><div className="filter-drawer-group"><span className="filter-drawer-label">{text(locale, 'accessibilityFilter')}</span><div className="filter-options">{(['all', 'stepFreeEntrance', 'accessibleToilet', 'accessibleParking'] as const).map((option) => <button key={option} className={accessibilityFilter === option ? 'selected' : ''} aria-pressed={accessibilityFilter === option} onClick={() => setAccessibilityFilter(option)}>{text(locale, option === 'all' ? 'allAccessibility' : option)}</button>)}</div></div><div className="filter-drawer-group"><span className="filter-drawer-label">{text(locale, 'audienceFilter')}</span><div className="filter-options"><button className={familyFilter === 'all' ? 'selected' : ''} aria-pressed={familyFilter === 'all'} onClick={() => setFamilyFilter('all')}>{text(locale, 'allAudiences')}</button><button className={familyFilter === 'family' ? 'selected' : ''} aria-pressed={familyFilter === 'family'} onClick={() => setFamilyFilter('family')}>{text(locale, 'childrenFamilies')}</button></div></div></div></details><span className="result-count">{visibleSports.length} {text(locale, 'areas')}</span></nav>
    <div className="search-row"><label className="search-control"><span>{text(locale, 'search')}</span><input value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setSelected(undefined); setRoutes({}) }} placeholder={text(locale, 'searchPlaceholder')} aria-label={text(locale, 'searchPlaceholder')} />{searchQuery && <button type="button" onClick={() => setSearchQuery('')} aria-label={text(locale, 'clearSearch')}>×</button>}</label>{searchQuery.trim() && visibleSports.length === 1 && !selected && <button className="select-result-button" type="button" onClick={() => setSelected(visibleSports[0])}>{text(locale, 'selectResult')}: {visibleSports[0].name}</button>}<label className="origin-control"><span>{text(locale, 'startingPoint')}</span><div className="origin-input-wrap"><input value={startingPoint} onChange={(event) => { locationRequestRef.current += 1; setStartingPoint(event.target.value); setOriginCoordinates(undefined); setOriginSuggestions([]); setRoutes({}); setRouteStatus('idle'); setLocationStatus('idle') }} placeholder={text(locale, 'startingPointPlaceholder')} aria-label={text(locale, 'startingPointPlaceholder')} autoComplete="off" /><button className="location-button" type="button" onClick={useCurrentLocation} disabled={locationStatus === 'loading'} aria-label={text(locale, 'useCurrentLocation')} title={text(locale, 'useCurrentLocation')}>⌖</button></div>{originSuggestions.length > 0 && <div className="address-suggestions" role="listbox" aria-label={text(locale, 'addressSuggestions')}>{originSuggestions.map((suggestion) => <button key={`${suggestion.coordinates.join(',')}-${suggestion.label}`} type="button" role="option" onClick={() => { setStartingPoint(suggestion.label); setOriginCoordinates(suggestion.coordinates); setOriginSuggestions([]) }}>{suggestion.label}</button>)}</div>}{locationStatus === 'loading' && <span className="location-status" role="status">{text(locale, 'locationLoading')}</span>}{locationStatus === 'denied' && <span className="location-status error" role="status">{text(locale, 'locationDenied')}</span>}{locationStatus === 'error' && <span className="location-status error" role="status">{text(locale, 'locationError')}</span>}</label><button className="route-button" type="button" onClick={calculateRoute} disabled={routeStatus === 'loading' || !startingPoint.trim() || !selected?.center}>{routeStatus === 'loading' ? text(locale, 'routing') : text(locale, 'calculateRoute')}</button>{routeStatus === 'error' && <span className="route-error">{text(locale, 'routeError')}</span>}</div>
    {canPlanRoute && <div className="travel-mode-row" aria-label={text(locale, 'travelMode')}><span className="travel-mode-label">{text(locale, 'travelMode')}</span>{(['walk', 'bike', 'transit', 'car'] as const).map((modeOption) => { const result = modeOption === 'transit' ? undefined : routes[modeOption]; const label = text(locale, modeOption); return <button key={modeOption} className={`travel-mode ${travelMode === modeOption ? 'selected' : ''} ${!result && modeOption !== 'transit' ? 'unavailable' : ''}`} type="button" disabled={modeOption === 'transit'} onClick={() => setTravelMode(modeOption)}>{label}{result && <small>{Math.max(1, Math.round(result.durationSeconds / 60))} {text(locale, 'minutes')}</small>}{modeOption === 'transit' && <small>{text(locale, 'notAvailable')}</small>}</button> })}</div>}
    <div className="journey-feedback" role="status">
      {addressError && <p>{locale === 'fi' ? 'Lähtöpaikan osoitehaku epäonnistui. Tarkista osoite tai käytä nykyistä sijaintia.' : 'Starting-point lookup failed. Check the address or use your current location.'}</p>}
      {selected && <p>{locale === 'fi' ? 'Määränpää' : 'Destination'}: <strong>{selected.name}</strong>{!startingPoint.trim() && (locale === 'fi' ? ' — lisää lähtöpaikka reittiä varten.' : ' — add a starting point to plan your route.')}</p>}
      {!selected && startingPoint.trim() && <p>{locale === 'fi' ? 'Valitse määränpää kartalta tai liikuntapaikkalistasta.' : 'Select a destination on the map or in the facility list.'}</p>}
      {visibleSports.length === 0 && <p>{locale === 'fi' ? 'Näillä rajauksilla ei löytynyt liikuntapaikkoja.' : 'No facilities match these filters.'} <button type="button" onClick={() => { setSearchQuery(''); setFilter('all'); setPriceFilter('all'); setAccessibilityFilter('all'); setFamilyFilter('all') }}>{locale === 'fi' ? 'Poista hakurajaukset' : 'Clear search and filters'}</button></p>}
    </div>
    <section className="map-stage">
      <canvas ref={canvasRef} onWheel={zoomAt} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); draggingRef.current = true; drag.current = { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false } }} onPointerMove={(event) => { if (!drag.current) return; const dx = event.clientX - drag.current.x; const dy = event.clientY - drag.current.y; if (Math.abs(event.clientX - drag.current.startX) + Math.abs(event.clientY - drag.current.startY) > 4) drag.current.moved = true; drag.current.x = event.clientX; drag.current.y = event.clientY; cameraRef.current = { ...cameraRef.current, pan: { x: cameraRef.current.pan.x + dx, y: cameraRef.current.pan.y + dy } }; scheduleDrawRef.current?.() }} onPointerUp={(event) => { const gesture = drag.current; drag.current = null; draggingRef.current = false; const rect = event.currentTarget.getBoundingClientRect(); if (!gesture?.moved) { const picked = pickMapTarget(event.currentTarget, mapArea, { mode, zoom: cameraRef.current.zoom, pan: cameraRef.current.pan }, { x: event.clientX - rect.left, y: event.clientY - rect.top }, activeCity.landmarks, visibleSportIds); if (picked?.cluster) zoomTo({ x: event.clientX - rect.left, y: event.clientY - rect.top }, 1.55); else setSelected(picked?.feature) } else { scheduleViewportLoad({ width: rect.width, height: rect.height, mode, zoom: cameraRef.current.zoom, pan: cameraRef.current.pan }) } scheduleDrawRef.current?.() }} onPointerCancel={() => { drag.current = null; draggingRef.current = false; scheduleDrawRef.current?.() }} aria-hidden="true" />
      <div className="canvas-note"><span className="note-kicker">{mode === '2d' ? extraText(locale, 'twoDOverview') : extraText(locale, 'isometricView')}</span><strong>{mode === '2d' ? text(locale, 'findFacility') : text(locale, 'exploreDistrict')}</strong><span>{mode === '2d' ? text(locale, 'selectHighlighted') : text(locale, 'spatialContext')}</span></div>
    {selected ? <aside className="facility-card" aria-live="polite"><div><strong>{selected.name ?? selectedVenue?.lipas?.name ?? text(locale, 'selectArea')}</strong><button onClick={() => { setSelected(undefined); setRoutes({}) }}>{text(locale, 'clear')}</button></div>{selectedVenue?.lipas?.address && <p className="facility-address"><span className="location-icon" aria-hidden="true" />{selectedVenue.lipas.address}</p>}<dl className="facility-facts"><div><dt>{text(locale, 'priceFilter')}</dt><dd>{text(locale, priceLabelKey(selectedVenue?.lipas?.priceClass ?? selected.priceClass))}</dd></div><div><dt>{text(locale, 'access')}</dt><dd>{text(locale, selectedVenue?.lipas?.accessStatus === 'open' ? 'accessOpen' : selectedVenue?.lipas?.accessStatus === 'restricted' ? 'accessRestricted' : selectedVenue?.lipas?.accessStatus === 'booking' ? 'accessBooking' : 'accessUnknown')}</dd></div></dl>{!selectedVenue?.lipas?.accessNoteFi && (selectedVenue?.lipas?.accessSourceUrl ?? selectedVenue?.officialUrl) && <p className="facility-access-link"><a href={selectedVenue?.lipas?.accessSourceUrl ?? selectedVenue?.officialUrl} target="_blank" rel="noreferrer">{text(locale, 'verifyAccess')} ↗</a></p>}{selectedVenue?.lipas?.accessNoteFi && <div className="facility-access"><span className="facility-question">{text(locale, 'access')}</span><p>{locale === 'en' ? selectedVenue.lipas.accessNoteEn : selectedVenue.lipas.accessNoteFi}</p>{selectedVenue.lipas.accessSourceUrl && <a href={selectedVenue.lipas.accessSourceUrl} target="_blank" rel="noreferrer">{text(locale, 'verifyAccess')} ↗</a>}</div>}{route && <span className="facility-type">{text(locale, travelMode === 'walk' ? 'walkingRoute' : travelMode)}: {Math.max(1, Math.round(route.durationSeconds / 60))} {text(locale, 'minutes')} · {Math.round(route.distanceMetres)} m</span>}{selectedVenue?.lipas?.typeName && <span className="facility-type">{locale === 'en' ? selectedVenue.lipas.typeNameEn ?? selectedVenue.lipas.typeName : selectedVenue.lipas.typeName}</span>}{selectedVenue?.sports.length ? <><span className="facility-question">{text(locale, 'whatCanYouDo')}</span><ul className="facility-activities">{selectedVenue.sports.map((sport) => <li key={sport}>{venueActivityLabel(locale, sport)}</li>)}</ul></> : <p className="facility-unknown">{text(locale, 'missingSports')}</p>}{serviceMap && <details className="official-details"><summary>{text(locale, 'officialInfo')}</summary>{(locale === 'en' ? serviceMap.shortDescriptionEn : serviceMap.shortDescriptionFi) && <p>{locale === 'en' ? serviceMap.shortDescriptionEn : serviceMap.shortDescriptionFi}</p>}{(locale === 'en' ? serviceMap.servicesEn : serviceMap.servicesFi).length > 0 && <><span className="facility-question">{text(locale, 'officialServices')}</span><ul className="official-services">{(locale === 'en' ? serviceMap.servicesEn : serviceMap.servicesFi).map((service) => <li key={service}>{service}</li>)}</ul></>}{(locale === 'en' ? serviceMap.openingHoursEn : serviceMap.openingHoursFi) && <><span className="facility-question">{text(locale, 'openingHours')}</span><p className="official-hours">{locale === 'en' ? serviceMap.openingHoursEn : serviceMap.openingHoursFi}</p></>}{(locale === 'en' ? serviceMap.priceEn : serviceMap.priceFi) && <><span className="facility-question">{text(locale, 'priceDetails')}</span><div className="price-groups">{serviceMap.priceGroups.map((group) => <section key={group.heading}><strong>{group.heading}</strong><ul>{group.items.map((item) => <li key={item}>{item}</li>)}</ul></section>)}</div></>}{serviceMap.links.length > 0 && <><span className="facility-question">{text(locale, 'officialLinks')}</span><ul className="official-links">{serviceMap.links.map((link) => <li key={link.url}><a href={link.url} target="_blank" rel="noreferrer">{locale === 'en' ? link.labelEn : link.labelFi} ↗</a></li>)}</ul></>}</details>}{selectedVenue && <div className="facility-links"><a href={selectedVenue.officialUrl ?? selectedVenue.sourceUrl} target="_blank" rel="noreferrer">{selectedVenue.officialUrl ? text(locale, 'openOfficial') : text(locale, 'viewSource')} ↗</a></div>}</aside> : <div className="map-legend"><div><span className="legend-swatch facility" /> {text(locale, 'selectArea')}</div><div><span className="legend-swatch park" /> {text(locale, 'contextMap')}</div><div><span className="legend-swatch water" /> {text(locale, 'water')}</div>{trendingEnabled && <><div className="legend-divider" /><div><span className="legend-swatch trend-new" /> {text(locale, 'newOnList')}</div><div><span className="legend-swatch trend-rising" /> {text(locale, 'risingInterest')}</div><div><span className="legend-swatch trend-popular" /> {text(locale, 'popularNow')}</div><small>{text(locale, 'trendingNote')}</small></>}</div>}
    <details className="facility-list"><summary><span className="facility-list-summary-open">{text(locale, 'openFacilityList')}</span><span className="facility-list-summary-close">{text(locale, 'closeFacilityList')}</span> · {visibleSports.length}</summary><p>{text(locale, 'facilityListHint')}</p><div role="list">{[...visibleSports].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', locale)).map((feature) => { const venue = venueForFeature(mapArea.venues, feature); const activities = venue?.sports?.map((sport) => venueActivityLabel(locale, sport)).join(', '); return <div role="listitem" key={feature.id}><button type="button" className={selected?.id === feature.id ? 'selected' : ''} aria-pressed={selected?.id === feature.id} onClick={() => setSelected(feature)}><strong>{feature.name ?? venue?.lipas?.name ?? text(locale, 'selectArea')}</strong><span>{activities || (venue?.lipas?.typeName ? locale === 'en' ? venue.lipas.typeNameEn ?? venue.lipas.typeName : venue.lipas.typeName : text(locale, 'missingSports'))}</span>{venue?.lipas?.address && <span>{venue.lipas.address}</span>}<span className="facility-price">{text(locale, priceLabelKey(feature.priceClass))}</span></button></div> })}</div></details>
     {debugVenues && <aside className="debug-venues" aria-label="Venue debug information"><strong>DEBUG / VENUES</strong><span>{venueDiagnostics.featureCount} map features · {venueDiagnostics.venueCount} venues · {venueDiagnostics.sourceCount} sources</span><span>{venueDiagnostics.duplicateNameGroups} duplicate-name groups after merge</span>{venueDiagnostics.duplicateNames.length > 0 && <span title={venueDiagnostics.duplicateNames.join(' · ')}>Examples: {venueDiagnostics.duplicateNames.join(' · ')}</span>}<span>URL flag: <code>?debug=venues</code></span></aside>}
     <div className="map-controls"><button onClick={() => zoomAtCenter(1.12)} aria-label={extraText(locale, 'zoomIn')}>+</button><button onClick={() => zoomAtCenter(.89)} aria-label={extraText(locale, 'zoomOut')}>−</button><button onClick={reset}>{text(locale, 'reset')}</button></div>
      <button type="button" className={`trend-toggle trend-map-toggle ${trendingEnabled ? 'selected' : ''}`} aria-pressed={trendingEnabled} onClick={() => setTrendingEnabled((value) => !value)}><span className="trend-glyph" /> {text(locale, 'trending')}</button>
      <div className={`compass compass-${mode}`} aria-label={text(locale, 'compass')}><span className="compass-label compass-north">N</span><span className="compass-label compass-east">E</span><span className="compass-label compass-south">S</span><span className="compass-label compass-west">W</span><span className="compass-needle" /></div>
      <div className="scale">≈ 100 m <span /></div>
    </section>
    <footer className="footer"><a href={mapArea.source} target="_blank" rel="noreferrer">{mapArea.attribution} · ODbL</a><span className="footer-disclaimer">{extraText(locale, 'officialDisclaimer')}</span><button className="privacy-link" type="button" onClick={() => setConsentVisible(true)}>{text(locale, 'privacySettings')}</button></footer>
    {consentVisible && <aside className="consent-banner" role="dialog" aria-labelledby="privacy-consent-title" aria-describedby="privacy-consent-body"><div><span className="consent-kicker">{text(locale, 'privacySettings')}</span><strong id="privacy-consent-title">{text(locale, 'analyticsConsentTitle')}</strong><p id="privacy-consent-body">{text(locale, 'analyticsConsentBody')}</p><details className="consent-details"><summary>{text(locale, 'privacyDetails')}</summary><p>{text(locale, 'privacyDetailsBody')}</p></details></div><div className="consent-actions"><button type="button" className="consent-secondary" onClick={() => chooseAnalyticsConsent('denied')}>{text(locale, 'onlyNecessary')}</button><button type="button" className="consent-primary" onClick={() => chooseAnalyticsConsent('granted')}>{text(locale, 'allowAnalytics')}</button></div></aside>}
  </main>
}

export default App
