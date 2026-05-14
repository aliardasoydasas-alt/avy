import { buildAiInsight } from '@renderer/services/ai-insight-engine'
import { buildIndicatorSnapshot } from '@renderer/services/indicator-engine'
import type { PortfolioSummary } from '@renderer/services/portfolio-service'
import { detectAllPatterns } from '@renderer/services/pattern-detector'
import { PATTERN_LABELS } from '@renderer/utils/constants'
import { formatCurrency, formatPercent } from '@renderer/utils/format'
import type {
  AiMacroSummary,
  AiMacroSummaryItem,
  AiNotificationHistoryItem,
  AiOpportunityItem,
  AiPortfolioReview,
  AiWatchlistItem
} from '@shared/types/ai-hub'
import type { IndicatorSnapshot } from '@shared/types/analysis'
import type { InsightTone, MarketPulseItem } from '@shared/types/home'
import type { AssetSnapshot, MarketOverviewItem } from '@shared/types/market'
import type { PatternSignal, PatternType } from '@shared/types/patterns'

const normalizeConfidence = (value: number): number =>
  Math.max(55, Math.min(92, Math.round(value)))

const shortText = (value: string, limit = 150): string =>
  value.length <= limit ? value : `${value.slice(0, limit - 3).trimEnd()}...`

const unique = <Value>(values: Value[]): Value[] => [...new Set(values)]

const classLabels: Record<string, string> = {
  crypto: 'kripto',
  stock: 'hisse',
  index: 'endeks',
  commodity: 'emtia'
}

const AI_PATTERN_TYPES: PatternType[] = [
  'inverse_head_shoulders',
  'head_shoulders',
  'cup_handle',
  'bull_flag',
  'bear_flag',
  'ascending_triangle',
  'descending_triangle',
  'rising_wedge',
  'falling_wedge'
]

const STABLE_SYMBOLS = new Set([
  'USDT',
  'USDC',
  'FDUSD',
  'TUSD',
  'BUSD',
  'DAI',
  'USDE',
  'PYUSD',
  'PAXG',
  'USDP'
])

const STABLE_NAME_MARKERS = [
  'tether',
  'usd coin',
  'first digital usd',
  'trueusd',
  'stablecoin',
  'stable coin',
  'dai',
  'paypal usd',
  'pax dollar',
  'usde'
]

const LEVERAGED_TOKEN_MARKERS = ['UP', 'DOWN', 'BULL', 'BEAR', '3L', '3S', '5L', '5S']

const isStableAsset = (
  assetClass: string,
  symbol: string,
  name: string,
  price?: number,
  changePercent?: number
): boolean => {
  if (assetClass !== 'crypto') {
    return false
  }

  const normalizedSymbol = symbol.trim().toUpperCase()
  const normalizedName = name.trim().toLowerCase()
  const containsStableMarker = [...STABLE_SYMBOLS].some(
    (stableSymbol) =>
      normalizedSymbol === stableSymbol ||
      normalizedSymbol.startsWith(stableSymbol) ||
      normalizedSymbol.endsWith(stableSymbol)
  )
  const looksLeveraged = LEVERAGED_TOKEN_MARKERS.some(
    (marker) =>
      normalizedSymbol.endsWith(marker) ||
      normalizedSymbol.startsWith(`${marker}-`) ||
      normalizedName.includes(` leveraged ${marker.toLowerCase()}`)
  )
  const looksPegged =
    typeof price === 'number' &&
    typeof changePercent === 'number' &&
    price >= 0.97 &&
    price <= 1.03 &&
    Math.abs(changePercent) <= 1.25

  return (
    STABLE_SYMBOLS.has(normalizedSymbol) ||
    containsStableMarker ||
    STABLE_NAME_MARKERS.some((marker) => normalizedName.includes(marker)) ||
    looksPegged ||
    looksLeveraged
  )
}

export interface AiAssetAnalysis {
  snapshot: AssetSnapshot
  indicators: IndicatorSnapshot
  patterns: PatternSignal[]
  insight: ReturnType<typeof buildAiInsight>
  score: number
  breakoutDistancePercent: number
}

export interface AiPortfolioReviewInput {
  summary: PortfolioSummary
}

const buildAnalysisScore = (
  snapshot: AssetSnapshot,
  indicators: IndicatorSnapshot,
  patterns: PatternSignal[],
  insight: ReturnType<typeof buildAiInsight>,
  breakoutDistancePercent: number
): number => {
  const confirmedPatterns = patterns.filter((pattern) => pattern.status === 'confirmed')
  const bullishPatterns = confirmedPatterns.filter((pattern) => pattern.direction === 'bullish')
  const bearishPatterns = confirmedPatterns.filter((pattern) => pattern.direction === 'bearish')
  const oversoldScore = indicators.rsi < 34 ? 2.5 : 0
  const breakoutScore =
    breakoutDistancePercent <= 1.5 && breakoutDistancePercent >= -1 ? 2.2 : 0
  const volumeScore = indicators.volumeTrend === 'rising' ? 1.6 : 0
  const toneScore =
    insight.tone === 'positive' ? 2 : insight.tone === 'negative' ? 1.1 : 0.8

  return (
    Math.abs(snapshot.quote.changePercent) * 1.25 +
    bullishPatterns.length * 2.4 +
    bearishPatterns.length * 1.8 +
    confirmedPatterns.length * 1.3 +
    oversoldScore +
    breakoutScore +
    volumeScore +
    toneScore
  )
}

export const analyzeAssetSnapshot = (snapshot: AssetSnapshot): AiAssetAnalysis => {
  const indicators = buildIndicatorSnapshot(snapshot.candles)
  const patterns = detectAllPatterns(snapshot.candles, AI_PATTERN_TYPES)
  const insight = buildAiInsight(snapshot, indicators, patterns)
  const breakoutDistancePercent =
    snapshot.quote.price > 0
      ? ((indicators.resistance - snapshot.quote.price) / snapshot.quote.price) * 100
      : 999

  return {
    snapshot,
    indicators,
    patterns,
    insight,
    breakoutDistancePercent,
    score: buildAnalysisScore(snapshot, indicators, patterns, insight, breakoutDistancePercent)
  }
}

