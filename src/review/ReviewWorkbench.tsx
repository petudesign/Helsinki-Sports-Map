import { useEffect, useMemo, useState } from 'react'
import { confidenceScore, reviewCandidates, type PriceOption, type ReviewCandidate, type ReviewDecision } from './reviewData'

type StoredReview = { decision: ReviewDecision; editedPrice?: string; note?: string; acceptedPrices?: PriceOption[] }
type StoredReviews = Record<string, StoredReview>

const storageKey = 'hsm-local-review-decisions-v1'

function readReviews(): StoredReviews {
  try {
    const value = window.localStorage.getItem(storageKey)
    return value ? JSON.parse(value) as StoredReviews : {}
  } catch {
    return {}
  }
}

function formatSourceDate(value: string | undefined) {
  if (!value) return 'Not available'
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value))
}

function decisionLabel(decision: ReviewDecision | undefined) {
  return decision === 'approved' ? 'Approved' : decision === 'rejected' ? 'Rejected' : decision === 'skipped' ? 'Skipped' : 'Pending'
}

function checkSummary(candidate: ReviewCandidate) {
  const passed = candidate.checks.filter((check) => check.status === 'pass').length
  return `${passed}/${candidate.checks.length} checks`
}

function checkPoints(check: ReviewCandidate['checks'][number]) {
  return check.status === 'pass' ? `+${check.weight}` : '+0'
}

function acceptedPriceOptions(candidate: ReviewCandidate, primaryPrice: string) {
  return candidate.priceOptions.map((option, index) => index === 0
    ? { ...option, price: primaryPrice.trim() || option.price }
    : option)
}

function ReviewQueueItem({ candidate, review, selected, onSelect }: { candidate: ReviewCandidate; review?: StoredReview; selected: boolean; onSelect: () => void }) {
  const primaryOption = candidate.priceOptions[0]
  const priceLabel = review?.editedPrice ?? primaryOption?.price ?? candidate.proposedPrice
  return <button type="button" className={`review-queue-item ${selected ? 'selected' : ''}`} onClick={onSelect}>
    <span className="review-queue-index">{candidate.id.split('-').pop()}</span>
    <span className="review-queue-copy"><strong>{candidate.venueName}</strong><small>{primaryOption?.audience ?? candidate.audience} · {priceLabel}{candidate.priceOptions.length > 1 ? ` · +${candidate.priceOptions.length - 1} more` : ''}</small></span>
    <span className={`review-confidence review-confidence-${review?.decision ?? 'pending'}`}>{review?.decision ? decisionLabel(review.decision) : `${confidenceScore(candidate)}%`}</span>
  </button>
}

