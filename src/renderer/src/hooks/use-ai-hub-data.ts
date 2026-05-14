import { useEffect, useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import type { MarketPulseItem } from '@shared/types/home'
import type { MarketOverviewItem } from '@shared/types/market'
import type { PortfolioSummary } from '@renderer/services/portfolio-service'
import {
  analyzeAssetSnapshot,
  buildAiMacroSummary,
  buildAiNotificationHistorySeed,
  buildAiOpportunityItems,
  buildAiPortfolioReview,
  buildAiWatchlistItems,
  selectAiCandidateAssetIds
} from '@renderer/services/ai-hub-service'
import { marketProvider } from '@renderer/services/providers/provider-registry'
import { useAiHubStore } from '@renderer/store/use-ai-hub-store'

interface UseAiHubDataOptions {
  overviewItems: MarketOverviewItem[]
  favoriteAssetIds: string[]
  recentAssetIds: string[]
  portfolioSummary: PortfolioSummary
  macroPulseItems: MarketPulseItem[]
  enabled?: boolean
}

export const useAiHubData = ({
  overviewItems,
  favoriteAssetIds,
  recentAssetIds,
  portfolioSummary,
  macroPulseItems,
  enabled = true
}: UseAiHubDataOptions) => {
  const history = useAiHubStore((state) => state.history)
  const recordHistory = useAiHubStore((state) => state.recordHistory)

  const candidateAssetIds = useMemo(
    () => selectAiCandidateAssetIds(overviewItems, favoriteAssetIds, recentAssetIds),
    [favoriteAssetIds, overviewItems, recentAssetIds]
  )

  const detailQueries = useQueries({
    queries: candidateAssetIds.map((assetId) => ({
      queryKey: ['ai-hub-detail', assetId],
      queryFn: () => marketProvider.getAssetDetail(assetId, '1H'),
      enabled: enabled && Boolean(assetId),
      staleTime: 1000 * 60,
      retry: 1
    }))
  })

  const analyses = useMemo(
    () =>
      detailQueries.flatMap((query) => {
        if (!query.data) {
          return []
        }

        try {
          return [analyzeAssetSnapshot(query.data)]
        } catch (error) {
          console.error('AVY AI hub analysis failed', error)
          return []
        }
      }),
    [detailQueries]
  )

  const watchlist = useMemo(() => buildAiWatchlistItems(analyses), [analyses])
  const opportunities = useMemo(() => buildAiOpportunityItems(analyses), [analyses])
  const portfolioReview = useMemo(
    () => buildAiPortfolioReview({ summary: portfolioSummary }),
    [portfolioSummary]
  )
  const macroSummary = useMemo(
    () => buildAiMacroSummary(macroPulseItems),
    [macroPulseItems]
  )
  const historySeed = useMemo(
    () =>
      buildAiNotificationHistorySeed(
        watchlist,
        opportunities,
        portfolioReview,
        macroSummary
      ),
    [macroSummary, opportunities, portfolioReview, watchlist]
  )

  useEffect(() => {
    if (!enabled) {
      return
    }

    recordHistory(historySeed)
  }, [enabled, historySeed, recordHistory])

  const isLoading =
    enabled &&
    ((candidateAssetIds.length > 0 && detailQueries.some((query) => query.isLoading) && !analyses.length) ||
      (!overviewItems.length && !portfolioSummary.holdings.length))

  const hasError =
    enabled &&
    detailQueries.some((query) => query.isError) &&
    !watchlist.length &&
    !opportunities.length

  return {
    watchlist,
    opportunities,
    portfolioReview,
    macroSummary,
    history,
    isLoading,
    hasError
  }
}