export const selectAiCandidateAssetIds = (
  overviewItems: MarketOverviewItem[],
  favorites: string[],
  recentAssetIds: string[],
  limit = 6
): string[] => {
  const qualifiedItems = overviewItems.filter(
    (item) =>
      !isStableAsset(
        item.profile.class,
        item.profile.symbol,
        item.profile.name,
        item.quote.price,
        item.quote.changePercent
      ) &&
      (item.profile.class !== 'crypto' || item.quote.volume >= 500_000)
  )

  const movers = [...qualifiedItems]
    .sort((left, right) => {
      const rightScore =
        Math.abs(right.quote.changePercent) * 2.1 +
        Math.log10(right.quote.volume + 10) +
        (Math.abs(right.quote.changePercent) >= 2 ? 1.4 : 0)
      const leftScore =
        Math.abs(left.quote.changePercent) * 2.1 +
        Math.log10(left.quote.volume + 10) +
        (Math.abs(left.quote.changePercent) >= 2 ? 1.4 : 0)

      return rightScore - leftScore
    })
    .map((item) => item.assetId)

  const curatedSeed = [...favorites, ...recentAssetIds]
    .map((assetId) => overviewItems.find((item) => item.assetId === assetId))
    .filter((item): item is MarketOverviewItem => Boolean(item))
    .filter((item) =>
      !isStableAsset(
        item.profile.class,
        item.profile.symbol,
        item.profile.name,
        item.quote.price,
        item.quote.changePercent
      )
    )
    .map((item) => item.assetId)

  return unique([...curatedSeed, ...movers]).slice(0, limit)
}

const buildWatchlistSummary = (
  analysis: AiAssetAnalysis
): { badge: string; reasons: string[]; summary: string } => {
  const bullishPattern = analysis.patterns.find(
    (pattern) => pattern.status === 'confirmed' && pattern.direction === 'bullish'
  )
  const bearishPattern = analysis.patterns.find(
    (pattern) => pattern.status === 'confirmed' && pattern.direction === 'bearish'
  )
  const isOversold = analysis.indicators.rsi < 34
  const isNearBreakout =
    analysis.breakoutDistancePercent <= 1.5 && analysis.breakoutDistancePercent >= -1
  const hasVolumeExpansion =
    analysis.indicators.volumeTrend === 'rising' &&
    Math.abs(analysis.snapshot.quote.changePercent) >= 1

  const reasons = [
    `Trend ${
      analysis.indicators.trend === 'bullish'
        ? 'yukarı'
        : analysis.indicators.trend === 'bearish'
          ? 'aşağı'
          : 'yatay'
    }.`,
    `RSI ${analysis.indicators.rsi.toFixed(1)} seviyesinde.`,
    hasVolumeExpansion ? 'Hacim eşliğinde hareket var.' : 'Hacim tarafı dengeli.'
  ]

  if (bullishPattern) {
    reasons.unshift(`${PATTERN_LABELS[bullishPattern.type]} teyidi alındı.`)
    return {
      badge: 'Formasyon teyidi',
      reasons,
      summary: shortText(
        `${analysis.snapshot.profile.symbol} tarafında ${PATTERN_LABELS[bullishPattern.type]} teyidi ve momentum desteği birlikte çalışıyor. Kırılımın devam edip etmediği bugün izlenmeli.`
      )
    }
  }

  if (isNearBreakout && analysis.insight.tone !== 'negative') {
    return {
      badge: 'Direnç testi',
      reasons,
      summary: shortText(
        `${analysis.snapshot.profile.symbol}, kısa vadeli direncine çok yakın. Hacim korunursa gün içinde yukarı kırılım denemesi izlenebilir.`
      )
    }
  }

  if (isOversold) {
    return {
      badge: 'Aşırı satım',
      reasons,
      summary: shortText(
        `${analysis.snapshot.profile.symbol} aşırı satım bölgesine yakın. Zayıf görünüm sürse de tepki ihtimali nedeniyle radarda tutulmalı.`
      )
    }
  }

  if (bearishPattern || analysis.insight.tone === 'negative') {
    return {
      badge: 'Riskli ama önemli',
      reasons,
      summary: shortText(
        `${analysis.snapshot.profile.symbol} zayıf bir teknik yapıda. Yön aşağı baskılı olsa da yeni kırılım ya da sert tepki için bugün dikkatle izlenebilir.`
      )
    }
  }

  return {
    badge: hasVolumeExpansion ? 'Hacim artışı' : 'İzlenebilir',
    reasons,
    summary: shortText(analysis.insight.summary)
  }
}

