import { useLayoutEffect, useRef, useState } from 'react'
import { area } from './data/area'
import { renderMap } from './renderer/mapRenderer'

type Mode = '2d' | 'iso'

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mode, setMode] = useState<Mode>('2d')
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number } | null>(null)

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let frame = 0
    const draw = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        renderMap(canvas, area, { mode, zoom, pan })
      })
    }
    const observer = new ResizeObserver(draw)
    observer.observe(canvas.parentElement ?? canvas)
    window.addEventListener('resize', draw)
    draw()
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', draw) }
  }, [mode, zoom, pan])
  const reset = () => { setZoom(1); setPan({ x: 0, y: 0 }) }
  return <main className="app-shell">
    <header className="topbar">
      <div><h1>Helsinki Sports Map</h1><p>Töölö / Olympic Stadium study area</p></div>
      <div className="topbar-right"><span className="status-dot" /> <span>Real OSM geometry</span><div className="mode-toggle" aria-label="Map projection"><button className={mode === '2d' ? 'selected' : ''} onClick={() => setMode('2d')}>2D</button><button className={mode === 'iso' ? 'selected' : ''} onClick={() => setMode('iso')}>ISOMETRIC</button></div></div>
    </header>
    <section className="map-stage">
      <canvas ref={canvasRef} onWheel={(event) => { event.preventDefault(); setZoom((value) => Math.min(1.8, Math.max(.65, value * (event.deltaY > 0 ? .93 : 1.07)))) }} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY } }} onPointerMove={(event) => { if (!drag.current) return; const dx = event.clientX - drag.current.x; const dy = event.clientY - drag.current.y; drag.current = { x: event.clientX, y: event.clientY }; setPan((value) => ({ x: value.x + dx, y: value.y + dy })) }} onPointerUp={() => { drag.current = null }} aria-label="Interactive map canvas" />
      <div className="canvas-note"><span className="note-kicker">RENDER STUDY 02</span><strong>Real Helsinki geometry</strong><span>One dataset, two projections.</span></div>
      <div className="map-legend"><div><span className="legend-swatch facility" /> Sports grounds</div><div><span className="legend-swatch park" /> Parks & green areas</div><div><span className="legend-swatch water" /> Water</div></div>
      <div className="map-controls"><button onClick={() => setZoom((value) => Math.min(1.8, value + .1))} aria-label="Zoom in">+</button><button onClick={() => setZoom((value) => Math.max(.65, value - .1))} aria-label="Zoom out">−</button><button onClick={reset}>Reset</button></div>
      <div className="scale">≈ 100 m <span /></div>
    </section>
    <footer className="footer"><a href={area.source} target="_blank" rel="noreferrer">{area.attribution} · ODbL</a><span>{area.sports.length} sports areas · {mode === '2d' ? 'orthographic plan' : 'isometric projection'}</span></footer>
  </main>
}

export default App
