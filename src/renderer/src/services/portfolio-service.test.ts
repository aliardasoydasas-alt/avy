import { describe, expect, it } from 'vitest'
import { buildPortfolioSummary, filterPortfolioSnapshots } from '@renderer/services/portfolio-service'
import type { MarketOverviewItem } from '@shared/types/market'
import type { Holding, PortfolioSnapshot } from '@shared/types/portfolio'

const mockHoldings: Holding[] = [
  {
    id: 'holding-btc',
    assetId: 'binance:BTCUSDT',
    assetType: 'crypto',
    assetClass: 'crypto',
    assetName: 'Bitcoin',
    assetSymbol: 'BTC',
    assetCurrency: 'USDT',
    amount: 0.5,
    averageCost: 70000,
    createdAt: '2026-04-20T08:00:00.000Z',
    updatedAt: '2026-04-20T08:00:00.000Z'
  },
  {
    id: 'holding-asels',
    assetId: 'midas-bist:ASELS',
    assetType: 'stock',
    assetClass: 'stock',
    assetName: 'Aselsan',
    assetSymbol: 'ASELS',
    assetCurrency: 'TRY',
    amount: 25,
    averageCost: 112,
    createdAt: '2026-04-20T08:00:00.000Z',
    updatedAt: '2026-04-20T08:00:00.000Z'
  }
]

const mockOverview = new Map<string, MarketOverviewItem>([
  [
    'binance:BTCUSDT',
    {
      assetId: 'binance:BTCUSDT',
      profile: {
        id: 'binance:BTCUSDT',
        symbol: 'BTC',
        name: 'Bitcoin',
        class: 'crypto',
        exchange: 'Binance',
        currency: 'USDT',
        description: '',
        tags: []
      },
      quote: {
        price: 75671.17,
        changePercent: 2.5,
        volume: 10,
        high24h: 77000,
        low24h: 74000,
        updatedAt: '2026-04-20T08:00:00.000Z'
      }
    }
  ],
  [
    'midas-bist:ASELS',
    {
      assetId: 'midas-bist:ASELS',
      profile: {
        id: 'midas-bist:ASELS',
        symbol: 'ASELS',
        name: 'Aselsan',
        class: 'stock',
        exchange: 'BIST',
        currency: 'TRY',
        description: '',
        tags: []
      },
      quote: {
        price: 118.2,
        changePercent: -1.2,
        volume: 12,
        high24h: 121.4,
        low24h: 117.5,
        updatedAt: '2026-04-20T08:00:00.000Z'
      }
    }
  ]
])

describe('portfolio-service', () => {
  it('builds a combined portfolio summary in TRY', () => {
    const summary = buildPortfolioSummary(mockHoldings, mockOverview, {
      usdTry: 38,
      eurTry: 41.5,
      source: 'test',
      updatedAt: '2026-04-20T08:00:00.000Z'
    })

    expect(summary.holdings).toHaveLength(2)
    expect(summary.totalValueTry).toBeGreaterThan(1_400_000)
    expect(summary.totalDailyChangePercent).not.toBeNaN()
    expect(summary.totalProfitLossValueTry).toBeGreaterThan(0)
  })

  it('filters snapshot history by range', () => {
    const snapshots: PortfolioSnapshot[] = [
      {
        id: 'old',
        capturedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
        totalValueTry: 1000,
        dailyChangeValueTry: 10,
        dailyChangePercent: 1
      },
      {
        id: 'recent',
        capturedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        totalValueTry: 1200,
        dailyChangeValueTry: 15,
        dailyChangePercent: 1.2
      }
    ]

    expect(filterPortfolioSnapshots(snapshots, '7D')).toHaveLength(1)
    expect(filterPortfolioSnapshots(snapshots, '30D')).toHaveLength(1)
    expect(filterPortfolioSnapshots(snapshots, 'ALL')).toHaveLength(2)
  })
})