const buildEnhancedWatchlistSummary = (
  analysis: AiAssetAnalysis
): { badge: string; reasons: string[]; summary: string } => {
  const bullishPattern = analysis.patterns.find(
    (pattern) => pattern.status === 'confirmed' && pattern.direction === 'bullish'
  )
  const bearishPattern = analysis.patterns.find(
    (pattern) => pattern.status === 'confirmed' && pattern.direction === 'bearish'
  )
  const priceMove = Math.abs(analysis.snapshot.quote.changePercent)
  const nearBreakout =
    analysis.breakoutDistancePercent <= 1.2 && analysis.breakoutDistancePercent >= -0.4
  const oversold = analysis.indicators.rsi <= 33.5
  const volumeImpulse =
    analysis.indicators.volumeTrend === 'rising' &&
    priceMove >= 1.25 &&
    analysis.snapshot.quote.volume >= 750_000

  const reasons = [
    `Trend ${
      analysis.indicators.trend === 'bullish'
        ? 'yukarı'
        : analysis.indicators.trend === 'bearish'
          ? 'aşağı'
          : 'yatay'
    } eğilimde.`,
    `RSI ${analysis.indicators.rsi.toFixed(1)} seviyesinde.`,
    volumeImpulse ? 'Hareket hacim desteği alıyor.' : 'Hacim desteği sınırlı.'
  ]

  if (bullishPattern) {
    reasons.unshift(`${PATTERN_LABELS[bullishPattern.type]} teyidi alındı.`)
    return {
      badge: 'Formasyon teyidi',
      reasons,
      summary: shortText(
        `${analysis.snapshot.profile.symbol} için ${PATTERN_LABELS[bullishPattern.type]} teyidi geldi. Fiyat yapısı ve hacim aynı yönde kaldığı sürece hareketin devamı izlenebilir.`
      )
    }
  }

  if (nearBreakout && analysis.insight.tone !== 'negative') {
    return {
      badge: 'Direnç testi',
      reasons,
      summary: shortText(
        `${analysis.snapshot.profile.symbol} kısa vadeli direncine çok yakın. Kırılımın kalıcı olabilmesi için hacim tarafının zayıflamaması önemli.`
      )
    }
  }

  if (oversold) {
    return {
      badge: 'Aşırı satım',
      reasons,
      summary: shortText(
        `${analysis.snapshot.profile.symbol} aşırı satım bölgesine yaklaştı. Tepki potansiyeli var ancak teyit gelmeden agresif okumak doğru olmaz.`
      )
    }
  }

  if (bearishPattern || analysis.insight.tone === 'negative') {
    return {
      badge: 'Riskli ama önemli',
      reasons,
      summary: shortText(
        `${analysis.snapshot.profile.symbol} tarafında baskı sürüyor. Zayıflık devam ederse aşağı yönlü yeni fiyat keşfi, aksi halde sert tepki alanı oluşabilir.`
      )
    }
  }

  return {
    badge: volumeImpulse ? 'Hacim artışı' : 'İzlenebilir',
    reasons,
    summary: shortText(analysis.insight.summary)
  }
}

export const buildAiWatchlistItems = (analyses: AiAssetAnalysis[]): AiWatchlistItem[] =>
  analyses
    .filter(
      (analysis) =>
        !isStableAsset(
          analysis.snapshot.profile.class,
          analysis.snapshot.profile.symbol,
          analysis.snapshot.profile.name,
          analysis.snapshot.quote.price,
          analysis.snapshot.quote.changePercent
        )
    )
    .map((analysis) => {
      const watchSummary = buildEnhancedWatchlistSummary(analysis)

      return {
        assetId: analysis.snapshot.profile.id,
        assetSymbol: analysis.snapshot.profile.symbol,
        assetName: analysis.snapshot.profile.name,
        assetClass: analysis.snapshot.profile.class,
        price: analysis.snapshot.quote.price,
        changePercent: analysis.snapshot.quote.changePercent,
        currency: analysis.snapshot.profile.currency,
        badge: watchSummary.badge,
        tone: analysis.insight.tone,
        confidence: normalizeConfidence(analysis.insight.confidence),
        summary: watchSummary.summary,
        reasons: watchSummary.reasons
      }
    })
    .sort((left, right) => {
      const rightScore = right.confidence + Math.min(12, Math.abs(right.changePercent) * 2.2)
      const leftScore = left.confidence + Math.min(12, Math.abs(left.changePercent) * 2.2)
      return rightScore - leftScore
    })
    .slice(0, 8)

export const buildAiOpportunityItems = (analyses: AiAssetAnalysis[]): AiOpportunityItem[] =>
  analyses
    .filter(
      (analysis) =>
        !isStableAsset(
          analysis.snapshot.profile.class,
          analysis.snapshot.profile.symbol,
          analysis.snapshot.profile.name,
          analysis.snapshot.quote.price,
          analysis.snapshot.quote.changePercent
        )
    )
    .flatMap((analysis) => {
      const reference = {
        assetId: analysis.snapshot.profile.id,
        assetSymbol: analysis.snapshot.profile.symbol,
        assetName: analysis.snapshot.profile.name,
        assetClass: analysis.snapshot.profile.class,
        price: analysis.snapshot.quote.price,
        changePercent: analysis.snapshot.quote.changePercent,
        currency: analysis.snapshot.profile.currency
      }
      const opportunities: AiOpportunityItem[] = []

      if (analysis.breakoutDistancePercent <= 1.5 && analysis.breakoutDistancePercent >= -1) {
        opportunities.push({
          ...reference,
          id: `breakout:${reference.assetId}`,
          kind: 'breakout',
          title: 'Breakout ihtimali',
          summary: `${reference.assetSymbol} dirence ${analysis.breakoutDistancePercent.toFixed(2)}% mesafede. Hacim korunursa yukarı teyit gelebilir.`,
          tone: analysis.insight.tone === 'negative' ? 'neutral' : 'positive',
          confidence: normalizeConfidence(72 + Math.max(0, 1.5 - analysis.breakoutDistancePercent) * 8),
          metricLabel: 'Dirence mesafe',
          metricValue: `${analysis.breakoutDistancePercent.toFixed(2)}%`
        })
      }

      if (analysis.indicators.rsi < 34) {
        opportunities.push({
          ...reference,
          id: `oversold:${reference.assetId}`,
          kind: 'oversold',
          title: 'Aşırı satım bölgesi',
          summary: `${reference.assetSymbol} için RSI ${analysis.indicators.rsi.toFixed(1)} seviyesinde. Tepki potansiyeli var ama trend teyidi önemli.`,
          tone: analysis.indicators.trend === 'bearish' ? 'neutral' : 'positive',
          confidence: normalizeConfidence(68 + Math.max(0, 34 - analysis.indicators.rsi)),
          metricLabel: 'RSI',
          metricValue: analysis.indicators.rsi.toFixed(1)
        })
      }

      if (analysis.indicators.volumeTrend === 'rising' && Math.abs(reference.changePercent) >= 1.2) {
        opportunities.push({
          ...reference,
          id: `volume:${reference.assetId}`,
          kind: 'volume',
          title: 'Hacim artışı',
          summary: `${reference.assetSymbol} tarafında fiyat hareketi hacimle destekleniyor. Hareketin kalıcılığı için gün içi devamı takip edilmeli.`,
          tone: reference.changePercent >= 0 ? 'positive' : 'negative',
          confidence: normalizeConfidence(66 + Math.min(16, Math.abs(reference.changePercent) * 2)),
          metricLabel: '24s değişim',
          metricValue: formatPercent(reference.changePercent)
        })
      }

      analysis.patterns
        .filter((pattern) => pattern.status === 'confirmed')
        .slice(0, 1)
        .forEach((pattern) => {
          opportunities.push({
            ...reference,
            id: `pattern:${reference.assetId}:${pattern.type}`,
            kind: 'pattern',
            title: 'Formasyon oluşumu',
            summary: `${reference.assetSymbol} için ${PATTERN_LABELS[pattern.type]} sinyali öne çıkıyor. Yapının teyidi kırılım seviyesiyle birlikte izlenmeli.`,
            tone: pattern.direction === 'bearish' ? 'negative' : 'positive',
            confidence: normalizeConfidence(pattern.confidence * 100),
            metricLabel: 'Formasyon',
            metricValue: PATTERN_LABELS[pattern.type]
          })
        })

      return opportunities
    })
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, 10)

