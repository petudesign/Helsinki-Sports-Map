import { useState } from 'react'
import { RiBasketballLine, RiEqualizer2Line, RiFlagLine, RiFootballLine, RiNavigationLine, RiSearchLine } from '@remixicon/react'
import { Segmented } from '../ui/Segmented'
import './preview.css'

/*
 * Living reference for the component layer (?design-system=1, dev and prod).
 * Every example uses the same classes as the app, so it cannot drift.
 */
const swatches = [
  ['--surface-page', 'Page'], ['--surface', 'Surface'], ['--surface-muted', 'Muted'], ['--accent', 'Accent'], ['--accent-soft', 'Accent soft'],
  ['--text-1', 'Text 1 · 17.7:1'], ['--text-2', 'Text 2 · 7.7:1'], ['--text-3', 'Text 3 · 5.7:1'],
] as const

function DesignSystemPreview() {
  const [mode, setMode] = useState<'2d' | 'iso'>('2d')
  const [price, setPrice] = useState<'all' | 'free' | 'paid'>('all')
  const [sport, setSport] = useState('football')
  return <main className="ds">
    <header className="ds-head"><h1>Helsinki Sports Map — components</h1><p>Tokens in <code>src/design-system/tokens.css</code>, components in <code>src/ui/ui.css</code>. Decisions in <code>DECISIONS.md</code>.</p></header>

    <section className="ds-section"><h2>Colour</h2><div className="ds-swatches">{swatches.map(([token, label]) => <figure key={token}><span style={{ background: `var(${token})` }} /><figcaption>{label}<code>{token}</code></figcaption></figure>)}</div></section>

    <section className="ds-section"><h2>Radius and elevation</h2><div className="ds-row">
      {(['sm', 'md', 'lg', 'xl'] as const).map((size) => <div key={size} className="ds-tile" style={{ borderRadius: `var(--radius-${size})` }}>radius-{size}</div>)}
      {([1, 2, 3] as const).map((level) => <div key={level} className="ds-tile" style={{ boxShadow: `var(--shadow-${level})` }}>shadow-{level}</div>)}
    </div></section>

    <section className="ds-section"><h2>Buttons</h2><div className="ds-row">
      <button className="btn btn-primary" type="button">Primary</button>
      <button className="btn btn-secondary" type="button">Secondary</button>
      <button className="btn btn-ghost" type="button">Ghost</button>
      <button className="btn btn-primary" type="button" disabled>Disabled</button>
      <button className="icon-btn" type="button" aria-label="Report"><RiFlagLine size={18} aria-hidden="true" /></button>
    </div></section>

    <section className="ds-section"><h2>Chips and segmented controls</h2><div className="ds-row">
      <span className="chip is-active"><RiEqualizer2Line size={16} aria-hidden="true" />Filters<span className="chip-count">2</span></span>
      {[['football', 'Football', RiFootballLine], ['basketball', 'Basketball', RiBasketballLine]].map(([id, label, Icon]) => { const I = Icon as typeof RiFootballLine; return <button key={id as string} type="button" className="chip" aria-pressed={sport === id} onClick={() => setSport(id as string)}><I size={16} aria-hidden="true" />{label as string}</button> })}
      <Segmented label="Map projection" value={mode} onChange={setMode} options={[{ value: '2d', label: '2D' }, { value: 'iso', label: 'Tilt' }]} />
      <Segmented label="Price" value={price} onChange={setPrice} options={[{ value: 'all', label: 'All' }, { value: 'free', label: 'Free' }, { value: 'paid', label: 'Paid' }]} />
    </div></section>

    <section className="ds-section"><h2>Field and badge</h2><div className="ds-row ds-narrow">
      <label className="search-field" style={{ flex: '1 1 auto' }}><RiSearchLine className="search-icon" size={18} aria-hidden="true" /><input type="search" placeholder="Search by place or sport" /></label>
      <button className="btn btn-secondary near-button" type="button"><RiNavigationLine size={16} aria-hidden="true" />Near me</button>
      <span className="badge">Free</span><span className="badge">Preview data</span>
    </div></section>

    <section className="ds-section"><h2>List rows, note, empty state</h2><div className="ds-panel">
      <div className="note"><span>Distance from <strong>Current location</strong></span><button type="button" className="btn btn-ghost btn-sm">Clear</button></div>
      <ul className="place-list">
        <li><button type="button" className="place-row"><span className="place-row-main"><strong>Brahenkenttä</strong><span className="place-row-meta">Sports field · Skating, Basketball, Athletics +2 more</span><span className="place-row-address">Helsinginkatu 25</span></span><span className="place-row-aside"><span className="place-row-distance">370 m</span><span className="badge">Free</span></span></button></li>
        <li><button type="button" className="place-row" aria-current="true"><span className="place-row-main"><strong>Urheiluhallit Kallio</strong><span className="place-row-meta">Swimming hall · Swimming, Gym</span><span className="place-row-address">Helsinginkatu 25</span></span><span className="place-row-aside"><span className="place-row-distance">330 m</span></span></button></li>
      </ul>
      <div className="empty-state"><h3>No places match “Central Station”</h3><button type="button" className="btn btn-secondary"><RiNavigationLine size={16} aria-hidden="true" />Show places near Central Station</button><button type="button" className="btn btn-ghost">Clear search and filters</button></div>
    </div></section>

    <section className="ds-section"><h2>Disclosure and tooltip</h2><div className="ds-panel ds-pad">
      <details className="disclosure"><summary>Official facility information</summary><p style={{ color: 'var(--text-2)' }}>Opening hours, prices and services from the Helsinki Service Map.</p></details>
      <div className="maplibregl-popup map-tooltip" style={{ position: 'static', marginTop: 12 }}><div className="maplibregl-popup-content" style={{ display: 'inline-block' }}>Kallion ala-asteen koulu</div></div>
    </div></section>
  </main>
}

export { DesignSystemPreview }
