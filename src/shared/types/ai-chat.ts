import type { IndicatorSnapshot } from '@shared/types/analysis'
import type { AssetSnapshot } from '@shared/types/market'
import type { NewsItem } from '@shared/types/news'
import type { PatternSignal } from '@shared/types/patterns'

export interface AssetAiInsightContext {
  title: string
  tone: 'positive' | 'negative' | 'neutral'
  confidence: number
  summary: string
  rationale: string[]
  risks: string[]
  horizon: string
  disclaimer: string
}

export interface AssetAiChatTurn {
  role: 'user' | 'assistant'
  text: string
}

export interface AssetAiChatRequest {
  question: string
  conversation: AssetAiChatTurn[]
  snapshot: AssetSnapshot
  indicators: IndicatorSnapshot
  patterns: PatternSignal[]
  insight: AssetAiInsightContext
  news: NewsItem[]
}

export interface AssetAiChatResponse {
  text: string
  model: string
  source: 'openai' | 'fallback'
}