const buildAiPortfolioReviewLegacy = ({
  summary
}: AiPortfolioReviewInput): AiPortfolioReview => {
  if (!summary.holdings.length) {
    return {
      title: 'Portföy henüz boş',
      tone: 'neutral',
      summary:
        'Portföy yorumu oluşturmak için en az bir varlık ekle. Ardından AI dağılımı, risk yoğunlaşmasını ve günlük hareketi birlikte yorumlayacak.',
      detail: ['İlk adım olarak coin veya hisselerini "Varlıklarım" alanına ekleyebilirsin.'],
      risks: ['Portföy verisi olmadan kişiye özel AI portföy yorumu üretilemez.'],
      totalValueTry: 0,
      dailyChangePercent: 0,
      holdingCount: 0
    }
  }

  const sortedHoldings = summary.holdings
  const totalValueTry = Math.max(summary.totalValueTry, 1)
  const topHolding = sortedHoldings[0]
  const topHoldingWeight = (topHolding.totalValueTry / totalValueTry) * 100
  const dominantHoldingCount = sortedHoldings.filter(
    (item) => item.totalValueTry / totalValueTry >= 0.18
  ).length
  const classMix = sortedHoldings.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item.holding.assetClass] = (accumulator[item.holding.assetClass] ?? 0) + item.totalValueTry
    return accumulator
  }, {})
  const dominantClassEntry =
    Object.entries(classMix).sort((left, right) => right[1] - left[1])[0] ?? null
  const dominantClassWeight = dominantClassEntry ? (dominantClassEntry[1] / totalValueTry) * 100 : 0
  const dominantClassLabel = dominantClassEntry
    ? classLabels[dominantClassEntry[0]] ?? dominantClassEntry[0]
    : 'karma'
  const trackedCostHoldings = sortedHoldings.filter(
    (item) => item.averageCostTry !== undefined && item.profitLossPercent !== undefined
  )
  const costCoveragePercent = (trackedCostHoldings.length / sortedHoldings.length) * 100
  const winners = sortedHoldings.filter((item) => item.dailyChangePercent > 0.35)
  const losers = sortedHoldings.filter((item) => item.dailyChangePercent < -0.35)
  const strongestHolding =
    [...sortedHoldings].sort((left, right) => right.dailyChangePercent - left.dailyChangePercent)[0] ?? topHolding
  const weakestHolding =
    [...sortedHoldings].sort((left, right) => left.dailyChangePercent - right.dailyChangePercent)[0] ?? topHolding
  const tone: InsightTone =
    summary.totalDailyChangePercent > 1.4
      ? 'positive'
      : summary.totalDailyChangePercent < -1.4
        ? 'negative'
        : topHoldingWeight > 48 || dominantClassWeight > 78
          ? 'neutral'
          : 'positive'

  const title =
    tone === 'positive'
      ? 'Portföy bugün kontrollü güçlü'
      : tone === 'negative'
        ? 'Portföy baskı altında'
        : 'Portföy dengede ama seçici izlenmeli'

  const summaryText =
    tone === 'positive'
      ? `${summary.holdings.length} pozisyonlu portföy bugün ${formatPercent(summary.totalDailyChangePercent)} bölgede. Yukarı katkı sadece tek isimden değil; kazananların sayısı kaybedenlerden fazla olduğu için görünüm daha sağlıklı.`
      : tone === 'negative'
        ? `${summary.holdings.length} pozisyonlu portföy bugün ${formatPercent(summary.totalDailyChangePercent)} baskıda. Zayıflık özellikle ${weakestHolding.holding.assetSymbol} ve benzeri geri kalan halkalarda yoğunlaşıyor.`
        : `${summary.holdings.length} pozisyonlu portföyde net yön zayıf. ${topHolding.holding.assetSymbol} ağırlığı yüksek olduğu için kapanışa kadar birkaç büyük pozisyon toplam görünümü belirleyecek.`

  const detail = [
    `${topHolding.holding.assetSymbol} yaklaşık ${formatPercent(topHoldingWeight)} ağırlık taşıyor; bu yüzden portföy yönünü en çok bu pozisyon belirliyor.`,
    dominantClassEntry
      ? `Portföyün baskın teması ${dominantClassLabel}; bu sınıf toplam değerin ${formatPercent(dominantClassWeight)} kadarını oluşturuyor.`
      : 'Portföy farklı varlık sınıflarına dağılmış durumda.',
    winners.length === 0 && losers.length === 0
      ? 'Pozisyonların çoğu dar bantta; geniş tabanlı net bir momentum henüz oluşmamış.'
      : `${winners.length} pozisyon pozitif, ${losers.length} pozisyon negatif bölgede. En güçlü halka ${strongestHolding.holding.assetSymbol}, en zayıf halka ${weakestHolding.holding.assetSymbol}.`,
    summary.totalProfitLossPercent !== undefined
      ? `Maliyet girilmiş pozisyonlarda gerçekleşmemiş toplam kâr/zarar ${formatPercent(summary.totalProfitLossPercent)} seviyesinde. Toplam portföy değeri ${formatCurrency(summary.totalValueTry, 'TRY')}.`
      : `Maliyet takibi portföyün ${formatPercent(costCoveragePercent)} kadarında aktif. Daha gerçekçi AI yorumu için eksik maliyet bilgilerini tamamlamak faydalı olur.`
  ]

  const risks = [
    topHoldingWeight >= 42
      ? `${topHolding.holding.assetSymbol} tek başına yüksek ağırlık taşıyor. Bu isimdeki sert bir hareket toplam sonucu belirgin oynatabilir.`
      : 'Tek isim yoğunlaşması aşırı değil; yine de ana pozisyonların birbiriyle korelasyonu takip edilmeli.',
    dominantClassWeight >= 78
      ? `Portföyün büyük kısmı ${dominantClassLabel} tarafında toplandığı için tema riski yüksek. Aynı anlatıya bağlı varlıklar birlikte geri çekilebilir.`
      : `Varlık sınıfı dağılımı fena görünmüyor; yine de ${dominantClassLabel} tarafındaki haber akışı toplam performansı etkileyebilir.`,
    dominantHoldingCount <= 2
      ? 'Portföyün ana yükünü az sayıda pozisyon taşıyor. Bu yapı doğru giderse ödül üretir ama ters harekette oynaklığı artırır.'
      : 'Dağılım biraz daha yayılmış durumda; yine de birbirine benzer varlıkların aynı anda yön değiştirmesi toplu baskı yaratabilir.'
  ]

  return {
    title,
    tone,
    summary: summaryText,
    detail,
    risks,
    totalValueTry: summary.totalValueTry,
    dailyChangePercent: summary.totalDailyChangePercent,
    totalProfitLossPercent: summary.totalProfitLossPercent,
    holdingCount: summary.holdings.length
  }
}

