import type { AssetClass } from './market'

export type HoldingAssetType = 'crypto' | 'stock' | 'cash'
export type HoldingAssetClass = AssetClass | 'cash'
export type PortfolioRange = '7D' | '30D' | 'ALL'

export interface HoldingSaleTarget {
  id: string
  targetPrice: number
  amount: number
  createdAt: string
  updatedAt: string
}

export interface Holding {
  id: string
  assetId: string
  assetType: HoldingAssetType
  assetClass: HoldingAssetClass
  assetName: string
  assetSymbol: string
  assetCurrency: string
  amount: number
  averageCost?: number
  saleTargets?: HoldingSaleTarget[]
  createdAt: string
  updatedAt: string
}

export interface PortfolioSnapshot {
  id: string
  capturedAt: string
  totalValueTry: number
  dailyChangeValueTry: number
  dailyChangePercent: number
}
