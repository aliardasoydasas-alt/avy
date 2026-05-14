export type NewsImportance = 'high' | 'medium' | 'low'
export type NewsInsightTone = 'positive' | 'negative' | 'neutral'

export interface NewsAICommentary {
  tone: NewsInsightTone
  summary: string
  impact: string
}

export interface NewsItem {
  id: string
  assetId: string
  title: string
  source: string
  publishedAt: string
  summary: string
  details: string
  url: string
  importance: NewsImportance
  aiCommentary: NewsAICommentary
}