const buildDetailedPortfolioReviewSummary = (summary: PortfolioSummary): AiPortfolioReview => {
  if (!summary.holdings.length) {
    return {
      title: 'Portföy henüz boş',
      tone: 'neutral',
      summary:
        'Portföy yorumu oluşturmak için en az bir varlık ekle. Ardından AI; dağılımı, yoğunlaşma riskini, günlük genişliği ve maliyet verisini birlikte yorumlar.',
      detail: ['İlk adım olarak coin veya hisselerini "Varlıklarım" alanına ekleyebilirsin.'],
      risks: ['Portföy verisi olmadan kişiye özel analiz üretilemez.'],
      totalValueTry: 0,
      dailyChangePercent: 0,
      holdingCount: 0
    }
  }

  const sortedHoldings = [...summary.holdings].sort((left, right) => right.totalValueTry - left.totalValueTry)
  const totalValueTry = Math.max(summary.totalValueTry, 1)
  const topHolding = sortedHoldings[0]
  const topHoldingWeight = (topHolding.totalValueTry / totalValueTry) * 100
  const top3Weight =
    (sortedHoldings.slice(0, 3).reduce((sum, item) => sum + item.totalValueTry, 0) / totalValueTry) * 100
  const classMix = sortedHoldings.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item.holding.assetClass] = (accumulator[item.holding.assetClass] ?? 0) + item.totalValueTry
    return accumulator
  }, {})
  const dominantClassEntry =
    Object.entries(classMix).sort((left, right) => right[1] - left[1])[0] ?? null
  const dominantClassWeight = dominantClassEntry ? (dominantClassEntry[1] / totalValueTry) * 100 : 0
  const dominantClassLabel = dominantClassEntry
    ? classLabels[dominantClassEntry[0]] ?? dominantClassEntry[0]
    : 'karma'
  const trackedCostHoldings = sortedHoldings.filter(
    (item) => item.averageCostTry !== undefined && item.profitLossPercent !== undefined
  )
  const costCoveragePercent = (trackedCostHoldings.length / sortedHoldings.length) * 100
  const winners = sortedHoldings.filter((item) => item.dailyChangePercent > 0.35)
  const losers = sortedHoldings.filter((item) => item.dailyChangePercent < -0.35)
  const strongestHolding =
    [...sortedHoldings].sort((left, right) => right.dailyChangePercent - left.dailyChangePercent)[0] ?? topHolding
  const weakestHolding =
    [...sortedHoldings].sort((left, right) => left.dailyChangePercent - right.dailyChangePercent)[0] ?? topHolding
  const averageAbsoluteMove =
    sortedHoldings.reduce((sum, item) => sum + Math.abs(item.dailyChangePercent), 0) / sortedHoldings.length
  const breadthPercent = (winners.length / Math.max(sortedHoldings.length, 1)) * 100
  const trackedPnLCount = sortedHoldings.filter((item) => item.profitLossPercent !== undefined).length
  const dispersionPercent =
    sortedHoldings.reduce(
      (sum, item) => sum + Math.abs(item.dailyChangePercent - summary.totalDailyChangePercent),
      0
    ) / sortedHoldings.length

  const tone: InsightTone =
    summary.totalDailyChangePercent > 1.5
      ? 'positive'
      : summary.totalDailyChangePercent < -1.5
        ? 'negative'
        : topHoldingWeight > 46 || dominantClassWeight > 78
          ? 'neutral'
          : 'positive'

  const title =
    tone === 'positive'
      ? 'Portföy teknik olarak destekli'
      : tone === 'negative'
        ? 'Portföy baskı altında'
        : 'Portföy dengeli ama yoğunlaşma izlenmeli'

  const summaryText =
    tone === 'positive'
      ? `${summary.holdings.length} pozisyonlu portföy bugün ${formatPercent(summary.totalDailyChangePercent)} bölgede. Pozitif genişlik korunurken en güçlü katkı ${strongestHolding.holding.assetSymbol} tarafından geliyor; yapı tek isimden değil, yayılmış katkıdan destek alıyor.`
      : tone === 'negative'
        ? `${summary.holdings.length} pozisyonlu portföy bugün ${formatPercent(summary.totalDailyChangePercent)} baskıda. Negatif genişlik ve ${weakestHolding.holding.assetSymbol} çevresindeki zayıflık toplam görünümü aşağı çeken ana halka olmuş durumda.`
        : `${summary.holdings.length} pozisyonlu portföyde net yön zayıf. ${topHolding.holding.assetSymbol} ağırlığı yüksek olduğu için birkaç büyük pozisyon toplam resmi belirlemeye devam edecek.`

  const detail = [
    `${topHolding.holding.assetSymbol} yaklaşık ${formatPercent(topHoldingWeight)} ağırlık taşıyor; ilk üç pozisyonun toplam payı ${formatPercent(top3Weight)}. Yoğunlaşma seviyesi portföy betasının ana belirleyicisi.`,
    dominantClassEntry
      ? `Tematik dağılımda ${dominantClassLabel} ağırlığı ${formatPercent(dominantClassWeight)} seviyesinde. Bu oran korelasyon riskinin hâlâ yüksek kaldığını gösteriyor.`
      : 'Portföy farklı varlık sınıflarına dengeli biçimde dağılmış durumda.',
    `${winners.length} pozisyon pozitif, ${losers.length} pozisyon negatif bölgede. Breadth oranı ${formatPercent(breadthPercent)}, ortalama mutlak günlük salınım ${formatPercent(averageAbsoluteMove)} ve iç dağılım farkı ${formatPercent(dispersionPercent)} seviyesinde.`,
    summary.totalProfitLossPercent !== undefined
      ? `Maliyet girilmiş ${trackedPnLCount} pozisyonda gerçekleşmemiş toplam kâr/zarar ${formatPercent(summary.totalProfitLossPercent)}. Toplam portföy değeri ${formatCurrency(summary.totalValueTry, 'TRY')}.`
      : `Maliyet takibi portföyün ${formatPercent(costCoveragePercent)} kadarında aktif. Daha doğru risk/ödül okuması için eksik maliyet girişleri tamamlanmalı.`,
    `Günün en güçlü halkası ${strongestHolding.holding.assetSymbol}, en zayıf halkası ${weakestHolding.holding.assetSymbol}. Bu ikili kısa vadeli yönün ana taşıyıcısı.`
  ]

  const risks = [
    topHoldingWeight >= 42
      ? `${topHolding.holding.assetSymbol} tek başına yüksek ağırlık taşıyor. Bu isimdeki sert hareket toplam portföy varyansını belirgin biçimde değiştirebilir.`
      : 'Tek isim yoğunlaşması aşırı değil; yine de ana pozisyonların korelasyonu izlenmeli.',
    dominantClassWeight >= 78
      ? `Portföyün büyük kısmı ${dominantClassLabel} tarafında toplandığı için tema riski yüksek. Aynı anlatıya bağlı varlıklar birlikte geri çekilebilir.`
      : `${dominantClassLabel} tarafı baskın kalmaya devam ediyor; bu alandaki haber akışı toplam görünümü etkileyebilir.`,
    top3Weight >= 72
      ? 'Portföy yükünün büyük kısmını üç ana pozisyon taşıyor. Bu yapı doğru giderse hız üretir, ters harekette ise oynaklığı sert artırır.'
      : 'Dağılım daha dengeli; yine de benzer yönlü varlık kümeleri toplu baskı yaratabilir.',
    trackedCostHoldings.length < sortedHoldings.length / 2
      ? 'Maliyet verisi eksik kaldığı için bazı pozisyonlarda gerçek risk/ödül oranı tam okunamıyor.'
      : 'Maliyet verisi yeterli; yine de yeniden dengeleme ve zarar-kes disiplini düzenli izlenmeli.'
  ]

  return {
    title,
    tone,
    summary: summaryText,
    detail,
    risks,
    totalValueTry: summary.totalValueTry,
    dailyChangePercent: summary.totalDailyChangePercent,
    totalProfitLossPercent: summary.totalProfitLossPercent,
    holdingCount: summary.holdings.length
  }
}

