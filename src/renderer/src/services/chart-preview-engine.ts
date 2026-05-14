import type { IndicatorSnapshot } from '@shared/types/analysis'
import type { AssetSnapshot, CandlePoint, Timeframe } from '@shared/types/market'
import type { NewsItem } from '@shared/types/news'
import type { PatternSignal } from '@shared/types/patterns'

export interface AiPreviewScenario {
  candles: CandlePoint[]
  summary: string
}

type ScenarioMode = 'bull-breakout' | 'bull-grind' | 'bear-breakdown' | 'bear-drift' | 'range'

const addHours = (value: string, hours: number): string => {
  const next = new Date(value)
  next.setHours(next.getHours() + hours)
  return next.toISOString()
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

const average = (values: number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1)

const getNewsBias = (news: NewsItem[]): number => {
  if (!news.length) {
    return 0
  }

  return news.slice(0, 5).reduce((score, item) => {
    if (item.aiCommentary.tone === 'positive') {
      return score + 0.3
    }

    if (item.aiCommentary.tone === 'negative') {
      return score - 0.3
    }

    return score
  }, 0)
}

const getAverageRangePercent = (candles: CandlePoint[]): number =>
  average(
    candles.map((candle) => {
      if (!candle.close) {
        return 0
      }

      return (candle.high - candle.low) / candle.close
    })
  )

const buildTargetPath = (
  mode: ScenarioMode,
  lastClose: number,
  support: number,
  resistance: number,
  stepSize: number
): number[] => {
  const breakoutLevel = resistance * 1.004
  const breakdownLevel = support * 0.996
  const midpoint = (support + resistance) / 2

  if (mode === 'bull-breakout') {
    return [
      Math.max(lastClose, resistance * 0.998),
      breakoutLevel,
      breakoutLevel * 1.005,
      Math.max(resistance, breakoutLevel * 0.994),
      breakoutLevel * 1.012,
      breakoutLevel * 1.02
    ]
  }

  if (mode === 'bull-grind') {
    return [
      lastClose * (1 + stepSize * 0.5),
      Math.min(resistance * 0.996, lastClose * (1 + stepSize * 0.9)),
      Math.min(resistance * 1.002, lastClose * (1 + stepSize * 1.2)),
      Math.max(midpoint, resistance * 0.992),
      resistance * 1.003,
      resistance * 1.01
    ]
  }

  if (mode === 'bear-breakdown') {
    return [
      Math.min(lastClose, support * 1.002),
      breakdownLevel,
      breakdownLevel * 0.994,
      Math.min(support, breakdownLevel * 1.005),
      breakdownLevel * 0.988,
      breakdownLevel * 0.98
    ]
  }

  if (mode === 'bear-drift') {
    return [
      lastClose * (1 - stepSize * 0.45),
      Math.max(support * 1.004, lastClose * (1 - stepSize * 0.85)),
      Math.max(support * 0.998, lastClose * (1 - stepSize * 1.1)),
      Math.min(midpoint, support * 1.012),
      support * 0.997,
      support * 0.99
    ]
  }

  return [
    clamp(lastClose * (1 + stepSize * 0.25), support * 1.01, resistance * 0.995),
    clamp(midpoint, support * 1.005, resistance * 0.995),
    clamp(lastClose * (1 - stepSize * 0.2), support * 1.004, resistance * 0.992),
    clamp(midpoint * 1.001, support * 1.01, resistance * 0.995),
    clamp(resistance * 0.992, support * 1.01, resistance * 0.998),
    clamp(midpoint * 1.002, support * 1.012, resistance * 0.996)
  ]
}

const buildScenarioMode = ({
  lastClose,
  support,
  resistance,
  momentumBias,
  volumeRatio,
  bullishPatterns,
  bearishPatterns
}: {
  lastClose: number
  support: number
  resistance: number
  momentumBias: number
  volumeRatio: number
  bullishPatterns: PatternSignal[]
  bearishPatterns: PatternSignal[]
}): ScenarioMode => {
  const distanceToResistance = resistance > 0 ? ((resistance - lastClose) / lastClose) * 100 : 999
  const distanceToSupport = support > 0 ? ((lastClose - support) / lastClose) * 100 : 999
  const bullishBias = momentumBias + bullishPatterns.length * 0.8 - bearishPatterns.length * 0.4
  const bearishBias = -momentumBias + bearishPatterns.length * 0.8 - bullishPatterns.length * 0.4

  if (bullishBias > 1.4 && volumeRatio >= 1.1 && distanceToResistance <= 1.6) {
    return 'bull-breakout'
  }

  if (bullishBias > 0.45) {
    return 'bull-grind'
  }

  if (bearishBias > 1.4 && volumeRatio >= 1.05 && distanceToSupport <= 1.6) {
    return 'bear-breakdown'
  }

  if (bearishBias > 0.45) {
    return 'bear-drift'
  }

  return 'range'
}

export const buildAiPreviewScenario = ({
  snapshot,
  timeframe,
  indicators,
  patterns,
  news
}: {
  snapshot: AssetSnapshot
  timeframe: Timeframe
  indicators: IndicatorSnapshot
  patterns: PatternSignal[]
  news: NewsItem[]
}): AiPreviewScenario => {
  const sourceCandles = snapshot.candles.slice(-32)
  const last = sourceCandles.at(-1)

  if (!last) {
    return {
      candles: [],
      summary: 'Önizleme için yeterli mum verisi bulunamadı.'
    }
  }

  const recentVolumes = sourceCandles.slice(-8).map((candle) => candle.volume)
  const averageRangePercent = Math.max(getAverageRangePercent(sourceCandles), 0.005)
  const previousClose = sourceCandles.at(-6)?.close ?? sourceCandles[0].close
  const closeSlope = previousClose > 0 ? (last.close - previousClose) / previousClose : 0
  const volumeRatio = average(recentVolumes.slice(0, -1)) > 0 ? last.volume / average(recentVolumes.slice(0, -1)) : 1
  const newsBias = getNewsBias(news)
  const bullishPatterns = patterns.filter((pattern) => pattern.status === 'confirmed' && pattern.direction === 'bullish')
  const bearishPatterns = patterns.filter((pattern) => pattern.status === 'confirmed' && pattern.direction === 'bearish')

  const momentumBias =
    closeSlope * 8 +
    (indicators.trend === 'bullish' ? 0.9 : indicators.trend === 'bearish' ? -0.9 : 0) +
    (indicators.macd.histogram > 0 ? 0.55 : -0.55) +
    (indicators.rsi < 36 ? 0.4 : indicators.rsi > 66 ? -0.4 : 0) +
    (indicators.volumeTrend === 'rising' ? 0.25 : indicators.volumeTrend === 'falling' ? -0.2 : 0) +
    newsBias

  const scenarioMode = buildScenarioMode({
    lastClose: last.close,
    support: indicators.support,
    resistance: indicators.resistance,
    momentumBias,
    volumeRatio,
    bullishPatterns,
    bearishPatterns
  })

  const intervalHours =
    timeframe === '1s'
      ? 1 / 3600
      : timeframe === '1m'
      ? 1 / 60
      : timeframe === '5m'
        ? 5 / 60
        : timeframe === '15m'
          ? 15 / 60
          : timeframe === '4H'
            ? 4
            : timeframe === '1D'
              ? 24
              : timeframe === '1W'
                ? 24 * 7
                : timeframe === '1M'
                  ? 24 * 30
                  : 1
  const stepSize = Math.max(averageRangePercent * 0.55, Math.abs(closeSlope) / 4, 0.0045)
  const targetPath = buildTargetPath(scenarioMode, last.close, indicators.support, indicators.resistance, stepSize)

  const scenarioCandles: CandlePoint[] = []
  let previousTime = last.time
  let previousValue = last.close

  targetPath.forEach((targetClose, index) => {
    const open = previousValue
    const close = clamp(
      targetClose,
      Math.min(indicators.support * 0.96, open * 0.94),
      Math.max(indicators.resistance * 1.05, open * 1.06)
    )
    const localPulse = Math.sin((index + 1) * 0.9) * averageRangePercent * 0.25
    const rangePercent = averageRangePercent * (scenarioMode === 'range' ? 0.9 : 1.05 + Math.abs(localPulse))
    const high = Math.max(open, close) * (1 + rangePercent * 0.34)
    const low = Math.min(open, close) * (1 - rangePercent * 0.31)
    const volumeBase =
      scenarioMode === 'bull-breakout' || scenarioMode === 'bear-breakdown'
        ? 1.18
        : scenarioMode === 'range'
          ? 0.96
          : 1.05

    const nextCandle: CandlePoint = {
      time: addHours(previousTime, intervalHours),
      open,
      high,
      low,
      close,
      volume: Math.max(last.volume * (volumeBase + index * 0.035), last.volume * 0.72)
    }

    scenarioCandles.push(nextCandle)
    previousValue = close
    previousTime = nextCandle.time
  })

  const scenarioLead =
    scenarioMode === 'bull-breakout'
      ? 'AI, önümüzdeki 24 saat için yukarı kırılım odaklı bir senaryo üretti.'
      : scenarioMode === 'bull-grind'
        ? 'AI, kontrollü yükselişin devam edebileceği bir senaryo üretti.'
        : scenarioMode === 'bear-breakdown'
          ? 'AI, destek kırılımı sonrası zayıflığın sürebileceği bir senaryo üretti.'
          : scenarioMode === 'bear-drift'
            ? 'AI, zayıf tepki denemeleri içeren aşağı eğilimli bir senaryo üretti.'
            : 'AI, yönün netleşmediği bant içi bir senaryo üretti.'

  const reasoningBits = [
    volumeRatio >= 1.08 ? 'hacim ortalamanın üzerinde' : 'hacim dengeli',
    indicators.macd.histogram >= 0 ? 'MACD ivmesi pozitif' : 'MACD ivmesi zayıf',
    indicators.rsi <= 35
      ? 'RSI aşırı satıma yakın'
      : indicators.rsi >= 65
        ? 'RSI aşırı alıma yakın'
        : 'RSI orta bölgede',
    bullishPatterns.length
      ? `boğa teyidi: ${bullishPatterns[0].label}`
      : bearishPatterns.length
        ? `ayı teyidi: ${bearishPatterns[0].label}`
        : 'belirgin teyit formasyonu yok'
  ]

  return {
    candles: scenarioCandles,
    summary: `${scenarioLead} Bu önizleme ${reasoningBits.join(', ')} verileriyle oluşturuldu. Takip edilmesi gereken ana bant ${indicators.support.toFixed(2)} - ${indicators.resistance.toFixed(2)} çevresidir; bu alan gerçek veri değil, olası senaryo gösterimidir.`
  }
}
