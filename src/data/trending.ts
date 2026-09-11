import type { SportFeature } from './types'

export type TrendingStage = 'new' | 'rising' | 'popular'

export type TrendingSignal = {
  interestScore: number
  recentChange: number
  stage: TrendingStage
}

export type TrendingProvider = (feature: SportFeature) => TrendingSignal

function stageForSignal(signal: Pick<TrendingSignal, 'interestScore' | 'recentChange'>): TrendingStage {
  if (signal.recentChange >= 24 && signal.interestScore < 78) return 'new'
  if (signal.recentChange >= 12) return 'rising'
  return 'popular'
}

export function previewTrendingSignal(feature: SportFeature): TrendingSignal {
  const seed = [...feature.id].reduce((total, character) => total + character.charCodeAt(0), 0)
  const interestScore = 46 + (seed % 55)
  const recentChange = 6 + ((seed * 7) % 31)
  return { interestScore, recentChange, stage: stageForSignal({ interestScore, recentChange }) }
}