export function ReviewWorkbench() {
  const [reviews, setReviews] = useState<StoredReviews>(() => readReviews())
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [editing, setEditing] = useState(false)
  const [editedPrice, setEditedPrice] = useState('')
  const [note, setNote] = useState('')

  const current = reviewCandidates[selectedIndex]
  const currentReview = current ? reviews[current.id] : undefined
  const displayedPriceOptions = current?.priceOptions.map((option, index) => index === 0
    ? { ...option, price: editing ? editedPrice : currentReview?.editedPrice ?? option.price }
    : option) ?? []
  const pendingCount = useMemo(() => reviewCandidates.filter((candidate) => !reviews[candidate.id] || reviews[candidate.id].decision === 'pending').length, [reviews])
  const reviewedCount = reviewCandidates.length - pendingCount

  useEffect(() => {
    document.title = 'HSM · Review queue'
    return () => { document.title = 'Helsinki Sports Map' }
  }, [])

  useEffect(() => {
    if (!current) return
    setEditedPrice(currentReview?.editedPrice ?? current.proposedPrice)
    setNote(currentReview?.note ?? '')
    setEditing(false)
  }, [current, currentReview?.editedPrice, currentReview?.note])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      const key = event.key.toLowerCase()
      if (key === 'a') decide('approved')
      if (key === 'r') decide('rejected')
      if (key === 's') decide('skipped')
      if (key === 'e') setEditing(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  function persist(next: StoredReviews) {
    setReviews(next)
    window.localStorage.setItem(storageKey, JSON.stringify(next))
  }

  function nextPendingIndex(from: number) {
    for (let offset = 1; offset <= reviewCandidates.length; offset += 1) {
      const index = (from + offset) % reviewCandidates.length
      if (!reviews[reviewCandidates[index].id] || reviews[reviewCandidates[index].id].decision === 'pending') return index
    }
    return (from + 1) % reviewCandidates.length
  }

  function decide(decision: Exclude<ReviewDecision, 'pending'>) {
    if (!current) return
    persist({ ...reviews, [current.id]: { decision, editedPrice, note, ...(decision === 'approved' ? { acceptedPrices: acceptedPriceOptions(current, editedPrice) } : {}) } })
    setEditing(false)
    setSelectedIndex(nextPendingIndex(selectedIndex))
  }

  function saveEdit() {
    if (!current) return
    const nextPrice = editedPrice.trim() || current.proposedPrice
    persist({ ...reviews, [current.id]: { decision: 'approved', editedPrice: nextPrice, note, acceptedPrices: acceptedPriceOptions(current, nextPrice) } })
    setEditing(false)
    setSelectedIndex(nextPendingIndex(selectedIndex))
  }

  if (!current) return null

  return <main className="review-shell">
    <header className="review-topbar">
      <div className="review-brand"><span className="review-mark">HSM</span><div><h1>Review queue</h1><p>Validate extracted sports venue facts before they reach the map.</p></div></div>
      <div className="review-top-actions"><span className="review-local-status"><span className="status-dot" /> Local only · nothing is published</span><a href={window.location.pathname}>Back to map</a></div>
    </header>

    <div className="review-layout">
      <aside className="review-sidebar" aria-label="Review queue">
        <div className="review-sidebar-heading"><div><strong>{reviewedCount} of {reviewCandidates.length}</strong><span>reviewed</span></div><span>{pendingCount} pending</span></div>
        <div className="review-progress"><span style={{ width: `${reviewCandidates.length ? reviewedCount / reviewCandidates.length * 100 : 0}%` }} /></div>
        <div className="review-queue-list">{reviewCandidates.map((candidate, index) => <ReviewQueueItem key={candidate.id} candidate={candidate} review={reviews[candidate.id]} selected={index === selectedIndex} onSelect={() => setSelectedIndex(index)} />)}</div>
      </aside>

      <section className="review-main" aria-live="polite">
        <div className="review-navigation"><button type="button" onClick={() => setSelectedIndex((selectedIndex - 1 + reviewCandidates.length) % reviewCandidates.length)}>← Previous</button><span>{selectedIndex + 1} of {reviewCandidates.length}</span><button type="button" onClick={() => setSelectedIndex((selectedIndex + 1) % reviewCandidates.length)}>Next →</button></div>
        <div className="review-heading"><div><h2>{current.venueName}</h2><p>Helsinki · {current.category}</p></div><span className="review-check-summary"><strong>{confidenceScore(current)}%</strong><small>evidence score</small><span>{checkSummary(current)} verified</span></span></div>

        <div className="review-facts"><div><span>Primary price</span><strong>{displayedPriceOptions[0]?.price ?? current.proposedPrice}</strong><small>{displayedPriceOptions[0]?.label ?? 'Needs review'} · {displayedPriceOptions[0]?.audience ?? current.audience}</small></div><div><span>Audience</span><strong>{current.audience}</strong></div><div><span>Source</span><strong>{current.sourceLabel}</strong><small>{formatSourceDate(current.sourceUpdatedAt)}</small></div></div>

        <section className="review-price-summary" aria-labelledby="price-options-title"><div className="review-section-heading"><h3 id="price-options-title">Price options to approve</h3><span>{current.priceOptions.length} detected</span></div>{current.priceOptions.length > 0 ? <div className="review-price-list">{displayedPriceOptions.map((option) => <div className="review-price-row" key={`${option.audience}-${option.label}`}><div><strong>{option.label}</strong><small>{option.audience}</small></div><strong>{option.price}</strong></div>)}</div> : <p className="review-price-empty">No structured price options found yet.</p>}<p className="review-price-note">Accept approves all detected price options together. Edit changes the primary option only.</p></section>

        <div className="review-actions" aria-label="Review decision">
          {!editing && <><button type="button" className="review-action primary" onClick={() => decide('approved')}>✓ Accept <kbd>A</kbd></button><button type="button" className="review-action" onClick={() => setEditing(true)}>✎ Edit <kbd>E</kbd></button><button type="button" className="review-action" onClick={() => decide('rejected')}>× Reject <kbd>R</kbd></button><button type="button" className="review-action" onClick={() => decide('skipped')}>→ Skip <kbd>S</kbd></button></>}
          {editing && <form className="review-edit-form" onSubmit={(event) => { event.preventDefault(); saveEdit() }}><label>Corrected price<input value={editedPrice} onChange={(event) => setEditedPrice(event.target.value)} autoFocus /></label><label>Note<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Why was this changed?" rows={2} /></label><div><button type="submit" className="review-action primary">Save & approve</button><button type="button" className="review-action" onClick={() => setEditing(false)}>Cancel</button></div></form>}
        </div>

        <div className="review-evidence"><div className="review-section-heading"><h3>Source evidence</h3><a href={current.sourceUrl} target="_blank" rel="noreferrer">Open source ↗</a></div><div className="review-source-card"><span className="review-source-label">{current.sourceLabel}</span><pre>{current.sourceText}</pre></div></div>
        <div className="review-extracted"><div className="review-section-heading"><h3>Extracted text</h3><span>read-only preview</span></div><p>{current.sourceText.split('\n').filter(Boolean).slice(0, 4).join(' · ')}</p></div>
      </section>

      <aside className="review-context">
        <section className="review-panel"><h3>Provenance</h3><dl><div><dt>Source</dt><dd>{current.sourceLabel}</dd></div><div><dt>Updated</dt><dd>{formatSourceDate(current.sourceUpdatedAt)}</dd></div><div><dt>Record ID</dt><dd>{current.id}</dd></div><div><dt>Extractor</dt><dd>service-map-v1</dd></div></dl></section>
        <section className="review-panel"><h3>Why {confidenceScore(current)}%?</h3><div className="review-score-explainer"><strong>{confidenceScore(current)} / 100</strong><div className="review-score-bar" role="progressbar" aria-label={`${confidenceScore(current)} percent evidence score`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={confidenceScore(current)}><span style={{ width: `${confidenceScore(current)}%` }} /></div><p>Rule-based evidence score, not a probability. Verified checks add their points; unresolved checks add 0.</p></div><ul className="review-checks">{current.checks.map((check) => <li key={check.label} className={check.status}><span className={`review-check-points review-check-points-${check.status}`}>{checkPoints(check)}</span><div><strong>{check.label}</strong><small>{check.detail} · {check.status === 'pass' ? `${check.weight} points added` : `${check.weight} points held back`}</small></div></li>)}</ul></section>
        <section className="review-panel review-safety-note"><h3>Safety boundary</h3><p>This prototype only changes local review state. It cannot write to the public dataset, trigger syncs, or access secrets.</p></section>
      </aside>
    </div>
  </main>
}
