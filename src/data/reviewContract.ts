export type ReviewDecision = 'pending' | 'approved' | 'rejected' | 'skipped'

export type PriceOption = {
  label: string
  audience: string
  price: string
  sourceLine: string
}

export type ReviewCheck = {
  label: string
  detail: string
  status: 'pass' | 'review'
  weight: number
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

export type ReviewStaging = {
  schemaVersion: 1
  generatedAt: string
  city: string
  source: {
    provider: string
    url: string
    importedAt?: string
  }
  candidates: ReviewCandidate[]
}

export type ApprovedReviewRecord = {
  id: string
  venueName: string
  city: string
  prices: PriceOption[]
  provenance: {
    sourceLabel: string
    sourceUrl: string
    sourceUpdatedAt?: string
    sourceText: string
    extractor: string
  }
  review: {
    decision: 'approved'
    note?: string
    reviewedAt: string
  }
}
