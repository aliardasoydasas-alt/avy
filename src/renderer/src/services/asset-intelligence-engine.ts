import type { AiInsight } from '@renderer/services/ai-insight-engine'
import { formatCurrency, formatPercent, formatVolume } from '@renderer/utils/format'
import type { IndicatorSnapshot } from '@shared/types/analysis'
import type { AssetSnapshot, MarketOverviewItem } from '@shared/types/market'
import type { NewsItem } from '@shared/types/news'
import type { PatternSignal } from '@shared/types/patterns'
import type { FriendProfile } from '@shared/types/social'

export interface AssetScenario {
  title: string
  condition: string
  watchLevel: string
  risk: string
  tone: 'positive' | 'negative' | 'neutral'
}

export interface AssetRadarItem {
  label: string
  value: string
  tone: 'positive' | 'negative' | 'neutral' | 'info'
}

export interface AssetIntelligenceReport {
  whatsHappening: string[]
  levels: {
    support: string
    resistance: string
    breakout: string
    riskZone: string
    followZone: string
  }
  scenarios: AssetScenario[]
  radar: AssetRadarItem[]
  newsImpact: {
    tone: 'positive' | 'negative' | 'neutral'
    score: number
    summary: string
  }
  confidence: {
    label: string
    summary: string
  }
  similarAssets: Array<{
    assetId: string
    symbol: string
    name: string
    changePercent: number
    volume: number
    volatility: number
    momentumLabel: string
  }>
  whyMoving: string[]
  followNotes: string[]
  socialInterest: {
    friendCount: number
    summary: string
  }
}

interface BuildAssetIntelligenceInput {
  snapshot: AssetSnapshot
  indicators: IndicatorSnapshot
  patterns: PatternSignal[]
  insight: AiInsight
  news: NewsItem[]
  overviewItems: MarketOverviewItem[]
  friends?: FriendProfile[]
}

const getNewsTone = (news: NewsItem[]): 'positive' | 'negative' | 'neutral' => {
  const score = news.reduce((sum, item) => {
    if (item.aiCommentary.tone === 'positive') {
      return sum + 1
    }

    if (item.aiCommentary.tone === 'negative') {
      return sum - 1
    }

    return sum
  }, 0)

  if (score > 0) {
    return 'positive'
  }

  if (score < 0) {
    return 'negative'
  }

  return 'neutral'
}

const getRecentWindow = (snapshot: AssetSnapshot) => snapshot.candles.slice(-8)

const getVolumeRatio = (snapshot: AssetSnapshot): number => {
  const candles = getRecentWindow(snapshot)

  if (candles.length < 3) {
    return 1
  }

  const averageVolume =
    candles.slice(0, -1).reduce((sum, candle) => sum + candle.volume, 0) / Math.max(candles.length - 1, 1)

  return averageVolume > 0 ? candles.at(-1)!.volume / averageVolume : 1
}

const getRecentMovePercent = (snapshot: AssetSnapshot): number => {
  const candles = getRecentWindow(snapshot)

  if (candles.length < 2) {
    return snapshot.quote.changePercent
  }

  const previous = candles.at(-2)!
  const last = candles.at(-1)!

  return previous.close ? ((last.close - previous.close) / previous.close) * 100 : snapshot.quote.changePercent
}

const getCloseLocation = (snapshot: AssetSnapshot): number => {
  const last = snapshot.candles.at(-1)

  if (!last || last.high === last.low) {
    return 0.5
  }

  return (last.close - last.low) / (last.high - last.low)
}

const getRadarTone = (
  value: number,
  positiveThreshold: number,
  negativeThreshold: number
): AssetRadarItem['tone'] => {
  if (value >= positiveThreshold) {
    return 'positive'
  }

  if (value <= negativeThreshold) {
    return 'negative'
  }

  return 'neutral'
}

const summarizeNewsImpact = (symbol: string, news: NewsItem[]): AssetIntelligenceReport['newsImpact'] => {
  const tone = getNewsTone(news)
  const highImportanceCount = news.filter((item) => item.importance === 'high').length
  const score = Math.max(
    18,
    Math.min(92, 50 + highImportanceCount * 10 + (tone === 'positive' ? 14 : tone === 'negative' ? -14 : 0))
  )

  return {
    tone,
    score,
    summary:
      tone === 'positive'
        ? `${symbol} için son haber akışı kısa vadede destekleyici okunuyor.`
        : tone === 'negative'
          ? `${symbol} için son haber akışı temkinli okunmalı; risk algısı yükselmiş olabilir.`
          : `${symbol} için haber akışı şu an net bir yön dayatmıyor.`
  }
}

