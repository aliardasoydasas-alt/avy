import type { InsightTone } from './home'
import type { AssetClass } from './market'

export type AiOpportunityKind = 'breakout' | 'oversold' | 'volume' | 'pattern'
export type AiNotificationKind = AiOpportunityKind | 'macd' | 'portfolio' | 'macro'

export interface AiAssetReference {
  assetId: string
  assetSymbol: string
  assetName: string
  assetClass: AssetClass
  price: number
  changePercent: number
  currency: string
}

export interface AiWatchlistItem extends AiAssetReference {
  badge: string
  tone: InsightTone
  confidence: number
  summary: string
  reasons: string[]
}

export interface AiOpportunityItem extends AiAssetReference {
  id: string
  kind: AiOpportunityKind
  title: string
  summary: string
  tone: InsightTone
  confidence: number
  metricLabel: string
  metricValue: string
}

export interface AiPortfolioReview {
  title: string
  tone: InsightTone
  summary: string
  detail: string[]
  risks: string[]
  totalValueTry: number
  dailyChangePercent: number
  totalProfitLossPercent?: number
  holdingCount: number
}

export interface AiMacroSummaryItem {
  id: string
  label: string
  value: string
  change: string
  source: string
  tone: InsightTone
  summary: string
}

export interface AiMacroSummary {
  title: string
  tone: InsightTone
  summary: string
  items: AiMacroSummaryItem[]
}

export interface AiNotificationHistoryItem {
  id: string
  createdAt: string
  title: string
  message: string
  tone: InsightTone
  kind: AiNotificationKind
  dedupeKey: string
  assetId?: string
  assetSymbol?: string
}