export const buildAiPortfolioReview = ({
  summary
}: AiPortfolioReviewInput): AiPortfolioReview => {
  return buildDetailedPortfolioReviewSummary(summary)

  if (!summary.holdings.length) {
    return {
      title: 'Portföy henüz boş',
      tone: 'neutral',
      summary:
        'Portföy yorumu oluşturmak için en az bir varlık ekle. Ardından AI dağılımı, risk yoğunlaşmasını ve günlük hareketi birlikte yorumlayacak.',
      detail: ['İlk adım olarak coin veya hisselerini "Varlıklarım" alanına ekleyebilirsin.'],
      risks: ['Portföy verisi olmadan kişiye özel AI portföy yorumu üretilemez.'],
      totalValueTry: 0,
      dailyChangePercent: 0,
      holdingCount: 0
    }
  }

  const sortedHoldings = summary.holdings
  const totalValueTry = Math.max(summary.totalValueTry, 1)
  const topHolding = sortedHoldings[0]
  const topHoldingWeight = (topHolding.totalValueTry / totalValueTry) * 100
  const dominantHoldingCount = sortedHoldings.filter(
    (item) => item.totalValueTry / totalValueTry >= 0.18
  ).length
  const classMix = sortedHoldings.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item.holding.assetClass] = (accumulator[item.holding.assetClass] ?? 0) + item.totalValueTry
    return accumulator
  }, {})
  const dominantClassEntry =
    Object.entries(classMix).sort((left, right) => right[1] - left[1])[0] ?? null
  const dominantClassWeight = dominantClassEntry ? (dominantClassEntry[1] / totalValueTry) * 100 : 0
  const dominantClassLabel = dominantClassEntry
    ? classLabels[dominantClassEntry[0]] ?? dominantClassEntry[0]
    : 'karma'
  const trackedCostHoldings = sortedHoldings.filter(
    (item) => item.averageCostTry !== undefined && item.profitLossPercent !== undefined
  )
  const costCoveragePercent = (trackedCostHoldings.length / sortedHoldings.length) * 100
  const winners = sortedHoldings.filter((item) => item.dailyChangePercent > 0.35)
  const losers = sortedHoldings.filter((item) => item.dailyChangePercent < -0.35)
  const strongestHolding =
    [...sortedHoldings].sort((left, right) => right.dailyChangePercent - left.dailyChangePercent)[0] ?? topHolding
  const weakestHolding =
    [...sortedHoldings].sort((left, right) => left.dailyChangePercent - right.dailyChangePercent)[0] ?? topHolding
  const averageAbsoluteMove =
    sortedHoldings.reduce((sum, item) => sum + Math.abs(item.dailyChangePercent), 0) /
    sortedHoldings.length
  const breadthPercent = (winners.length / Math.max(sortedHoldings.length, 1)) * 100
  const trackedPnLCount = sortedHoldings.filter((item) => item.profitLossPercent !== undefined).length

  const tone: InsightTone =
    summary.totalDailyChangePercent > 1.4
      ? 'positive'
      : summary.totalDailyChangePercent < -1.4
        ? 'negative'
        : topHoldingWeight > 48 || dominantClassWeight > 78
          ? 'neutral'
          : 'positive'

  const title =
    tone === 'positive'
      ? 'Portföy teknik olarak destekli'
      : tone === 'negative'
        ? 'Portföy kısa vadede baskı altında'
        : 'Portföy dengeli ama yoğunlaşma izlenmeli'

  const summaryText =
    tone === 'positive'
      ? `${summary.holdings.length} pozisyonlu portföy bugün ${formatPercent(summary.totalDailyChangePercent)} bölgede. Genişlik tarafında ${winners.length} isim pozitif kalırken, ortalama günlük salınım ${formatPercent(averageAbsoluteMove)} seviyesinde; yapı tek isim değil dağıtılmış katkıyla güç topluyor.`
      : tone === 'negative'
        ? `${summary.holdings.length} pozisyonlu portföy bugün ${formatPercent(summary.totalDailyChangePercent)} baskıda. Negatif genişlik ve ${weakestHolding.holding.assetSymbol} çevresindeki zayıflık, toplam görünümü aşağı çeken ana halka olmuş durumda.`
        : `${summary.holdings.length} pozisyonlu portföyde net yön zayıf. ${topHolding.holding.assetSymbol} ağırlığı yüksek olduğu için kapanışa kadar birkaç büyük pozisyon toplam resmi belirlemeye devam edecek.`

  const detail = [
    `${topHolding.holding.assetSymbol} yaklaşık ${formatPercent(topHoldingWeight)} ağırlık taşıyor; portföy betasının ana taşıyıcısı bu pozisyon.`,
    dominantClassEntry
      ? `Tematik dağılımda ${dominantClassLabel} ağırlığı ${formatPercent(dominantClassWeight)} seviyesinde. Bu durum korelasyon riskinin yüksek kaldığını gösteriyor.`
      : 'Portföy farklı varlık sınıflarına dengeli biçimde dağılmış durumda.',
    winners.length === 0 && losers.length === 0
      ? 'Pozisyonların çoğu dar bantta; geniş tabanlı net momentum henüz oluşmamış.'
      : `${winners.length} pozisyon pozitif, ${losers.length} pozisyon negatif bölgede. En güçlü halka ${strongestHolding.holding.assetSymbol}, en zayıf halka ${weakestHolding.holding.assetSymbol}.`,
    `Breadth oranı yaklaşık ${formatPercent(breadthPercent)}. Ortalama mutlak günlük oynaklık ${formatPercent(averageAbsoluteMove)} ile orta-yüksek bantta.`,
    summary.totalProfitLossPercent !== undefined
      ? `Maliyet girilmiş ${trackedPnLCount} pozisyonda gerçekleşmemiş toplam kâr/zarar ${formatPercent(summary.totalProfitLossPercent)} seviyesinde. Toplam portföy değeri ${formatCurrency(summary.totalValueTry, 'TRY')}.`
      : `Maliyet takibi portföyün ${formatPercent(costCoveragePercent)} kadarında aktif. Daha doğru risk/ödül yorumu için eksik maliyet girişleri tamamlanmalı.`
  ]

  const risks = [
    topHoldingWeight >= 42
      ? `${topHolding.holding.assetSymbol} tek başına yüksek ağırlık taşıyor. Bu isimdeki sert hareket toplam portföy beta profilini belirgin biçimde değiştirebilir.`
      : 'Tek isim yoğunlaşması aşırı değil; yine de ana pozisyonların korelasyonu takip edilmeli.',
    dominantClassWeight >= 78
      ? `Portföyün büyük kısmı ${dominantClassLabel} tarafında toplandığı için tema riski yüksek. Aynı anlatıya bağlı varlıklar birlikte geri çekilebilir.`
      : `${dominantClassLabel} tarafı baskın kalmaya devam ediyor; bu alandaki haber akışı toplam görünümü etkileyebilir.`,
    dominantHoldingCount <= 2
      ? 'Portföy yükünü az sayıda pozisyon taşıyor. Bu yapı ödül üretse de ters harekette volatiliteyi sert artırır.'
      : 'Dağılım daha geniş ama benzer yönlü varlık kümeleri yine toplu baskı yaratabilir.',
    trackedCostHoldings.length < sortedHoldings.length / 2
      ? 'Maliyet verisi eksik olduğu için bazı pozisyonlarda gerçek risk/ödül oranı tam okunamıyor.'
      : 'Maliyet verisi yeterli; yine de zarar kes ve yeniden dengeleme disiplininin düzenli izlenmesi önemli.'
  ]

  return {
    title,
    tone,
    summary: summaryText,
    detail,
    risks,
    totalValueTry: summary.totalValueTry,
    dailyChangePercent: summary.totalDailyChangePercent,
    totalProfitLossPercent: summary.totalProfitLossPercent,
    holdingCount: summary.holdings.length
  }
}

