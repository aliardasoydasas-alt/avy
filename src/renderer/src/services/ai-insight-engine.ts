import type { IndicatorSnapshot } from '@shared/types/analysis'
import type { AssetSnapshot } from '@shared/types/market'
import type { PatternSignal } from '@shared/types/patterns'
import { PATTERN_LABELS } from '@renderer/utils/constants'
import { formatCurrency } from '@renderer/utils/format'

export interface AiInsight {
  title: string
  tone: 'positive' | 'negative' | 'neutral'
  confidence: number
  summary: string
  rationale: string[]
  risks: string[]
  horizon: string
  disclaimer: string
}

export const buildAiInsight = (
  snapshot: AssetSnapshot,
  indicators: IndicatorSnapshot,
  patterns: PatternSignal[]
): AiInsight => {
  const bullishPatterns = patterns.filter(
    (pattern) => pattern.status === 'confirmed' && pattern.direction === 'bullish'
  )
  const bearishPatterns = patterns.filter(
    (pattern) => pattern.status === 'confirmed' && pattern.direction === 'bearish'
  )

  let score = 0

  if (indicators.recommendation === 'buy') {
    score += 2
  } else if (indicators.recommendation === 'sell') {
    score -= 2
  }

  if (indicators.trend === 'bullish') {
    score += 2
  } else if (indicators.trend === 'bearish') {
    score -= 2
  }

  if (indicators.rsi > 68) {
    score -= 1
  } else if (indicators.rsi < 34) {
    score += 1
  }

  score += bullishPatterns.length
  score -= bearishPatterns.length

  const biasScore =
    score +
    (indicators.macd.histogram > 0 ? 0.75 : -0.75) +
    (indicators.rsi >= 50 ? 0.35 : -0.35) +
    (snapshot.quote.changePercent >= 0 ? 0.2 : -0.2)
  const tone = biasScore >= 0 ? 'positive' : 'negative'
  const title =
    biasScore >= 3
      ? 'Al görünümü baskın'
      : biasScore >= 0
        ? 'Alış hafif daha baskın'
        : biasScore <= -3
          ? 'Sat görünümü baskın'
          : 'Satış hafif daha baskın'

  const confidenceBase = 52 + Math.min(28, Math.abs(score) * 8)
  const confidence = Math.max(52, Math.min(88, confidenceBase))

  const summary =
    tone === 'positive'
      ? `${snapshot.profile.symbol} için teknik görünüm şu an yukarı yöne daha yakın. Momentum ve trend verileri, kısa vadede alıcıların daha avantajlı olabileceğini gösteriyor.`
      : `${snapshot.profile.symbol} tarafında zayıflama sinyalleri öne çıkıyor. Kısa vadede destek seviyeleri ve satış baskısı daha dikkatli takip edilmeli.`

  const rationale = [
    `Trend özeti: ${indicators.trend === 'bullish' ? 'yükseliş' : indicators.trend === 'bearish' ? 'düşüş' : 'denge arayışı'}.`,
    `RSI ${indicators.rsi.toFixed(1)} ve MACD histogram ${indicators.macd.histogram.toFixed(3)} seviyesinde.`,
    bullishPatterns.length || bearishPatterns.length
      ? `Doğrulanmış formasyonlar: ${[...bullishPatterns, ...bearishPatterns]
          .map((pattern) => PATTERN_LABELS[pattern.type])
          .join(', ')}.`
      : 'Şu anda doğrulanmış güçlü bir formasyon öne çıkmıyor.'
  ]

  const risks = [
    `Destek ${formatCurrency(indicators.support, snapshot.profile.currency)} altına inilirse görünüm bozulabilir.`,
    `Direnç ${formatCurrency(indicators.resistance, snapshot.profile.currency)} kırılamazsa hareket yatay kalabilir.`,
    snapshot.syntheticHistory
      ? 'Bu varlıkta grafik verisinin bir kısmı public veri noktaları veya türetilmiş mumlardan oluşuyor; yorumu ek teyitle kullan.'
      : 'Anlık veri akışı değiştikçe bu yorum hızla güncellenebilir.'
  ]

  return {
    title,
    tone,
    confidence,
    summary,
    rationale,
    risks,
    horizon: 'Kısa vade teknik yorum',
    disclaimer: 'Bu panel deneysel bir analiz özetidir; yatırım tavsiyesi değildir.'
  }
}
