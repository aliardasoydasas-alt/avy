export type InsightTone = 'positive' | 'negative' | 'neutral'

export interface HomeNewsInsight {
  tone: InsightTone
  summary: string
  positiveCase: string
  negativeCase: string
}

export interface HomeNewsItem {
  id: string
  title: string
  source: string
  publishedAt: string
  summary: string
  url: string
  insight: HomeNewsInsight
}

export interface MarketPulseItem {
  id: string
  label: string
  value: string
  change: string
  source: string
  tone: InsightTone
  note?: string
}
