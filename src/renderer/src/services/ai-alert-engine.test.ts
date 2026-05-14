import { describe, expect, it } from 'vitest'
import { evaluateAiAlerts } from '@renderer/services/ai-alert-engine'
import type { AssetSnapshot, CandlePoint } from '@shared/types/market'

const buildCandles = (closes: number[], volumes?: number[]): CandlePoint[] =>
  closes.map((close, index) => {
    const previous = closes[Math.max(index - 1, 0)]
    const open = index === 0 ? close : previous

    return {
      time: new Date(Date.UTC(2024, 0, 1, index)).toISOString(),
      open,
      high: Math.max(open, close) + 1,
      low: Math.min(open, close) - 1,
      close,
      volume: volumes?.[index] ?? 1000 + index * 20
    }
  })

describe('ai-alert-engine', () => {
  it('emits RSI oversold and volume alerts for a stressed move', () => {
    const closes = [
      112, 111, 110, 109, 108, 107, 106, 105, 104, 103, 102, 101, 100, 99, 98, 97, 96,
      95, 94, 93, 92, 91, 90, 89, 88, 87, 86, 85, 84, 83, 82, 81, 80, 79, 78, 77, 76, 75
    ]
    const volumes = closes.map((_, index) => (index === closes.length - 1 ? 3500 : 900))
    const snapshot: AssetSnapshot = {
      profile: {
        id: 'binance:TESTUSDT',
        symbol: 'TEST',
        name: 'Test Coin',
        class: 'crypto',
        exchange: 'Binance',
        currency: 'USDT',
        description: '',
        tags: []
      },
      quote: {
        price: 75,
        changePercent: -2.8,
        volume: 120000,
        high24h: 112,
        low24h: 75,
        updatedAt: '2026-04-24T12:00:00.000Z'
      },
      candles: buildCandles(closes, volumes),
      overview: '',
      metrics: {
        volatility: 3,
        sentimentScore: 42
      }
    }

    const signals = evaluateAiAlerts({ snapshot, patterns: [] })

    expect(signals.some((signal) => signal.kind === 'oversold')).toBe(true)
    expect(signals.some((signal) => signal.kind === 'volume')).toBe(true)
  })
})
