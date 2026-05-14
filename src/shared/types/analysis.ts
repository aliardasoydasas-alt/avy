export type Recommendation = 'buy' | 'sell' | 'neutral'
export type VolumeTrend = 'rising' | 'falling' | 'balanced'
export type TrendDirection = 'bullish' | 'bearish' | 'sideways'

export interface IndicatorToggleState {
  rsi: boolean
  macd: boolean
  movingAverages: boolean
  bollinger: boolean
  volume: boolean
  supportResistance: boolean
}

export interface IndicatorSnapshot {
  rsi: number
  macd: {
    value: number
    signal: number
    histogram: number
  }
  ema20: number
  sma50: number
  bollinger: {
    upper: number
    middle: number
    lower: number
  }
  support: number
  resistance: number
  volumeTrend: VolumeTrend
  trend: TrendDirection
  recommendation: Recommendation
  summary: string
}
