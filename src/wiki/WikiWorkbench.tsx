import { useEffect, useRef, useState } from 'react'
import { RiAddLine, RiArrowLeftLine, RiBookOpenLine, RiCheckLine, RiDeleteBinLine } from '@remixicon/react'
import './wiki.css'

type WikiLocale = 'en' | 'fi'
type WikiSubheading = { id: string; title: string; body: string }
type WikiHeading = { id: string; title: string; body: string; subheadings: WikiSubheading[] }
type WikiDraft = { title: string; headings: WikiHeading[] }
type SaveState = 'saved' | 'saving' | 'error'

const storageKey = 'helsinki-sports-map.wiki.v1'

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function readDraft(): WikiDraft {
  try {
    const saved = localStorage.getItem(storageKey)
    if (!saved) return { title: 'Sports Map wiki', headings: [] }
    const parsed = JSON.parse(saved) as WikiDraft
    if (typeof parsed.title !== 'string' || !Array.isArray(parsed.headings)) return { title: 'Sports Map wiki', headings: [] }
    return parsed
  } catch {
    return { title: 'Sports Map wiki', headings: [] }
  }
}

function Outline({ headings, locale, onNavigate }: { headings: WikiHeading[]; locale: WikiLocale; onNavigate: (id: string) => void }) {
  return headings.length ? <ol className="wiki-outline-list">
    {headings.map((heading) => <li key={heading.id}>
      <button type="button" className="wiki-outline-link" onClick={() => onNavigate(heading.id)}>{heading.title || (locale === 'fi' ? 'Nimetön otsikko' : 'Untitled heading')}</button>
      {heading.subheadings.length > 0 && <ol>{heading.subheadings.map((subheading) => <li key={subheading.id}><button type="button" className="wiki-outline-link" onClick={() => onNavigate(subheading.id)}>{subheading.title || (locale === 'fi' ? 'Nimetön alaotsikko' : 'Untitled subheading')}</button></li>)}</ol>}
    </li>)}
  </ol> : <p className="wiki-outline-empty">{locale === 'fi' ? 'Lisää otsikko rakentaaksesi sisällysluettelon.' : 'Add a heading to build the page outline.'}</p>
}

