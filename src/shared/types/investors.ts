import type { AssetClass } from './market'

export type InvestorStyle =
  | 'value'
  | 'growth'
  | 'technology'
  | 'hedge-fund'
  | 'long-term'

export interface InvestorSourceMeta {
  label: string
  url: string
  updatedAt: string
  note: string
}

export interface InvestorHolding {
  id: string
  assetId?: string
  symbol: string
  name: string
  assetClass: AssetClass
  knownPosition?: string
  averageCost?: number
  averageCostCurrency?: string
  weightPercent?: number
  sourceNote?: string
}

export interface InvestorProfile {
  id: string
  name: string
  photoUrl?: string
  shortDescription: string
  investmentStyle: InvestorStyle
  firm: string
  trackedHoldingCount: number
  lastUpdated: string
  source: InvestorSourceMeta
  aiSummary: string
  holdings: InvestorHolding[]
}
