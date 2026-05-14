import { buildAiInsight } from '@renderer/services/ai-insight-engine'
import { buildIndicatorSnapshot } from '@renderer/services/indicator-engine'
import { PATTERN_LABELS } from '@renderer/utils/constants'
import type { AiNotificationKind } from '@shared/types/ai-hub'
import type { InsightTone } from '@shared/types/home'
import type { IndicatorSnapshot } from '@shared/types/analysis'
import type { AssetQuote, AssetSnapshot } from '@shared/types/market'
import type { PatternSignal } from '@shared/types/patterns'

export interface AiAlertSignal {
  kind: AiNotificationKind
  title: string
  message: string
  tone: InsightTone
  dedupeKey: string
  createdAt: string
  assetId: string
  assetSymbol: string
  assetName: string
  assetClass: AssetSnapshot['profile']['class']
}

interface EvaluateAiAlertsInput {
  snapshot: AssetSnapshot
  previousQuote?: AssetQuote
  patterns: PatternSignal[]
}

const buildPreviousIndicators = (snapshot: AssetSnapshot): IndicatorSnapshot | null => {
  if (snapshot.candles.length < 40) {
    return null
  }

  try {
    return buildIndicatorSnapshot(snapshot.candles.slice(0, -1))
  } catch {
    return null
  }
}

const buildSignal = (
  snapshot: AssetSnapshot,
  kind: AiNotificationKind,
  tone: InsightTone,
  title: string,
  message: string,
  dedupeSuffix: string
): AiAlertSignal => ({
  kind,
  tone,
  title,
  message,
  dedupeKey: `ai:${snapshot.profile.id}:${dedupeSuffix}`,
  createdAt: new Date().toISOString(),
  assetId: snapshot.profile.id,
  assetSymbol: snapshot.profile.symbol,
  assetName: snapshot.profile.name,
  assetClass: snapshot.profile.class
})

export const evaluateAiAlerts = ({
  snapshot,
  previousQuote,
  patterns
}: EvaluateAiAlertsInput): AiAlertSignal[] => {
  const current = buildIndicatorSnapshot(snapshot.candles)
  const previous = buildPreviousIndicators(snapshot)
  const insight = buildAiInsight(snapshot, current, patterns)
  const latestCandle = snapshot.candles.at(-1)
  const averageVolume =
    snapshot.candles.slice(-12, -1).reduce((sum, candle) => sum + candle.volume, 0) /
    Math.max(1, snapshot.candles.slice(-12, -1).length)

  const signals: AiAlertSignal[] = []
  const distanceToResistance =
    snapshot.quote.price > 0
      ? ((current.resistance - snapshot.quote.price) / snapshot.quote.price) * 100
      : 999

  if (
    distanceToResistance <= 0.8 &&
    distanceToResistance >= -0.5 &&
    (previousQuote ? previousQuote.price < snapshot.quote.price : true)
  ) {
    signals.push(
      buildSignal(
        snapshot,
        'breakout',
        insight.tone === 'negative' ? 'neutral' : 'positive',
        `${snapshot.profile.symbol} direnç testi yapıyor`,
        `${snapshot.profile.symbol}, kısa vadeli dirence çok yakın. AI yorumu: ${insight.summary}`,
        'resistance-test'
      )
    )
  }

  if (current.rsi <= 30 && (!previous || previous.rsi > 30)) {
    signals.push(
      buildSignal(
        snapshot,
        'oversold',
        'positive',
        `${snapshot.profile.symbol} aşırı satım bölgesinde`,
        `${snapshot.profile.symbol} için RSI ${current.rsi.toFixed(1)} seviyesine geriledi. Tepki ihtimali arttı ancak trend teyidi hâlâ önemli.`,
        'rsi-oversold'
      )
    )
  }

  if (
    previous &&
    previous.macd.value <= previous.macd.signal &&
    current.macd.value > current.macd.signal
  ) {
    signals.push(
      buildSignal(
        snapshot,
        'macd',
        'positive',
        `${snapshot.profile.symbol} için MACD yukarı kesti`,
        `MACD kesişimi pozitif bölgeye döndü. Son hareket AI bakışına göre ${insight.summary.toLowerCase()}`,
        'macd-bullish-cross'
      )
    )
  }

  if (
    latestCandle &&
    averageVolume > 0 &&
    latestCandle.volume >= averageVolume * 1.35 &&
    Math.abs(snapshot.quote.changePercent) >= 1
  ) {
    signals.push(
      buildSignal(
        snapshot,
        'volume',
        snapshot.quote.changePercent >= 0 ? 'positive' : 'negative',
        `${snapshot.profile.symbol} tarafında hacim artışı`,
        `Son mum hacmi yakın ortalamanın belirgin üstünde. Hareketin kalıcılığı için kapanış teyidi izlenmeli.`,
        'volume-surge'
      )
    )
  }

  patterns
    .filter((pattern) => pattern.status === 'confirmed')
    .slice(0, 1)
    .forEach((pattern) => {
      signals.push(
        buildSignal(
          snapshot,
          'pattern',
          pattern.direction === 'bearish' ? 'negative' : 'positive',
          `${snapshot.profile.symbol} için ${PATTERN_LABELS[pattern.type]} teyidi`,
          `${PATTERN_LABELS[pattern.type]} formasyonu doğrulandı. AI özeti: ${insight.summary}`,
          `pattern:${pattern.type}`
        )
      )
    })

  return signals
}
