import type { AssetSnapshot, MarketOverviewItem, Timeframe, AssetTick } from '@shared/types/market'
import type { NewsItem } from '@shared/types/news'

export interface MarketDataProvider {
  getOverview: () => Promise<MarketOverviewItem[]>
  searchAssets: (query: string) => Promise<MarketOverviewItem[]>
  getAssetDetail: (assetId: string, timeframe: Timeframe) => Promise<AssetSnapshot>
  getNews: (assetId: string) => Promise<NewsItem[]>
  subscribe: (
    assetIds: string[],
    onTick: (tick: AssetTick) => void
  ) => () => void
}
