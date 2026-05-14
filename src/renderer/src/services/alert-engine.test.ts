import type { AlertRule } from '@shared/types/alerts'
import type { AssetSnapshot, CandlePoint } from '@shared/types/market'
import type { PatternSignal } from '@shared/types/patterns'
import { evaluateAlerts } from './alert-engine'

const candle = (price: number, hour: number): CandlePoint => ({
  time: new Date(Date.UTC(2024, 0, 1, hour)).toISOString(),
  open: price - 1,
  high: price + 1,
  low: price - 2,
  close: price,
  volume: 5000
})

describe('alert-engine', () => {
  it('triggers price and pattern alerts when conditions are met', () => {
    const snapshot: AssetSnapshot = {
      profile: {
        id: 'btc-usd',
        symbol: 'BTCUSD',
        name: 'Bitcoin',
        class: 'crypto',
        exchange: 'Binance',
        currency: 'USD',
        description: 'Bitcoin',
        tags: ['Layer1']
      },
      quote: {
        price: 70000,
        changePercent: 4.2,
        volume: 9000000,
        high24h: 70250,
        low24h: 68000,
        updatedAt: new Date().toISOString()
      },
      candles: [candle(68000, 0), candle(69000, 1), candle(70000, 2)],
      overview: 'Mock snapshot',
      metrics: {
        volatility: 4.2,
        sentimentScore: 74
      }
    }

    const alerts: AlertRule[] = [
      {
        id: 'alert-price',
        assetId: 'btc-usd',
        label: 'Breakout',
        type: 'price_above',
        threshold: 69500,
        enabled: true,
        createdAt: new Date().toISOString(),
        cooldownMinutes: 30
      },
      {
        id: 'alert-pattern',
        assetId: 'btc-usd',
        label: 'Pattern',
        type: 'pattern',
        patternType: 'bull_flag',
        enabled: true,
        createdAt: new Date().toISOString(),
        cooldownMinutes: 30
      }
    ]

    const patterns: PatternSignal[] = [
      {
        id: 'pattern-1',
        type: 'bull_flag',
        label: 'Flag',
        description: 'Bull flag confirmed',
        confidence: 0.88,
        direction: 'bullish',
        status: 'confirmed',
        startIndex: 0,
        endIndex: 2,
        breakoutLevel: 69500
      }
    ]

    const triggers = evaluateAlerts(alerts, { snapshot, patterns })

    expect(triggers).toHaveLength(2)
  })
})
