import { useState } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

const buttonVariants: { label: string; variant: ButtonVariant }[] = [
  { label: 'Primary', variant: 'primary' },
  { label: 'Secondary', variant: 'secondary' },
  { label: 'Ghost', variant: 'ghost' },
]

const filterOptions = ['All', 'Swimming', 'Outdoor gym']

function DsButton({ children, variant = 'secondary', state = 'default', disabled = false }: { children: string; variant?: ButtonVariant; state?: 'default' | 'hover' | 'focus'; disabled?: boolean }) {
  return <button type="button" className={`ds-button ds-button-${variant} ${state === 'default' ? '' : `ds-state-${state}`}`} disabled={disabled}>{children}</button>
}

function DesignSystemPreview() {
  const [selectedFilter, setSelectedFilter] = useState('All')

  return <main className="ds-shell">
    <header className="ds-header">
      <div>
        <span className="ds-kicker">HSM / code system</span>
        <h1>Design system</h1>
        <p>Shared components and their states, rendered directly from the app code.</p>
      </div>
      <a href={window.location.pathname}>Back to map</a>
    </header>

    <div className="ds-content">
      <section className="ds-section" aria-labelledby="tokens-title">
        <div className="ds-section-heading"><div><h2 id="tokens-title">Foundation</h2><p>Change these roles in <code>src/design-system/tokens.css</code>.</p></div><span className="ds-count">semantic tokens</span></div>
        <div className="ds-token-grid">
          <div className="ds-token-group"><h3>Core palette</h3><div className="ds-swatches"><TokenSwatch name="Page" token="--hsm-color-page" /><TokenSwatch name="Surface" token="--hsm-color-surface" /><TokenSwatch name="Ink" token="--hsm-color-ink" /><TokenSwatch name="Muted ink" token="--hsm-color-ink-muted" /><TokenSwatch name="Accent" token="--hsm-color-accent" /><TokenSwatch name="Teal" token="--hsm-color-teal" /></div></div>
          <div className="ds-token-group"><h3>Semantic states</h3><div className="ds-status-row"><DsStatus label="Pending" tone="pending" /><DsStatus label="Approved" tone="approved" /><DsStatus label="Rejected" tone="rejected" /><DsStatus label="Skipped" tone="skipped" /></div></div>
        </div>
      </section>

      <section className="ds-section" aria-labelledby="buttons-title">
        <div className="ds-section-heading"><div><h2 id="buttons-title">Buttons</h2><p>Every visual state is explicit and testable, including keyboard focus and disabled behavior.</p></div></div>
        <div className="ds-state-table ds-button-table">
          <div className="ds-state-header"><span>Variant</span><span>Default</span><span>Hover</span><span>Focus</span><span>Disabled</span></div>
          {buttonVariants.map(({ label, variant }) => <div className="ds-state-row" key={variant}><strong>{label}</strong><DsButton variant={variant}>Continue</DsButton><DsButton variant={variant} state="hover">Continue</DsButton><DsButton variant={variant} state="focus">Continue</DsButton><DsButton variant={variant} disabled>Continue</DsButton></div>)}
        </div>
      </section>

      <section className="ds-section" aria-labelledby="filters-title">
        <div className="ds-section-heading"><div><h2 id="filters-title">Filters and selection</h2><p>Selected and disabled states are represented by more than color alone.</p></div></div>
        <div className="ds-filter-demo" role="group" aria-label="Filter state examples">
          {filterOptions.map((option) => <button key={option} type="button" className={`ds-filter ${selectedFilter === option ? 'selected' : ''}`} aria-pressed={selectedFilter === option} onClick={() => setSelectedFilter(option)}>{option}</button>)}
          <button type="button" className="ds-filter ds-state-hover">Hover example</button>
          <button type="button" className="ds-filter" disabled>Disabled</button>
        </div>
        <p className="ds-interaction-note">Selected: <strong>{selectedFilter}</strong> · click a filter to test the real selected state.</p>
      </section>

      <section className="ds-section" aria-labelledby="rows-title">
        <div className="ds-section-heading"><div><h2 id="rows-title">Data rows</h2><p>The same anatomy supports extracted, corrected, missing and approved values.</p></div></div>
        <div className="ds-row-list">
          <DsPriceRow label="Single visit" meta="Adults · source value" value="3.60 €" />
          <DsPriceRow label="10 visits or 1 month" meta="Adults · corrected by reviewer" value="29 €" state="corrected" />
          <DsPriceRow label="Accessibility" meta="Source did not provide a value" value="Needs review" state="missing" />
          <DsPriceRow label="Entry" meta="Approved record" value="Free of charge" state="approved" />
        </div>
      </section>

      <section className="ds-section" aria-labelledby="status-title">
        <div className="ds-section-heading"><div><h2 id="status-title">Review statuses</h2><p>Status is communicated through label, tone and text—not color alone.</p></div></div>
        <div className="ds-status-grid">
          <DsStatusCard tone="pending" title="Pending" detail="Awaiting human review" />
          <DsStatusCard tone="approved" title="Approved" detail="Safe to export" />
          <DsStatusCard tone="rejected" title="Rejected" detail="Do not publish" />
          <DsStatusCard tone="skipped" title="Skipped" detail="Needs later review" />
        </div>
      </section>
    </div>
  </main>
}

function TokenSwatch({ name, token }: { name: string; token: string }) {
  return <div className="ds-token-swatch"><span className="ds-swatch-color" style={{ background: `var(${token})` }} /><div><strong>{name}</strong><code>{token}</code></div></div>
}

function DsStatus({ label, tone }: { label: string; tone: 'pending' | 'approved' | 'rejected' | 'skipped' }) {
  return <span className={`ds-status ds-status-${tone}`}><span aria-hidden="true" className="ds-status-mark">{tone === 'approved' ? '✓' : tone === 'rejected' ? '×' : tone === 'skipped' ? '→' : '·'}</span>{label}</span>
}

function DsStatusCard({ title, detail, tone }: { title: string; detail: string; tone: 'pending' | 'approved' | 'rejected' | 'skipped' }) {
  return <div className={`ds-status-card ds-status-card-${tone}`}><DsStatus label={title} tone={tone} /><p>{detail}</p></div>
}

function DsPriceRow({ label, meta, value, state = 'default' }: { label: string; meta: string; value: string; state?: 'default' | 'corrected' | 'missing' | 'approved' }) {
  return <div className={`ds-price-row ds-price-row-${state}`}><div><strong>{label}</strong><small>{meta}</small></div><span>{value}</span></div>
}

export { DesignSystemPreview }