const buildMacroItemSummary = (item: MarketPulseItem): string => {
  const label = item.label.toLowerCase()

  if (label.includes('dominance')) {
    return item.tone === 'positive'
      ? 'BTC dominansı artıyor; altcoin iştahı daralabilir.'
      : item.tone === 'negative'
        ? 'BTC dominansındaki gevşeme altcoin rotasyonunu destekleyebilir.'
        : 'Kripto tarafında hakimiyet dengesi yatay seyrediyor.'
  }

  if (label.includes('bitcoin')) {
    return item.tone === 'positive'
      ? 'Lider kripto varlık yukarı yönlü momentumu destekliyor.'
      : item.tone === 'negative'
        ? 'Bitcoin tarafındaki zayıflama genel risk iştahını da baskılayabilir.'
        : 'Bitcoin görünümü kararsız; teyit için hacim önemli.'
  }

  if (label.includes('s&p')) {
    return item.tone === 'positive'
      ? 'ABD risk iştahı güçlü kalırsa büyüme hisseleri desteklenebilir.'
      : item.tone === 'negative'
        ? 'ABD endekslerindeki zayıflama küresel risk iştahını baskılayabilir.'
        : 'ABD cephesi şu an dengeli, yön teyidi için yeni makro veri gerekebilir.'
  }

  if (label.includes('bist')) {
    return item.tone === 'positive'
      ? 'Yerel piyasa tarafında risk alma isteği destek buluyor.'
      : item.tone === 'negative'
        ? 'BIST tarafında temkinli seyir kısa vadeli dalgalanmayı artırabilir.'
        : 'Yerel görünüm dengede, seçici hareketler ön planda olabilir.'
  }

  return item.note ?? 'Makro akış izleniyor.'
}

