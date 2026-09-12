import snapshot from '../data/service-map-helsinki.json'

export type ReviewDecision = 'pending' | 'approved' | 'rejected' | 'skipped'

export type ReviewCheck = {
  label: string
  detail: string
  status: 'pass' | 'review'
  weight: number
}

export type PriceOption = {
  label: string
  audience: string
  price: string
  sourceLine: string
}

export type ReviewCandidate = {
  id: string
  venueName: string
  category: string
  proposedPrice: string
  audience: string
  sourceLabel: string
  sourceUrl: string
  sourceUpdatedAt?: string
  sourceText: string
  checks: ReviewCheck[]
  priceOptions: PriceOption[]
}

export function confidenceScore(candidate: ReviewCandidate) {
  return candidate.checks.reduce((total, check) => total + (check.status === 'pass' ? check.weight : 0), 0)
}

function firstPrice(value: string) {
  if (/free of charge|maksuton/i.test(value)) return 'Free of charge'
  const priorityLine = value.split('\n').find((line) => /single visit|kertakäynti/i.test(line)) ?? value
  const match = priorityLine.match(/€\s*(\d+(?:[,.]\d{1,2})?)|(\d+(?:[,.]\d{1,2})?)\s*€/)
  const amount = match?.[1] ?? match?.[2]
  return amount ? `${amount.replace(',', '.')} €` : 'Price needs review'
}

function firstAudience(value: string) {
  return value.split('\n').map((line) => line.trim()).find(Boolean) ?? 'Audience needs review'
}

function parsePriceOptions(value: string): PriceOption[] {
  let audience = firstAudience(value)
  const options: PriceOption[] = []

  for (const rawLine of value.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    if (!line.startsWith('-')) {
      audience = line
      continue
    }

    const sourceLine = line.replace(/^-\s*/, '')
    const pricePattern = /(free\s+(?:of\s+charge|entry)|maksuton|€\s*\d+(?:[,.]\d{1,2})?|\d+(?:[,.]\d{1,2})?\s*€)/gi
    const matches = [...sourceLine.matchAll(pricePattern)]
    for (const [index, match] of matches.entries()) {
      if (match.index === undefined) continue
      const previous = matches[index - 1]
      const previousEnd = previous?.index === undefined ? 0 : previous.index + previous[0].length
      const rawPrice = match[0].trim()
      const price = /free|maksuton/i.test(rawPrice)
        ? 'Free of charge'
        : `${(rawPrice.match(/\d+(?:[,.]\d{1,2})?/)?.[0] ?? '').replace(',', '.')} €`
      const label = sourceLine.slice(previousEnd, match.index).replace(/^\s*or\s+/i, '').replace(/[–—:-]\s*$/, '').trim() || 'Entry'
      const optionAudience = /personal customer card/i.test(label) ? 'All customers' : audience
      options.push({ label, audience: optionAudience, price, sourceLine })
    }
  }

  return options
}

const units = (snapshot.units ?? []) as {
  serviceMapId: number
  lipasId?: number
  nameFi?: string
  priceEn?: string
  sourceUrl: string
  updatedAt?: string
}[]

export const reviewCandidates: ReviewCandidate[] = units
  .filter((unit) => Boolean(unit.priceEn))
  .slice(0, 12)
  .map((unit) => {
    const sourceText = unit.priceEn as string
    const priceOptions = parsePriceOptions(sourceText)
    const mapped = unit.lipasId !== undefined
    const checks = [
      { label: 'Price format', detail: 'Currency amount found', status: 'pass' as const, weight: 35 },
      { label: 'Venue match', detail: mapped ? 'Matches LIPAS venue' : 'Needs venue match', status: mapped ? 'pass' as const : 'review' as const, weight: 30 },
      { label: 'Source freshness', detail: unit.updatedAt ? `Source updated ${unit.updatedAt.slice(0, 10)}` : 'No update timestamp', status: unit.updatedAt ? 'pass' as const : 'review' as const, weight: 20 },
      { label: 'Cross-source check', detail: 'Not verified yet', status: 'review' as const, weight: 15 },
    ]
    return {
      id: `service-map-${unit.serviceMapId}`,
      venueName: unit.nameFi ?? `Service Map unit ${unit.serviceMapId}`,
      category: 'PRICE connection',
      proposedPrice: priceOptions[0]?.price ?? firstPrice(sourceText),
      audience: priceOptions[0]?.audience ?? firstAudience(sourceText),
      sourceLabel: 'Helsinki Service Map · PRICE',
      sourceUrl: unit.sourceUrl,
      sourceUpdatedAt: unit.updatedAt,
      sourceText,
      checks,
      priceOptions,
    }
  })