const buildConfidence = (
  insight: AiInsight,
  indicators: IndicatorSnapshot,
  patterns: PatternSignal[],
  news: NewsItem[]
): AssetIntelligenceReport['confidence'] => {
  const newsTone = getNewsTone(news)
  const hasPatternConflict =
    patterns.some((pattern) => pattern.direction === 'bullish' && pattern.status === 'confirmed') &&
    patterns.some((pattern) => pattern.direction === 'bearish' && pattern.status === 'confirmed')
  const isMixed =
    (insight.tone === 'positive' && indicators.trend === 'bearish') ||
    (insight.tone === 'negative' && indicators.trend === 'bullish') ||
    hasPatternConflict ||
    newsTone === 'neutral'

  if (insight.confidence >= 76 && !isMixed) {
    return {
      label: 'Netlik yüksek',
      summary: 'Teknik ve haber verileri birbirini büyük ölçüde destekliyor.'
    }
  }

  if (insight.confidence <= 62 || isMixed) {
    return {
      label: 'Veri çelişkili',
      summary: 'Sinyaller aynı yöne bakmıyor; teyit gelmeden agresif yorum zayıf kalır.'
    }
  }

  return {
    label: 'Kararsız görünüm',
    summary: 'Bazı sinyaller destekliyor ama tablo henüz yeterince temiz değil.'
  }
}

const buildSimilarAssets = (
  snapshot: AssetSnapshot,
  overviewItems: MarketOverviewItem[]
): AssetIntelligenceReport['similarAssets'] =>
  overviewItems
    .filter((item) => item.assetId !== snapshot.profile.id && item.profile.class === snapshot.profile.class)
    .filter((item) =>
      snapshot.profile.class === 'crypto'
        ? item.profile.currency === snapshot.profile.currency
        : item.profile.exchange === snapshot.profile.exchange || item.profile.market === snapshot.profile.market
    )
    .slice()
    .sort((left, right) => right.quote.volume - left.quote.volume)
    .slice(0, 4)
    .map((item) => {
      const volatility =
        item.quote.price > 0 ? ((item.quote.high24h - item.quote.low24h) / item.quote.price) * 100 : 0

      return {
        assetId: item.assetId,
        symbol: item.profile.symbol,
        name: item.profile.name,
        changePercent: item.quote.changePercent,
        volume: item.quote.volume,
        volatility,
        momentumLabel:
          item.quote.changePercent >= 2.5
            ? 'Güçlü ivme'
            : item.quote.changePercent <= -2.5
              ? 'Baskı altında'
              : 'Dengeli'
      }
    })

