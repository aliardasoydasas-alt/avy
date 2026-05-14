import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { MarketOverviewItem } from '@shared/types/market'
import type { PortfolioRange } from '@shared/types/portfolio'
import { getTryFxRates } from '@renderer/services/fx-rate-service'
import { buildPortfolioSummary, filterPortfolioSnapshots } from '@renderer/services/portfolio-service'
import { usePortfolioStore } from '@renderer/store/use-portfolio-store'

export const useTryFxRatesQuery = () =>
  useQuery({
    queryKey: ['try-fx-rates'],
    queryFn: getTryFxRates,
    staleTime: 1000 * 60 * 30,
    refetchInterval: 1000 * 60 * 30
  })

export const usePortfolioSummary = (
  overviewItems: MarketOverviewItem[],
  range: PortfolioRange
) => {
  const holdings = usePortfolioStore((state) => state.holdings)
  const snapshots = usePortfolioStore((state) => state.snapshots)
  const upsertDailySnapshot = usePortfolioStore((state) => state.upsertDailySnapshot)
  const fxQuery = useTryFxRatesQuery()
  const fxRates = fxQuery.data ?? {
    usdTry: 38,
    eurTry: 41.5,
    source: 'fallback' as const,
    updatedAt: new Date().toISOString()
  }

  const overviewMap = useMemo(
    () => new Map(overviewItems.map((item) => [item.assetId, item])),
    [overviewItems]
  )

  const summary = useMemo(
    () => buildPortfolioSummary(holdings, overviewMap, fxRates),
    [fxRates, holdings, overviewMap]
  )

  useEffect(() => {
    if (!holdings.length) {
      return
    }

    upsertDailySnapshot({
      capturedAt: new Date().toISOString(),
      totalValueTry: summary.totalValueTry,
      dailyChangeValueTry: summary.totalDailyChangeValueTry,
      dailyChangePercent: summary.totalDailyChangePercent
    })
  }, [
    holdings.length,
    summary.totalDailyChangePercent,
    summary.totalDailyChangeValueTry,
    summary.totalValueTry,
    upsertDailySnapshot
  ])

  const filteredSnapshots = useMemo(
    () => filterPortfolioSnapshots(snapshots, range),
    [range, snapshots]
  )

  return {
    summary,
    snapshots: filteredSnapshots,
    fxQuery
  }
}
