import { describe, expect, it } from 'vitest'
import {
  buildAiMacroSummary,
  buildAiPortfolioReview,
  selectAiCandidateAssetIds
} from '@renderer/services/ai-hub-service'
import type { PortfolioSummary } from '@renderer/services/portfolio-service'
import type { MarketPulseItem } from '@shared/types/home'
import type { MarketOverviewItem } from '@shared/types/market'

describe('ai-hub-service', () => {
  it('prioritizes favorites and recent assets when selecting AI candidates', () => {
    const overviewItems: MarketOverviewItem[] = [
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
          price: 76000,
          changePercent: 2.4,
          volume: 150000,
          high24h: 77000,
          low24h: 74200,
          updatedAt: '2026-04-24T08:00:00.000Z'
        }
      },
      {
        assetId: 'binance:SOLUSDT',
        profile: {
          id: 'binance:SOLUSDT',
          symbol: 'SOL',
          name: 'Solana',
          class: 'crypto',
          exchange: 'Binance',
          currency: 'USDT',
          description: '',
          tags: []
        },
        quote: {
          price: 180,
          changePercent: 6.1,
          volume: 240000,
          high24h: 182,
          low24h: 170,
          updatedAt: '2026-04-24T08:00:00.000Z'
        }
      }
    ]

    const ids = selectAiCandidateAssetIds(overviewItems, ['binance:BTCUSDT'], ['binance:SOLUSDT'], 4)

    expect(ids[0]).toBe('binance:BTCUSDT')
    expect(ids[1]).toBe('binance:SOLUSDT')
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('builds a readable macro summary tone', () => {
    const pulseItems: MarketPulseItem[] = [
      {
        id: 'btc',
        label: 'Bitcoin',
        value: '$76,000',
        change: '+2.10%',
        source: 'Binance',
        tone: 'positive'
      },
      {
        id: 'spx',
        label: 'S&P 500',
        value: '$540',
        change: '-0.40%',
        source: 'Midas',
        tone: 'negative'
      }
    ]

    const summary = buildAiMacroSummary(pulseItems)

    expect(summary.items).toHaveLength(2)
    expect(summary.summary.length).toBeGreaterThan(20)
  })

  it('builds a portfolio review for active holdings', () => {
    const summary: PortfolioSummary = {
      holdings: [
        {
          holding: {
            id: 'holding-btc',
            assetId: 'binance:BTCUSDT',
            assetType: 'crypto',
            assetClass: 'crypto',
            assetName: 'Bitcoin',
            assetSymbol: 'BTC',
            assetCurrency: 'USDT',
            amount: 0.4,
            createdAt: '2026-04-20T08:00:00.000Z',
            updatedAt: '2026-04-20T08:00:00.000Z'
          },
          price: 76000,
          priceTry: 2888000,
          totalValueTry: 1155200,
          dailyChangeValueTry: 15200,
          dailyChangePercent: 1.4,
          averageCostTry: 2600000,
          profitLossValueTry: 115200,
          profitLossPercent: 11.1,
          missingAsset: false
        }
      ],
      totalValueTry: 1155200,
      totalDailyChangeValueTry: 15200,
      totalDailyChangePercent: 1.4,
      totalCostBasisTry: 1040000,
      totalProfitLossValueTry: 115200,
      totalProfitLossPercent: 11.1
    }

    const review = buildAiPortfolioReview({ summary })

    expect(review.holdingCount).toBe(1)
    expect(review.summary.length).toBeGreaterThan(20)
  })
})
