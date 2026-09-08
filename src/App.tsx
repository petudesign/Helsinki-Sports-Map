import { useLayoutEffect, useRef, useState } from 'react'
import { area } from './data/area'
import type { SportFeature } from './data/types'
import { olympicAreaLandmarks } from './renderer/landmarks/olympicArea'
import { pickSportFeature, renderMap } from './renderer/mapRenderer'

type Mode = '2d' | 'iso'
type SportFilter = 'all' | 'football' | 'athletics' | 'swimming' | 'ice_hockey' | 'basketball'

const filterOptions: { id: SportFilter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'football', label: 'Football' }, { id: 'athletics', label: 'Athletics' },
  { id: 'swimming', label: 'Swimming' }, { id: 'ice_hockey', label: 'Ice hockey' }, { id: 'basketball', label: 'Basketball' },
]

const sportLabels: Record<string, string> = {
  soccer: 'Football', football: 'Football', athletics: 'Athletics', running: 'Running', swimming: 'Swimming',
  ice_hockey: 'Ice hockey', basketball: 'Basketball', skateboard: 'Skateboarding', beachvolleyball: 'Beach volleyball', multi: 'Multi-sport', sports_centre: 'Sports centre',
}

function matchesFilter(feature: SportFeature, filter: SportFilter) {
  if (filter === 'all') return true
  if (filter === 'football') return ['soccer', 'football'].includes(feature.sport)
  if (filter === 'athletics') return ['athletics', 'running'].includes(feature.sport)
  return feature.sport === filter
}

function facilityLabel(feature: SportFeature) {
  const type = feature.facilityType?.replace('_', ' ') ?? 'sports area'
  return `${sportLabels[feature.sport] ?? feature.sport.replace('_', ' ')} · ${type}`
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mode, setMode] = useState<Mode>('2d')
  const [filter, setFilter] = useState<SportFilter>('all')
  const [selected, setSelected] = useState<SportFeature>()
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; startX: number; startY: number; moved: boolean } | null>(null)
  const visibleSports = area.sports.filter((feature) => matchesFilter(feature, filter))
  const visibleSportIds = new Set(visibleSports.map(({ id }) => id))

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let frame = 0
    const draw = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const currentVisibleIds = new Set(area.sports.filter((feature) => matchesFilter(feature, filter)).map(({ id }) => id))
        const currentSelectedIds = new Set(selected ? area.sports.filter((feature) => selected.name ? feature.name === selected.name : feature.id === selected.id).map(({ id }) => id) : [])
        renderMap(canvas, area, { mode, zoom, pan }, olympicAreaLandmarks, { visibleSportIds: currentVisibleIds, selectedSportIds: currentSelectedIds })
      })
    }
    const observer = new ResizeObserver(draw)
    observer.observe(canvas.parentElement ?? canvas)
    window.addEventListener('resize', draw)
    draw()
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', draw) }
  }, [mode, zoom, pan, filter, selected])

  const reset = () => { setZoom(1); setPan({ x: 0, y: 0 }) }
  const selectFilter = (nextFilter: SportFilter) => {
    setFilter(nextFilter)
    if (selected && !matchesFilter(selected, nextFilter)) setSelected(undefined)
  }

  return <main className="app-shell">
    <header className="topbar">
      <div><h1>Helsinki Sports Map</h1><p>Töölö / Olympic Stadium study area</p></div>
      <div className="topbar-right"><span className="status-dot" /><span className="view-role">{mode === '2d' ? 'Practical overview' : 'Spatial exploration'}</span><div className="mode-toggle" aria-label="Map projection"><button className={mode === '2d' ? 'selected' : ''} aria-pressed={mode === '2d'} onClick={() => setMode('2d')}>2D</button><button className={mode === 'iso' ? 'selected' : ''} aria-pressed={mode === 'iso'} onClick={() => setMode('iso')}>ISOMETRIC</button></div></div>
    </header>
    <nav className="filter-bar" aria-label="Filter sports facilities"><span className="filter-label">Sport</span><div className="filter-options">{filterOptions.map((option) => <button key={option.id} className={filter === option.id ? 'selected' : ''} aria-pressed={filter === option.id} onClick={() => selectFilter(option.id)}>{option.label}</button>)}</div><span className="result-count">{visibleSports.length} areas</span></nav>
    <section className="map-stage">
      <canvas ref={canvasRef} onWheel={(event) => { event.preventDefault(); setZoom((value) => Math.min(1.8, Math.max(.65, value * (event.deltaY > 0 ? .93 : 1.07)))) }} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false } }} onPointerMove={(event) => { if (!drag.current) return; const dx = event.clientX - drag.current.x; const dy = event.clientY - drag.current.y; if (Math.abs(event.clientX - drag.current.startX) + Math.abs(event.clientY - drag.current.startY) > 4) drag.current.moved = true; drag.current.x = event.clientX; drag.current.y = event.clientY; setPan((value) => ({ x: value.x + dx, y: value.y + dy })) }} onPointerUp={(event) => { const gesture = drag.current; drag.current = null; if (!gesture?.moved) { const rect = event.currentTarget.getBoundingClientRect(); setSelected(pickSportFeature(event.currentTarget, area, { mode, zoom, pan }, { x: event.clientX - rect.left, y: event.clientY - rect.top }, olympicAreaLandmarks, visibleSportIds)) } }} onPointerCancel={() => { drag.current = null }} aria-label="Interactive sports map. Select a sports area for details." />
      <div className="canvas-note"><span className="note-kicker">{mode === '2d' ? '2D OVERVIEW' : 'ISOMETRIC VIEW'}</span><strong>{mode === '2d' ? 'Find a facility' : 'Explore the district'}</strong><span>{mode === '2d' ? 'Select any highlighted sports area.' : 'Sports places in spatial context.'}</span></div>
      {selected ? <aside className="facility-card" aria-live="polite"><div><span>Selected facility</span><button onClick={() => setSelected(undefined)}>Clear</button></div><strong>{selected.name ?? sportLabels[selected.sport] ?? 'Sports area'}</strong><p>{facilityLabel(selected)}</p></aside> : <div className="map-legend"><div><span className="legend-swatch facility" /> Select a sports area</div><div><span className="legend-swatch park" /> Context map</div><div><span className="legend-swatch water" /> Water</div></div>}
      <div className="map-controls"><button onClick={() => setZoom((value) => Math.min(1.8, value + .1))} aria-label="Zoom in">+</button><button onClick={() => setZoom((value) => Math.max(.65, value - .1))} aria-label="Zoom out">−</button><button onClick={reset}>Reset</button></div>
      <div className="scale">≈ 100 m <span /></div>
    </section>
    <footer className="footer"><a href={area.source} target="_blank" rel="noreferrer">{area.attribution} · ODbL</a><span>{visibleSports.length} sports areas · {mode === '2d' ? 'overview' : 'spatial model'}</span></footer>
  </main>
}

export default App
