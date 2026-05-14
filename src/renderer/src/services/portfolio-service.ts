import type { MarketOverviewItem } from '@shared/types/market'
import type { Holding, PortfolioRange, PortfolioSnapshot } from '@shared/types/portfolio'
import type { TryFxRates } from '@renderer/services/fx-rate-service'

export interface HoldingValuation {
  holding: Holding
  asset?: MarketOverviewItem
  price: number
  priceTry: number
  totalValueTry: number
  dailyChangeValueTry: number
  dailyChangePercent: number
  averageCostTry?: number
  profitLossValueTry?: number
  profitLossPercent?: number
  missingAsset: boolean
}

export interface PortfolioSummary {
  holdings: HoldingValuation[]
  totalValueTry: number
  totalDailyChangeValueTry: number
  totalDailyChangePercent: number
  totalCostBasisTry?: number
  totalProfitLossValueTry?: number
  totalProfitLossPercent?: number
}

const isDollarLinkedCurrency = (currency: string): boolean =>
  ['USD', 'USDT', 'USDC', 'FDUSD', 'TUSD'].includes(currency.toUpperCase())

export const convertToTry = (
  value: number,
  currency: string,
  fxRates: TryFxRates
): number => {
  const normalized = currency.toUpperCase()

  if (normalized === 'TRY') {
    return value
  }

  if (isDollarLinkedCurrency(normalized)) {
    return value * fxRates.usdTry
  }

  if (normalized === 'EUR') {
    return value * fxRates.eurTry
  }

  return value * fxRates.usdTry
}

const calculateDailyChangeValue = (
  totalValueTry: number,
  changePercent: number
): number => {
  const denominator = 100 + changePercent

  if (Math.abs(denominator) < 0.0001) {
    return 0
  }

  const previousValue = totalValueTry / (denominator / 100)
  return totalValueTry - previousValue
}

export const buildHoldingValuation = (
  holding: Holding,
  assetLookup: Map<string, MarketOverviewItem>,
  fxRates: TryFxRates
): HoldingValuation => {
  if (holding.assetType === 'cash') {
    const price = 1
    const priceTry = convertToTry(price, holding.assetCurrency, fxRates)
    const totalValueTry = convertToTry(holding.amount, holding.assetCurrency, fxRates)

    return {
      holding,
      price,
      priceTry,
      totalValueTry,
      dailyChangeValueTry: 0,
      dailyChangePercent: 0,
      missingAsset: false
    }
  }

  const asset = assetLookup.get(holding.assetId)
  const price = asset?.quote.price ?? 0
  const currency = asset?.profile.currency ?? holding.assetCurrency
  const priceTry = convertToTry(price, currency, fxRates)
  const totalValueTry = priceTry * holding.amount
  const dailyChangePercent = asset?.quote.changePercent ?? 0
  const dailyChangeValueTry = calculateDailyChangeValue(totalValueTry, dailyChangePercent)
  const averageCostTry =
    holding.averageCost !== undefined
      ? convertToTry(holding.averageCost, holding.assetCurrency, fxRates)
      : undefined
  const costBasisTry =
    averageCostTry !== undefined ? averageCostTry * holding.amount : undefined
  const profitLossValueTry =
    costBasisTry !== undefined ? totalValueTry - costBasisTry : undefined
  const profitLossPercent =
    profitLossValueTry !== undefined && costBasisTry && costBasisTry > 0
      ? (profitLossValueTry / costBasisTry) * 100
      : undefined

  return {
    holding,
    asset,
    price,
    priceTry,
    totalValueTry,
    dailyChangeValueTry,
    dailyChangePercent,
    averageCostTry,
    profitLossValueTry,
    profitLossPercent,
    missingAsset: !asset
  }
}

export const buildPortfolioSummary = (
  holdings: Holding[],
  assetLookup: Map<string, MarketOverviewItem>,
  fxRates: TryFxRates
): PortfolioSummary => {
  const valuations = holdings.map((holding) =>
    buildHoldingValuation(holding, assetLookup, fxRates)
  )

  const totalValueTry = valuations.reduce((sum, item) => sum + item.totalValueTry, 0)
  const totalDailyChangeValueTry = valuations.reduce(
    (sum, item) => sum + item.dailyChangeValueTry,
    0
  )
  const previousTotal = totalValueTry - totalDailyChangeValueTry
  const totalDailyChangePercent =
    previousTotal > 0 ? (totalDailyChangeValueTry / previousTotal) * 100 : 0
  const costBearingValuations = valuations.filter(
    (item) => item.averageCostTry !== undefined
  )
  const totalCostBasisTry = costBearingValuations.length
    ? costBearingValuations.reduce(
        (sum, item) => sum + (item.averageCostTry ?? 0) * item.holding.amount,
        0
      )
    : undefined
  const totalProfitLossValueTry =
    totalCostBasisTry !== undefined ? totalValueTry - totalCostBasisTry : undefined
  const totalProfitLossPercent =
    totalProfitLossValueTry !== undefined && totalCostBasisTry && totalCostBasisTry > 0
      ? (totalProfitLossValueTry / totalCostBasisTry) * 100
      : undefined

  return {
    holdings: valuations.sort((left, right) => right.totalValueTry - left.totalValueTry),
    totalValueTry,
    totalDailyChangeValueTry,
    totalDailyChangePercent,
    totalCostBasisTry,
    totalProfitLossValueTry,
    totalProfitLossPercent
  }
}

export const filterPortfolioSnapshots = (
  snapshots: PortfolioSnapshot[],
  range: PortfolioRange
): PortfolioSnapshot[] => {
  if (range === 'ALL') {
    return snapshots
  }

  const days = range === '7D' ? 7 : 30
  const threshold = Date.now() - days * 24 * 60 * 60 * 1000

  return snapshots.filter(
    (snapshot) => new Date(snapshot.capturedAt).getTime() >= threshold
  )
}
