export type AssetClass = 'crypto' | 'stock' | 'index' | 'commodity'
export type Timeframe = '1s' | '1m' | '5m' | '15m' | '1H' | '4H' | '1D' | '1W' | '1M'
export type AssetProvider = 'binance' | 'midas' | 'mock'
export type MarketLatency = 'realtime' | 'delayed' | 'derived'

export interface AssetProfile {
  id: string
  symbol: string
  name: string
  class: AssetClass
  exchange: string
  currency: string
  description: string
  tags: string[]
  provider?: AssetProvider
  market?: string
  detailUrl?: string
  sourceUrl?: string
}

export interface AssetQuote {
  price: number
  changePercent: number
  volume: number
  high24h: number
  low24h: number
  updatedAt: string
  openPrice?: number
  latency?: MarketLatency
}

export interface CandlePoint {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface AssetMetrics {
  marketCap?: number
  volatility: number
  sentimentScore: number
}

export interface AssetSnapshot {
  profile: AssetProfile
  quote: AssetQuote
  candles: CandlePoint[]
  overview: string
  metrics: AssetMetrics
  syntheticHistory?: boolean
}

export interface MarketOverviewItem {
  assetId: string
  profile: AssetProfile
  quote: AssetQuote
}

export interface WatchlistDefinition {
  id: string
  name: string
  assetIds: string[]
}

export interface AssetTick {
  assetId: string
  quote: AssetQuote
}
