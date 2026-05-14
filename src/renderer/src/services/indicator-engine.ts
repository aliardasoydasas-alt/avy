import type { IndicatorSnapshot } from '@shared/types/analysis'
import type { CandlePoint } from '@shared/types/market'

const average = (values: number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1)

const standardDeviation = (values: number[]): number => {
  const mean = average(values)
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(values.length, 1)

  return Math.sqrt(variance)
}

const calculateEMA = (values: number[], period: number): number => {
  const multiplier = 2 / (period + 1)
  return values.reduce((ema, value, index) => {
    if (index === 0) {
      return value
    }

    return (value - ema) * multiplier + ema
  }, values[0] ?? 0)
}

const calculateEMAHistory = (values: number[], period: number): number[] => {
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

const calculateRSI = (values: number[], period = 14): number => {
  if (values.length <= period) {
    return 50
  }

  let gains = 0
  let losses = 0

  for (let index = values.length - period; index < values.length; index += 1) {
    const delta = values[index] - values[index - 1]
    if (delta >= 0) {
      gains += delta
    } else {
      losses += Math.abs(delta)
    }
  }

  if (losses === 0) {
    return 100
  }

  const relativeStrength = gains / losses
  return 100 - 100 / (1 + relativeStrength)
}

export const buildIndicatorSnapshot = (candles: CandlePoint[]): IndicatorSnapshot => {
  const closes = candles.map((candle) => candle.close)
  const highs = candles.map((candle) => candle.high)
  const lows = candles.map((candle) => candle.low)
  const volumes = candles.map((candle) => candle.volume)
  const lastClose = closes[closes.length - 1] ?? 0

  const ema20 = calculateEMA(closes.slice(-20), 20)
  const sma50 = average(closes.slice(-50))
  const rsi = calculateRSI(closes, 14)

  const ema12History = calculateEMAHistory(closes, 12)
  const ema26History = calculateEMAHistory(closes, 26)
  const macdSeries = ema12History.map((value, index) => value - (ema26History[index] ?? value))
  const signalSeries = calculateEMAHistory(macdSeries, 9)
  const macdValue = macdSeries[macdSeries.length - 1] ?? 0
  const macdSignal = signalSeries[signalSeries.length - 1] ?? 0

  const bollingerWindow = closes.slice(-20)
  const bollingerMiddle = average(bollingerWindow)
  const bollingerDeviation = standardDeviation(bollingerWindow)
  const support = Math.min(...lows.slice(-20))
  const resistance = Math.max(...highs.slice(-20))

  const recentVolume = average(volumes.slice(-5))
  const priorVolume = average(volumes.slice(-10, -5))
  const volumeTrend =
    recentVolume > priorVolume * 1.1
      ? 'rising'
      : recentVolume < priorVolume * 0.9
        ? 'falling'
        : 'balanced'

  const trend =
    lastClose > ema20 && ema20 > sma50
      ? 'bullish'
      : lastClose < ema20 && ema20 < sma50
        ? 'bearish'
        : 'sideways'

  const recommendation =
    trend === 'bullish' && rsi < 70 && macdValue > macdSignal
      ? 'buy'
      : trend === 'bearish' && rsi > 30 && macdValue < macdSignal
        ? 'sell'
        : 'neutral'

  const summaryMap = {
    buy: 'Genel teknik gorunum olumlu, ancak risk yonetimi korunmali.',
    sell: 'Momentum zayifliyor; asagi yonlu devam riski dikkatle izlenmeli.',
    neutral: 'Sinyaller karisik. Net yon yerine izleme modu daha uygun gorunuyor.'
  } as const

  return {
    rsi,
    macd: {
      value: macdValue,
      signal: macdSignal,
      histogram: macdValue - macdSignal
    },
    ema20,
    sma50,
    bollinger: {
      upper: bollingerMiddle + bollingerDeviation * 2,
      middle: bollingerMiddle,
      lower: bollingerMiddle - bollingerDeviation * 2
    },
    support,
    resistance,
    volumeTrend,
    trend,
    recommendation,
    summary: summaryMap[recommendation]
  }
}