export const buildAiMacroSummary = (pulseItems: MarketPulseItem[]): AiMacroSummary => {
  if (!pulseItems.length) {
    return {
      title: 'Makro veri bekleniyor',
      tone: 'neutral',
      summary: 'Makro panel dolduğunda AI kısa piyasa özetini burada toplayacak.',
      items: []
    }
  }

  const positiveCount = pulseItems.filter((item) => item.tone === 'positive').length
  const negativeCount = pulseItems.filter((item) => item.tone === 'negative').length
  const tone: InsightTone =
    positiveCount > negativeCount ? 'positive' : negativeCount > positiveCount ? 'negative' : 'neutral'

  const items: AiMacroSummaryItem[] = pulseItems.map((item) => ({
    id: item.id,
    label: item.label,
    value: item.value,
    change: item.change,
    source: item.source,
    tone: item.tone,
    summary: buildMacroItemSummary(item)
  }))

  return {
    title:
      tone === 'positive'
        ? 'Makro görünüm destekleyici'
        : tone === 'negative'
          ? 'Makro görünüm temkinli'
          : 'Makro görünüm dengeli',
    tone,
    summary:
      tone === 'positive'
        ? 'Makro akışta olumlu başlıklar biraz daha baskın. Riskli varlıklarda seçici fırsatlar öne çıkabilir.'
        : tone === 'negative'
          ? 'Makro sinyaller şu an daha savunmacı. Kırılgan varlıklarda teyitsiz agresif pozisyonlardan kaçınmak faydalı olabilir.'
          : 'Makro cephede karışık bir görünüm var. Net yön için yeni veri ve kapanışlar belirleyici olacak.',
    items
  }
}

export const buildAiNotificationHistorySeed = (
  watchlist: AiWatchlistItem[],
  opportunities: AiOpportunityItem[],
  portfolioReview: AiPortfolioReview,
  macroSummary: AiMacroSummary
): Array<Omit<AiNotificationHistoryItem, 'id'>> => {
  const createdAt = new Date().toISOString()
  const items: Array<Omit<AiNotificationHistoryItem, 'id'>> = []

  opportunities.slice(0, 3).forEach((opportunity) => {
    items.push({
      createdAt,
      title: `${opportunity.assetSymbol} için ${opportunity.title}`,
      message: opportunity.summary,
      tone: opportunity.tone,
      kind: opportunity.kind,
      assetId: opportunity.assetId,
      assetSymbol: opportunity.assetSymbol,
      dedupeKey: opportunity.id
    })
  })

  if (watchlist[0]) {
    items.push({
      createdAt,
      title: `AI watchlist: ${watchlist[0].assetSymbol}`,
      message: watchlist[0].summary,
      tone: watchlist[0].tone,
      kind: 'breakout',
      assetId: watchlist[0].assetId,
      assetSymbol: watchlist[0].assetSymbol,
      dedupeKey: `watchlist:${watchlist[0].assetId}:${watchlist[0].badge}`
    })
  }

  if (portfolioReview.holdingCount > 0) {
    items.push({
      createdAt,
      title: 'AI portföy yorumu yenilendi',
      message: portfolioReview.summary,
      tone: portfolioReview.tone,
      kind: 'portfolio',
      dedupeKey: `portfolio:${portfolioReview.holdingCount}:${portfolioReview.dailyChangePercent.toFixed(2)}`
    })
  }

  if (macroSummary.items.length) {
    items.push({
      createdAt,
      title: 'AI makro özeti güncellendi',
      message: macroSummary.summary,
      tone: macroSummary.tone,
      kind: 'macro',
      dedupeKey: `macro:${macroSummary.title}`
    })
  }

  return items
}
