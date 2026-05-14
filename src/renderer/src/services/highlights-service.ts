import type { MarketOverviewItem } from '@shared/types/market'
import { isMarketClosedForProfile } from '@renderer/utils/market-hours'

export const buildTopMovers = (
  overviewItems: MarketOverviewItem[],
  limit = 20
): MarketOverviewItem[] =>
  [...overviewItems]
    .filter((item) => !(item.profile.class === 'stock' && isMarketClosedForProfile(item.profile)))
    .sort((left, right) => {
      if (right.quote.changePercent !== left.quote.changePercent) {
        return right.quote.changePercent - left.quote.changePercent
      }

      return right.quote.volume - left.quote.volume
    })
    .slice(0, limit)

export const buildTopDecliners = (
  overviewItems: MarketOverviewItem[],
  limit = 20
): MarketOverviewItem[] =>
  [...overviewItems]
    .filter((item) => !(item.profile.class === 'stock' && isMarketClosedForProfile(item.profile)))
    .sort((left, right) => {
      if (left.quote.changePercent !== right.quote.changePercent) {
        return left.quote.changePercent - right.quote.changePercent
      }

      return right.quote.volume - left.quote.volume
    })
    .slice(0, limit)

export const getStrongestMoverByClass = (
  overviewItems: MarketOverviewItem[],
  targetClass: MarketOverviewItem['profile']['class']
): MarketOverviewItem | undefined =>
  buildTopMovers(overviewItems.filter((item) => item.profile.class === targetClass), 1)[0]
