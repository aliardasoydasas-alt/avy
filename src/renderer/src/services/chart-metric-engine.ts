import type { CandlePoint } from '@shared/types/market'

export type ChartViewMode = 'main' | 'volume' | 'momentum' | 'volatility' | 'rsi' | 'macd'

export interface ChartMetricPoint {
  time: string
  value: number
}

const average = (values: number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1)

const calculateEmaHistory = (values: number[], period: number): number[] => {
  const multiplier = 2 / (period + 1)
  const history: number[] = []

  values.forEach((value, index) => {
    if (index === 0) {
      history.push(value)
      return
    }

    history.push((value - history[index - 1]) * multiplier + history[index - 1])
  })

  return history
}

const calculateRsiSeries = (closes: number[], period = 14): number[] =>
  closes.map((_, index) => {
    if (index < period) {
      return 50
    }

    let gains = 0
    let losses = 0
    for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
      const delta = closes[cursor] - closes[cursor - 1]
      if (delta >= 0) {
        gains += delta
      } else {
        losses += Math.abs(delta)
      }
    }

    if (!losses) {
      return 100
    }

    const rs = gains / losses
    return 100 - 100 / (1 + rs)
  })

export const buildChartMetricSeries = (
  candles: CandlePoint[],
  mode: Exclude<ChartViewMode, 'main'>
): ChartMetricPoint[] => {
  const closes = candles.map((candle) => candle.close)
  const ema12 = calculateEmaHistory(closes, 12)
  const ema26 = calculateEmaHistory(closes, 26)
  const macd = ema12.map((value, index) => value - (ema26[index] ?? value))
  const macdSignal = calculateEmaHistory(macd, 9)
  const rsi = calculateRsiSeries(closes)

  return candles.map((candle, index) => {
    const previousClose = closes[index - 1] ?? candle.open
    const recentRange = candles.slice(Math.max(0, index - 6), index + 1)
    const averageClose = average(recentRange.map((item) => item.close))

    const value =
      mode === 'volume'
        ? candle.volume
        : mode === 'momentum'
          ? previousClose > 0
            ? ((candle.close - previousClose) / previousClose) * 100
            : 0
          : mode === 'volatility'
            ? candle.close > 0
              ? ((candle.high - candle.low) / candle.close) * 100
              : 0
            : mode === 'rsi'
              ? rsi[index] ?? 50
              : mode === 'macd'
                ? (macd[index] ?? 0) - (macdSignal[index] ?? 0)
                : averageClose

    return {
      time: candle.time,
      value
    }
  })
}
