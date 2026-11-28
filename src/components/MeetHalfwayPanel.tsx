import { useEffect, useRef, useState } from 'react'
import { RiCloseLine, RiFocus3Line, RiPencilLine } from '@remixicon/react'
import type { GeoPoint } from '../data/types'
import { text, type Locale } from '../i18n'
import { geocodeAddress, reverseGeocode, searchAddresses, type AddressSuggestion } from '../geocoding'
import { placeKindLabel } from '../format'
import { SuggestionIcon } from './icons'
import type { HalfwayPair, HalfwayPoint } from '../meetHalfway'

type Props = {
  locale: Locale
  activePair?: HalfwayPair
  editing: boolean
  initialOrigin?: HalfwayPoint
  onEdit: () => void
  onApply: (pair: HalfwayPair) => void
  onClose: () => void
}

function useAddressSuggestions(query: string, coordinates: GeoPoint | undefined, accepted: string | undefined, locale: Locale) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2 || coordinates || accepted === trimmed) { setSuggestions([]); return }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      searchAddresses(trimmed, controller.signal, locale)
        .then((items) => { if (!controller.signal.aborted) setSuggestions(items) })
        .catch(() => { if (!controller.signal.aborted) setSuggestions([]) })
    }, 300)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [query, coordinates, accepted, locale])
  return [suggestions, setSuggestions] as const
}