export function WikiWorkbench() {
  const [locale, setLocale] = useState<WikiLocale>('en')
  const [draft, setDraft] = useState<WikiDraft>(readDraft)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const mobileOutline = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    setSaveState('saving')
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(draft))
        setSaveState('saved')
      } catch {
        setSaveState('error')
      }
    }, 250)
    return () => window.clearTimeout(timer)
  }, [draft])

  const addHeading = () => {
    const heading: WikiHeading = { id: makeId(), title: '', body: '', subheadings: [] }
    setDraft((current) => ({ ...current, headings: [...current.headings, heading] }))
    window.setTimeout(() => document.getElementById(heading.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
  }

  const addSubheading = (headingId: string) => {
    const subheading: WikiSubheading = { id: makeId(), title: '', body: '' }
    setDraft((current) => ({
      ...current,
      headings: current.headings.map((heading) => heading.id === headingId ? { ...heading, subheadings: [...heading.subheadings, subheading] } : heading),
    }))
    window.setTimeout(() => document.getElementById(subheading.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
  }

  const navigateTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (mobileOutline.current) mobileOutline.current.open = false
  }

  const updateHeading = (id: string, changes: Partial<WikiHeading>) => {
    setDraft((current) => ({ ...current, headings: current.headings.map((heading) => heading.id === id ? { ...heading, ...changes } : heading) }))
  }

  const labels = locale === 'fi' ? {
    back: 'Takaisin kartalle', workspace: 'Työtila', map: 'Kartta', wiki: 'Wiki', review: 'Hintojen tarkistus', contents: 'Sisältö',
    pageLabel: 'DOKUMENTAATIO', addHeading: 'Lisää otsikko', addSubheading: 'Lisää alaotsikko', deleteHeading: 'Poista otsikko', deleteSubheading: 'Poista alaotsikko',
    intro: 'Dokumentoi liikuntakartan sisältö, lähteet ja toimintatavat.', noHeadings: 'Tämä sivu on vielä tyhjä.', start: 'Lisää ensimmäinen otsikko ja rakenna sivun sisältö siitä.',
    headingPlaceholder: 'Uusi otsikko', subheadingPlaceholder: 'Uusi alaotsikko', bodyPlaceholder: 'Kirjoita tähän…', saved: 'Tallennettu tällä laitteella', saving: 'Tallennetaan…', saveError: 'Tallennus epäonnistui', localNote: 'Luonnos tallentuu tähän selaimeen.', language: 'Kieli',
  } : {
    back: 'Back to map', workspace: 'Workspace', map: 'Map', wiki: 'Wiki', review: 'Price review', contents: 'Contents',
    pageLabel: 'DOCUMENTATION', addHeading: 'Add heading', addSubheading: 'Add subheading', deleteHeading: 'Delete heading', deleteSubheading: 'Delete subheading',
    intro: 'Document the map, its data sources and how the project is maintained.', noHeadings: 'This page is ready for its first section.', start: 'Add a heading to start shaping the page. Add subheadings and notes as you go.',
    headingPlaceholder: 'New heading', subheadingPlaceholder: 'New subheading', bodyPlaceholder: 'Add a note…', saved: 'Saved on this device', saving: 'Saving…', saveError: 'Could not save', localNote: 'Your draft is stored in this browser.', language: 'Language',
  }

  return <div className="wiki-shell">
    <aside className="wiki-sidebar" aria-label={labels.workspace}>
      <a className="wiki-brand" href="/" aria-label={labels.back}>
        <img src="/helsinkisportsmaplogo.png" alt="" aria-hidden="true" />
        <span><strong>Helsinki Sports Map</strong><small>{labels.workspace}</small></span>
      </a>
      <nav className="wiki-workspace-nav" aria-label={labels.workspace}>
        <span className="wiki-nav-kicker">{labels.workspace}</span>
        <a href="/" className="wiki-nav-item"><RiArrowLeftLine aria-hidden="true" size={17} />{labels.map}</a>
        <a href="/?wiki=1" className="wiki-nav-item is-current" aria-current="page"><RiBookOpenLine aria-hidden="true" size={17} />{labels.wiki}</a>
        <a href="/?review=1" className="wiki-nav-item"><span className="wiki-nav-spacer" />{labels.review}</a>
      </nav>
      <div className="wiki-sidebar-outline">
        <span className="wiki-nav-kicker">{labels.contents}</span>
        <Outline headings={draft.headings} locale={locale} onNavigate={navigateTo} />
      </div>
      <div className="wiki-sidebar-bottom">
        <label htmlFor="wiki-language">{labels.language}</label>
        <select id="wiki-language" value={locale} onChange={(event) => setLocale(event.target.value as WikiLocale)}>
          <option value="en">English</option><option value="fi">Suomi</option>
        </select>
      </div>
    </aside>

    <div className="wiki-main-column">
      <header className="wiki-topbar">
        <a href="/" className="wiki-back-link"><RiArrowLeftLine aria-hidden="true" size={17} />{labels.back}</a>
        <span className={`wiki-save-status ${saveState === 'error' ? 'has-error' : ''}`} role="status">
          {saveState === 'saved' ? <RiCheckLine aria-hidden="true" size={15} /> : null}
          {saveState === 'saved' ? labels.saved : saveState === 'saving' ? labels.saving : labels.saveError}
        </span>
      </header>

      <main className="wiki-document-scroll">
        <details className="wiki-mobile-outline" ref={mobileOutline}>
          <summary>{labels.contents}</summary>
          <Outline headings={draft.headings} locale={locale} onNavigate={navigateTo} />
        </details>
        <article className="wiki-document">
          <div className="wiki-page-heading">
            <div>
              <span className="wiki-page-kicker">{labels.pageLabel}</span>
              <input className="wiki-title-input" aria-label={locale === 'fi' ? 'Sivun otsikko' : 'Page title'} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
              <p className="wiki-intro">{labels.intro}</p>
            </div>
            <button className="wiki-primary-action" type="button" onClick={addHeading}><RiAddLine aria-hidden="true" size={17} />{labels.addHeading}</button>
          </div>

          {draft.headings.length === 0 ? <section className="wiki-empty-state">
            <RiBookOpenLine aria-hidden="true" size={22} />
            <strong>{labels.noHeadings}</strong>
            <p>{labels.start}</p>
            <button type="button" className="wiki-secondary-action" onClick={addHeading}><RiAddLine aria-hidden="true" size={16} />{labels.addHeading}</button>
          </section> : <div className="wiki-sections">
            {draft.headings.map((heading) => <section className="wiki-section" id={heading.id} key={heading.id}>
              <div className="wiki-section-heading">
                <h2><input aria-label={locale === 'fi' ? 'Otsikko' : 'Heading'} placeholder={labels.headingPlaceholder} value={heading.title} onChange={(event) => updateHeading(heading.id, { title: event.target.value })} /></h2>
                <button className="wiki-icon-action" type="button" onClick={() => setDraft((current) => ({ ...current, headings: current.headings.filter((item) => item.id !== heading.id) }))} aria-label={`${labels.deleteHeading}: ${heading.title || labels.headingPlaceholder}`} title={labels.deleteHeading}><RiDeleteBinLine aria-hidden="true" size={17} /></button>
              </div>
              <textarea className="wiki-body-input" aria-label={locale === 'fi' ? 'Teksti otsikon alla' : 'Text under heading'} placeholder={labels.bodyPlaceholder} value={heading.body} onChange={(event) => updateHeading(heading.id, { body: event.target.value })} rows={2} />
              {heading.subheadings.map((subheading) => <section className="wiki-subsection" id={subheading.id} key={subheading.id}>
                <div className="wiki-subsection-heading">
                  <h3><input aria-label={locale === 'fi' ? 'Alaotsikko' : 'Subheading'} placeholder={labels.subheadingPlaceholder} value={subheading.title} onChange={(event) => updateHeading(heading.id, { subheadings: heading.subheadings.map((item) => item.id === subheading.id ? { ...item, title: event.target.value } : item) })} /></h3>
                  <button className="wiki-icon-action" type="button" onClick={() => updateHeading(heading.id, { subheadings: heading.subheadings.filter((item) => item.id !== subheading.id) })} aria-label={`${labels.deleteSubheading}: ${subheading.title || labels.subheadingPlaceholder}`} title={labels.deleteSubheading}><RiDeleteBinLine aria-hidden="true" size={16} /></button>
                </div>
                <textarea className="wiki-body-input" aria-label={locale === 'fi' ? 'Teksti alaotsikon alla' : 'Text under subheading'} placeholder={labels.bodyPlaceholder} value={subheading.body} onChange={(event) => updateHeading(heading.id, { subheadings: heading.subheadings.map((item) => item.id === subheading.id ? { ...item, body: event.target.value } : item) })} rows={2} />
              </section>)}
              <button type="button" className="wiki-add-subheading" onClick={() => addSubheading(heading.id)}><RiAddLine aria-hidden="true" size={16} />{labels.addSubheading}</button>
            </section>)}
          </div>}
          <p className="wiki-local-note">{labels.localNote}</p>
        </article>
      </main>
    </div>
  </div>
}