export const buildAssetIntelligence = ({
  snapshot,
  indicators,
  patterns,
  insight,
  news,
  overviewItems,
  friends = []
}: BuildAssetIntelligenceInput): AssetIntelligenceReport => {
  const volumeRatio = getVolumeRatio(snapshot)
  const recentMovePercent = getRecentMovePercent(snapshot)
  const closeLocation = getCloseLocation(snapshot)
  const newsImpact = summarizeNewsImpact(snapshot.profile.symbol, news)
  const similarAssets = buildSimilarAssets(snapshot, overviewItems)
  const confidence = buildConfidence(insight, indicators, patterns, news)
  const confirmedPattern = patterns.find((pattern) => pattern.status === 'confirmed')
  const friendCount = friends.filter(
    (friend) =>
      friend.publicAssetIds.includes(snapshot.profile.id) ||
      friend.publicHoldings.some((holding) => holding.assetId === snapshot.profile.id)
  ).length

  const whatsHappening = [
    snapshot.quote.price >= indicators.resistance
      ? `Fiyat kısa vadeli direnç bölgesinin üstünde kalmaya çalışıyor.`
      : snapshot.quote.price <= indicators.support
        ? `Fiyat kısa vadeli destek bölgesinin altında baskı görüyor.`
        : `Fiyat destek ${formatCurrency(indicators.support, snapshot.profile.currency)} ile direnç ${formatCurrency(indicators.resistance, snapshot.profile.currency)} arasında.`,
    volumeRatio >= 1.2
      ? `Hacim son mumlarda ortalamanın üstüne çıkmış; hareket destek alıyor.`
      : volumeRatio <= 0.85
        ? `Hacim zayıflamış; mevcut hareketin gücü sınırlı olabilir.`
        : `Hacim ortalamaya yakın; fiyat teyidi için yeni akış gerekebilir.`,
    indicators.rsi >= 60
      ? 'RSI yukarı bölgede, momentum alıcılar lehine.'
      : indicators.rsi <= 40
        ? 'RSI zayıf bölgede, toparlanma için ek teyit gerekir.'
        : 'RSI nötr bölgede; yönü tek başına belirlemiyor.',
    newsImpact.summary,
    confirmedPattern
      ? `${confirmedPattern.label} işareti görünümün teknik tarafını destekliyor.`
      : 'Formasyon tarafında güçlü teyit yok; fiyat ve hacim birlikte izlenmeli.'
  ]

  const levels = {
    support: formatCurrency(indicators.support, snapshot.profile.currency),
    resistance: formatCurrency(indicators.resistance, snapshot.profile.currency),
    breakout: formatCurrency(indicators.resistance, snapshot.profile.currency),
    riskZone: formatCurrency(indicators.support * 0.985, snapshot.profile.currency),
    followZone: formatCurrency(indicators.resistance * 1.02, snapshot.profile.currency)
  }

  const scenarios: AssetScenario[] = [
    {
      title: 'Boğa senaryosu',
      condition: `Fiyat ${levels.breakout} üzerindeki kapanışları korur ve hacim zayıflamazsa.`,
      watchLevel: `Takip seviyesi: ${levels.breakout} üzeri kalıcılık.`,
      risk: `Hacim düşer veya fiyat tekrar ${levels.support} altına dönerse bozulur.`,
      tone: 'positive'
    },
    {
      title: 'Ayı senaryosu',
      condition: `Fiyat ${levels.support} altına sarkar ve tepki alımı zayıf kalırsa.`,
      watchLevel: `Takip seviyesi: ${levels.support} altı kapanış.`,
      risk: `Direnç bölgesi hızlı geri alınırsa bu senaryo zayıflar.`,
      tone: 'negative'
    },
    {
      title: 'Nötr senaryo',
      condition: `Fiyat destek-direnc bandında kalır, hacim ortalamaya yakın seyrederse.`,
      watchLevel: `Takip seviyesi: ${levels.support} - ${levels.resistance} bandı.`,
      risk: `Bandın dışına taşan kapanışlar yönü hızla değiştirebilir.`,
      tone: 'neutral'
    }
  ]

  const radar: AssetRadarItem[] = [
    {
      label: 'Hacim / ortalama',
      value: `${volumeRatio.toFixed(2)}x`,
      tone: getRadarTone(volumeRatio, 1.2, 0.85)
    },
    {
      label: 'Son mum ivmesi',
      value: formatPercent(recentMovePercent),
      tone: getRadarTone(recentMovePercent, 0.8, -0.8)
    },
    {
      label: 'Kapanış konumu',
      value: closeLocation >= 0.7 ? 'Üst bölge' : closeLocation <= 0.3 ? 'Alt bölge' : 'Orta bölge',
      tone: closeLocation >= 0.7 ? 'positive' : closeLocation <= 0.3 ? 'negative' : 'neutral'
    },
    {
      label: 'Hacim eğilimi',
      value:
        indicators.volumeTrend === 'rising'
          ? 'Artıyor'
          : indicators.volumeTrend === 'falling'
            ? 'Azalıyor'
            : 'Dengeli',
      tone:
        indicators.volumeTrend === 'rising'
          ? 'positive'
          : indicators.volumeTrend === 'falling'
            ? 'negative'
            : 'neutral'
    },
    {
      label: 'RSI',
      value: indicators.rsi.toFixed(1),
      tone: indicators.rsi >= 65 ? 'positive' : indicators.rsi <= 35 ? 'negative' : 'neutral'
    },
    {
      label: 'Haber etkisi',
      value: `${newsImpact.score}/100`,
      tone: newsImpact.tone
    }
  ]

  const whyMoving = [
    newsImpact.summary,
    volumeRatio >= 1.2
      ? 'Fiyat hareketi son mumlarda artan hacimle destekleniyor.'
      : 'Fiyat hareketi yüksek hacim desteği olmadan ilerliyor.',
    snapshot.quote.price >= indicators.resistance
      ? 'Direnç üzeri fiyatlama kısa vadeli kırılım beklentisini artırıyor.'
      : snapshot.quote.price <= indicators.support
        ? 'Destek altı zayıflama aşağı yönlü baskıyı artırıyor.'
        : 'Fiyat hâlâ ana bandın içinde; yön için yeni tetikleyici gerekiyor.',
    confirmedPattern
      ? `Teknik tarafta ${confirmedPattern.label} işareti fiyat anlatısını güçlendiriyor.`
      : 'Formasyon tarafında net teyit gelmediği için teknik anlatı tek yönlü değil.'
  ]

  const followNotes = [
    `${levels.breakout} üzeri kapanış gelirse bu varlığa tekrar bak.`,
    volumeRatio < 1.1
      ? 'Hacim artışı başlarsa hareketin kalitesi yeniden değerlendirilmeli.'
      : 'Hacim korunursa mevcut yönün devamı daha anlamlı olur.',
    indicators.rsi >= 68
      ? 'RSI aşırı alım bölgesine yaklaşırsa hız yerine yorulma riskini de izle.'
      : indicators.rsi <= 35
        ? 'RSI aşırı satıma yaklaşıyorsa tepki potansiyelini teyitle birlikte izle.'
        : 'RSI nötr bölgede; yönü destek-direnç kırılımı belirleyebilir.'
  ]

  return {
    whatsHappening,
    levels,
    scenarios,
    radar,
    newsImpact,
    confidence,
    similarAssets,
    whyMoving,
    followNotes,
    socialInterest: {
      friendCount,
      summary:
        friendCount > 0
          ? `${friendCount} arkadaşın bu varlığı açık listelerinde veya portföy özetinde tutuyor.`
          : 'Arkadaş tarafında şu an belirgin bir açık ilgi görünmüyor.'
    }
  }
}