export function MeetHalfwayPanel({ locale, activePair, editing, initialOrigin, onEdit, onApply, onClose }: Props) {
  const [labelA, setLabelA] = useState(() => activePair?.a.label ?? initialOrigin?.label ?? '')
  const [coordsA, setCoordsA] = useState<GeoPoint | undefined>(() => activePair?.a.coordinates ?? initialOrigin?.coordinates)
  const [labelB, setLabelB] = useState(() => activePair?.b.label ?? '')
  const [coordsB, setCoordsB] = useState<GeoPoint | undefined>(() => activePair?.b.coordinates)
  const [submitting, setSubmitting] = useState(false)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState<string>()
  const acceptedA = useRef<string | undefined>(undefined)
  const acceptedB = useRef<string | undefined>(undefined)
  const [suggestionsA, setSuggestionsA] = useAddressSuggestions(labelA, coordsA, acceptedA.current, locale)
  const [suggestionsB, setSuggestionsB] = useAddressSuggestions(labelB, coordsB, acceptedB.current, locale)

  const useCurrentLocationForA = () => {
    if (!navigator.geolocation) { setError(text(locale, 'locationError')); return }
    setLocating(true)
    setError(undefined)
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const point: GeoPoint = [coords.longitude, coords.latitude]
      setCoordsA(point)
      setLabelA(text(locale, 'currentLocation'))
      setSuggestionsA([])
      setLocating(false)
      reverseGeocode(point).then((suggestion) => setLabelA(suggestion.label)).catch(() => { /* keep Current location */ })
    }, (err) => {
      setLocating(false)
      setError(text(locale, err.code === err.PERMISSION_DENIED ? 'locationDenied' : 'locationError'))
    }, { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 })
  }

  const submit = async () => {
    const trimmedA = labelA.trim()
    const trimmedB = labelB.trim()
    if (!trimmedA || !trimmedB) return
    setSubmitting(true)
    setError(undefined)
    try {
      const [pointA, pointB] = await Promise.all([
        coordsA ? Promise.resolve(coordsA) : geocodeAddress(trimmedA, locale),
        coordsB ? Promise.resolve(coordsB) : geocodeAddress(trimmedB, locale),
      ])
      setCoordsA(pointA)
      setCoordsB(pointB)
      setSuggestionsA([])
      setSuggestionsB([])
      onApply({ a: { coordinates: pointA, label: trimmedA }, b: { coordinates: pointB, label: trimmedB } })
    } catch {
      setError(locale === 'fi' ? 'Jompaakumpaa lähtöpaikkaa ei löytynyt. Tarkista osoite tai kaupunginosa.' : 'One of the starting points wasn’t found. Check the address or district.')
    } finally {
      setSubmitting(false)
    }
  }

  if (activePair && !editing) {
    return <div className="directions-compact halfway-compact" role="group" aria-label={locale === 'fi' ? 'Puolivälihaku' : 'Meet halfway'}>
      <button className="directions-compact-trigger" type="button" onClick={onEdit} aria-label={locale === 'fi' ? `Muokkaa puolivälihakua: ${activePair.a.label} ja ${activePair.b.label}` : `Edit meet halfway: ${activePair.a.label} and ${activePair.b.label}`}>
        <span className="directions-dot is-start" aria-hidden="true" />
        <span className="directions-compact-origin">{activePair.a.label}</span>
        <span className="halfway-compact-sep" aria-hidden="true">↔</span>
        <span className="directions-dot is-halfway-b" aria-hidden="true" />
        <span className="directions-compact-dest">{activePair.b.label}</span>
        <RiPencilLine className="directions-compact-edit" aria-hidden="true" size={14} />
      </button>
      <button className="icon-btn icon-btn-sm" type="button" onClick={onClose} aria-label={locale === 'fi' ? 'Sulje puolivälihaku' : 'Close meet halfway'} title={locale === 'fi' ? 'Sulje' : 'Close'}><RiCloseLine aria-hidden="true" size={18} /></button>
    </div>
  }

  return <div className="directions-panel halfway-panel" role="group" aria-label={locale === 'fi' ? 'Puolivälihaku' : 'Meet halfway'}>
    <div className="directions-fields">
      <div className="field directions-origin">
        <label className="field-label" htmlFor="halfway-a">
          <span className="halfway-field-dot is-start" aria-hidden="true" />
          {locale === 'fi' ? 'Lähtöpaikka A' : 'Starting point A'}
        </label>
        <input id="halfway-a" autoFocus={window.matchMedia('(pointer: fine)').matches && !labelA} value={labelA} onChange={(event) => { acceptedA.current = undefined; setLabelA(event.target.value); setCoordsA(undefined); setError(undefined) }} placeholder={locale === 'fi' ? 'Esim. Kallio tai osoite' : 'e.g. Kallio or address'} autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="next" />
        <button className="icon-btn location-button" type="button" onClick={useCurrentLocationForA} disabled={locating} aria-label={text(locale, 'useCurrentLocation')} title={text(locale, 'useCurrentLocation')}><RiFocus3Line aria-hidden="true" size={18} /></button>
        {suggestionsA.length > 0 && <div className="address-suggestions" role="listbox" aria-label={text(locale, 'addressSuggestions')}>
          {suggestionsA.map((suggestion) => <button key={`${suggestion.coordinates?.join(',') ?? suggestion.label}-${suggestion.label}`} type="button" role="option" aria-selected="false" onClick={() => { acceptedA.current = suggestion.coordinates ? undefined : suggestion.label; setLabelA(suggestion.label); setCoordsA(suggestion.coordinates); setSuggestionsA([]) }}>
            <SuggestionIcon kind={suggestion.kind} />
            <span className="suggestion-text"><span>{suggestion.label}</span>{(suggestion.kind || suggestion.detail) && <small>{[suggestion.kind && placeKindLabel(locale, suggestion.kind), suggestion.detail].filter(Boolean).join(' · ')}</small>}</span>
          </button>)}
        </div>}
      </div>
      <div className="field directions-origin">
        <label className="field-label" htmlFor="halfway-b">
          <span className="halfway-field-dot is-halfway-b" aria-hidden="true" />
          {locale === 'fi' ? 'Lähtöpaikka B' : 'Starting point B'}
        </label>
        <input id="halfway-b" autoFocus={window.matchMedia('(pointer: fine)').matches && Boolean(labelA)} value={labelB} onChange={(event) => { acceptedB.current = undefined; setLabelB(event.target.value); setCoordsB(undefined); setError(undefined) }} placeholder={locale === 'fi' ? 'Esim. Lauttasaari tai osoite' : 'e.g. Lauttasaari or address'} autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="go" onKeyDown={(event) => { if (event.key === 'Enter') submit() }} />
        {suggestionsB.length > 0 && <div className="address-suggestions" role="listbox" aria-label={text(locale, 'addressSuggestions')}>
          {suggestionsB.map((suggestion) => <button key={`${suggestion.coordinates?.join(',') ?? suggestion.label}-${suggestion.label}`} type="button" role="option" aria-selected="false" onClick={() => { acceptedB.current = suggestion.coordinates ? undefined : suggestion.label; setLabelB(suggestion.label); setCoordsB(suggestion.coordinates); setSuggestionsB([]) }}>
            <SuggestionIcon kind={suggestion.kind} />
            <span className="suggestion-text"><span>{suggestion.label}</span>{(suggestion.kind || suggestion.detail) && <small>{[suggestion.kind && placeKindLabel(locale, suggestion.kind), suggestion.detail].filter(Boolean).join(' · ')}</small>}</span>
          </button>)}
        </div>}
      </div>
    </div>
    <div className="directions-actions">
      <button className="btn btn-primary" type="button" onClick={submit} disabled={submitting || !labelA.trim() || !labelB.trim()}>
        {submitting ? (locale === 'fi' ? 'Etsitään…' : 'Finding…') : (locale === 'fi' ? 'Etsi puolivälistä' : 'Find halfway')}
      </button>
      <button className="btn btn-ghost" type="button" onClick={onClose}>{locale === 'fi' ? 'Sulje' : 'Close'}</button>
    </div>
    {error && <p className="inline-status is-error" role="status">{error}</p>}
  </div>
}
