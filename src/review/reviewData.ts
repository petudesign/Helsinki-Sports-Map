import staging from '../data/review-staging.json'
import type { ReviewCandidate, ReviewStaging } from '../data/reviewContract'

export type { ApprovedReviewRecord, PriceOption, ReviewCandidate, ReviewCheck, ReviewDecision, ReviewStaging } from '../data/reviewContract'

const reviewStaging = staging as ReviewStaging

export const reviewCandidates: ReviewCandidate[] = reviewStaging.candidates

export function confidenceScore(candidate: ReviewCandidate) {
  return candidate.checks.reduce((total, check) => total + (check.status === 'pass' ? check.weight : 0), 0)
}
