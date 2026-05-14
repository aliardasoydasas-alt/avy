import type { AiInsight } from '@renderer/services/ai-insight-engine'
import type { AssetChatMessage } from '@renderer/store/use-asset-chat-store'
import { formatCurrency, formatPercent, formatVolume } from '@renderer/utils/format'
import type { IndicatorSnapshot } from '@shared/types/analysis'
import type { AssetSnapshot, CandlePoint } from '@shared/types/market'
import type { NewsItem } from '@shared/types/news'
import type { PatternSignal } from '@shared/types/patterns'

interface AssetAiResponseInput {
  question: string
  snapshot: AssetSnapshot
  indicators: IndicatorSnapshot
  patterns: PatternSignal[]
  insight: AiInsight
  news: NewsItem[]
  conversation?: AssetChatMessage[]
}

type AssetAiIntent =
  | 'risk'
  | 'news'
  | 'technical'
  | 'pattern'
  | 'levels'
  | 'entry'
  | 'why_move'
  | 'volume'
  | 'summary'

type AnswerFlavor = 'clear' | 'tactical' | 'narrative'

const normalizeText = (text: string): string =>
  text
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const scoreIntent = (text: string, keywords: string[]): number =>
  keywords.reduce((score, keyword) => score + (text.includes(keyword) ? 1 : 0), 0)

const inferIntent = (question: string): AssetAiIntent => {
  const normalized = normalizeText(question)
  const scores: Record<AssetAiIntent, number> = {
    risk: scoreIntent(normalized, ['risk', 'tehlike', 'sakinca', 'guvenli', 'guvensiz']),
    news: scoreIntent(normalized, ['haber', 'gundem', 'aciklama', 'etki', 'etkisi']),
    technical: scoreIntent(normalized, ['teknik', 'trend', 'rsi', 'macd', 'guclu', 'zayif']),
    pattern: scoreIntent(normalized, ['formasyon', 'tobo', 'obo', 'flama', 'fincan', 'kulp']),
    levels: scoreIntent(normalized, ['destek', 'direnc', 'seviye', 'stop', 'bolge', 'kirilim']),
    entry: scoreIntent(normalized, ['alinir', 'alinabilir', 'satilir', 'giris', 'eklenir', 'uygun mu']),
    why_move: scoreIntent(normalized, ['neden', 'niye', 'hareket', 'yuksel', 'dus', 'son hareket', 'son mum']),
    volume: scoreIntent(normalized, ['hacim', 'volume', 'momentum']),
    summary: scoreIntent(normalized, ['ozet', 'gorunum', 'yorum', 'genel durum'])
  }

  const [bestIntent, bestScore] = (Object.entries(scores) as Array<[AssetAiIntent, number]>).sort(
    (left, right) => right[1] - left[1]
  )[0]

  return bestScore > 0 ? bestIntent : 'summary'
}

const getEffectiveQuestion = (question: string, conversation: AssetChatMessage[] = []): string => {
  const trimmed = question.trim()

  if (normalizeText(trimmed).split(' ').length > 3) {
    return trimmed
  }

  const previousUserMessage = [...conversation]
    .reverse()
    .find((message) => message.role === 'user' && message.text.trim() !== trimmed)

  return previousUserMessage ? `${previousUserMessage.text} ${trimmed}`.trim() : trimmed
}

const hashText = (text: string): number =>
  [...text].reduce((hash, character) => ((hash << 5) - hash + character.charCodeAt(0)) | 0, 0)

const getAnswerFlavor = (question: string, symbol: string): AnswerFlavor => {
  const variants: AnswerFlavor[] = ['clear', 'tactical', 'narrative']
  const index = Math.abs(hashText(`${symbol}:${question}`)) % variants.length
  return variants[index]
}

const pickByFlavor = (flavor: AnswerFlavor, options: Record<AnswerFlavor, string>): string => options[flavor]

const buildReasonLabel = (flavor: AnswerFlavor): string =>
  pickByFlavor(flavor, {
    clear: 'Neden:',
    tactical: 'Okumam şöyle:',
    narrative: 'Bana göre tablo:'
  })

const buildWatchLabel = (flavor: AnswerFlavor): string =>
  pickByFlavor(flavor, {
    clear: 'İzlenecekler:',
    tactical: 'Yakından izlenecek seviyeler:',
    narrative: 'Bir sonraki teyit için bakacağım yerler:'
  })

const buildToneLead = (flavor: AnswerFlavor, tone: 'positive' | 'negative' | 'neutral'): string =>
  pickByFlavor(flavor, {
    clear:
      tone === 'positive'
        ? 'Kısa vadede alıcı taraf biraz daha diri.'
        : tone === 'negative'
          ? 'Kısa vadede baskı tarafı daha ağır.'
          : 'Kısa vadede denge arayışı öne çıkıyor.',
    tactical:
      tone === 'positive'
        ? 'Momentum tamamen kopmuş değil; avantaj hâlâ alıcı tarafta.'
        : tone === 'negative'
          ? 'Henüz rahat bir yapı yok; savunmada kalmak daha mantıklı.'
          : 'Net bir üstün taraf yok, teyit aramak daha sağlıklı.',
    narrative:
      tone === 'positive'
        ? 'Fiyatın anlattığı hikâye şu an yukarıyı denemeye devam ediyor.'
        : tone === 'negative'
          ? 'Fiyatın anlattığı hikâye şu an güç kaybına işaret ediyor.'
          : 'Fiyatın anlattığı hikâye şu an kararsız bir dengeye benziyor.'
  })

const getNewsTone = (news: NewsItem[]): 'positive' | 'negative' | 'neutral' => {
  const positive = news.filter((item) => item.aiCommentary?.tone === 'positive').length
  const negative = news.filter((item) => item.aiCommentary?.tone === 'negative').length

  if (positive > negative) {
    return 'positive'
  }

  if (negative > positive) {
    return 'negative'
  }

  return 'neutral'
}

const getRiskLabel = (
  indicators: IndicatorSnapshot,
  insight: AiInsight,
  news: NewsItem[],
  patterns: PatternSignal[]
): 'düşük' | 'orta' | 'yüksek' => {
  let score = 0

  if (insight.tone === 'negative') {
    score += 2
  } else if (insight.tone === 'neutral') {
    score += 1
  }

  if (indicators.trend === 'bearish') {
    score += 2
  } else if (indicators.trend === 'sideways') {
    score += 1
  }

  if (indicators.rsi > 70 || indicators.rsi < 30) {
    score += 1
  }

  if (getNewsTone(news) === 'negative') {
    score += 1
  }

  if (patterns.some((pattern) => pattern.status === 'confirmed' && pattern.direction === 'bearish')) {
    score += 1
  }

  if (score >= 5) {
    return 'yüksek'
  }

  if (score >= 3) {
    return 'orta'
  }

  return 'düşük'
}

const formatPatternContext = (patterns: PatternSignal[]): string => {
  const confirmed = patterns.filter((pattern) => pattern.status === 'confirmed')
  const forming = patterns.filter((pattern) => pattern.status === 'forming')

  if (confirmed.length) {
    return `Teyit alan formasyonlar: ${confirmed.map((pattern) => pattern.label).join(', ')}.`
  }

  if (forming.length) {
    return `Oluşum aşamasında izlenen formasyonlar: ${forming.map((pattern) => pattern.label).join(', ')}.`
  }

  return 'Şu anda formasyon tarafında güçlü bir teyit yok.'
}

const summarizeNews = (news: NewsItem[]): string => {
  if (!news.length) {
    return 'Haber akışı zayıf; bu yüzden teknik teyit daha önemli.'
  }

  const tone = getNewsTone(news)

  if (tone === 'positive') {
    return 'Son haber akışı olumluya yakın ve risk iştahını destekleyebilir.'
  }

  if (tone === 'negative') {
    return 'Son haber akışı temkinli ve fiyat üzerinde baskı kurabilir.'
  }

  return 'Son haber akışı karışık; tek başına net yön vermiyor.'
}

const buildWatchLevels = (snapshot: AssetSnapshot, indicators: IndicatorSnapshot): string =>
  `İlk destek ${formatCurrency(indicators.support, snapshot.profile.currency)}, ilk direnç ${formatCurrency(indicators.resistance, snapshot.profile.currency)}.`

const buildTechnicalFactors = (
  snapshot: AssetSnapshot,
  indicators: IndicatorSnapshot,
  insight: AiInsight,
  news: NewsItem[],
  patterns: PatternSignal[]
): string[] => {
  const factors = [
    `Trend ${indicators.trend === 'bullish' ? 'yukarı' : indicators.trend === 'bearish' ? 'aşağı' : 'yatay'} eğilimde.`,
    `RSI ${indicators.rsi.toFixed(1)} ve MACD histogram ${indicators.macd.histogram.toFixed(3)} seviyesinde.`,
    `Hacim ${indicators.volumeTrend === 'rising' ? 'hareketi destekliyor' : indicators.volumeTrend === 'falling' ? 'zayıflıyor' : 'dengeye yakın'}.`,
    summarizeNews(news),
    formatPatternContext(patterns)
  ]

  if (insight.rationale[0]) {
    factors.push(insight.rationale[0])
  }

  if (snapshot.quote.price > indicators.resistance) {
    factors.unshift(
      `Fiyat şu an direnç üstünde; ${formatCurrency(indicators.resistance, snapshot.profile.currency)} seviyesi geri alınmış görünüyor.`
    )
  } else if (snapshot.quote.price < indicators.support) {
    factors.unshift(
      `Fiyat destek altına sarkmış; ${formatCurrency(indicators.support, snapshot.profile.currency)} yeniden alınmadan görünüm toparlanmış sayılmaz.`
    )
  } else {
    factors.unshift(
      `Fiyat ${formatCurrency(indicators.support, snapshot.profile.currency)} destek ile ${formatCurrency(indicators.resistance, snapshot.profile.currency)} direnç arasında.`
    )
  }

  return factors
}

const getRecentCandles = (candles: CandlePoint[]): CandlePoint[] =>
  candles.filter(
    (candle) =>
      Number.isFinite(candle.open) &&
      Number.isFinite(candle.high) &&
      Number.isFinite(candle.low) &&
      Number.isFinite(candle.close)
  )

const getRecentMoveSummary = (snapshot: AssetSnapshot, indicators: IndicatorSnapshot): string => {
  const candles = getRecentCandles(snapshot.candles)

  if (candles.length < 2) {
    return `${snapshot.profile.symbol} için son hareketi okumaya yetecek kadar mum verisi yok.`
  }

  const last = candles[candles.length - 1]
  const previous = candles[candles.length - 2]
  const recentWindow = candles.slice(-6)
  const windowStart = recentWindow[0]
  const oneCandleMove = ((last.close - previous.close) / previous.close) * 100
  const sixCandleMove = ((last.close - windowStart.open) / windowStart.open) * 100
  const candleRange = ((last.high - last.low) / last.close) * 100
  const candleBody = ((last.close - last.open) / last.open) * 100
  const closeLocation = last.high === last.low ? 0.5 : (last.close - last.low) / (last.high - last.low)
  const averageVolume = recentWindow.reduce((sum, candle) => sum + candle.volume, 0) / recentWindow.length
  const volumeRatio = averageVolume > 0 ? last.volume / averageVolume : 1

  let structureNote = 'kısa vadede kararsız bir hareket var'

  if (previous.close <= indicators.resistance && last.close > indicators.resistance) {
    structureNote = 'direnç üzeri kapanışla yukarı kırılım denemesi var'
  } else if (previous.close >= indicators.support && last.close < indicators.support) {
    structureNote = 'destek altı sarkmayla zayıflama var'
  } else if (oneCandleMove > 0.75 && closeLocation >= 0.7) {
    structureNote = 'son mum güçlü kapanışla alıcı tarafın ağır bastığını gösteriyor'
  } else if (oneCandleMove < -0.75 && closeLocation <= 0.3) {
    structureNote = 'son mum zayıf kapanışla satıcı baskısını gösteriyor'
  } else if (Math.abs(candleBody) < 0.25 && candleRange > 1) {
    structureNote = 'fitilli ve kararsız bir mum var; yön teyidi zayıf'
  }

  const volumeNote =
    volumeRatio >= 1.25
      ? 'Hacim son mumda ortalamanın üstüne çıkmış.'
      : volumeRatio <= 0.8
        ? 'Hacim son mumda ortalamanın altında kalmış.'
        : 'Hacim son mumda ortalamaya yakın.'

  return [
    `Son mum değişimi ${formatPercent(oneCandleMove)}, son 6 mum değişimi ${formatPercent(sixCandleMove)}.`,
    `Son mum aralığı ${formatPercent(candleRange)} ve kapanış ${closeLocation >= 0.7 ? 'üst bölgede' : closeLocation <= 0.3 ? 'alt bölgede' : 'orta bölgede'} gerçekleşti.`,
    `${structureNote}.`,
    volumeNote
  ].join(' ')
}

const joinAnswer = (parts: string[]): string => parts.filter(Boolean).join('\n\n')

export const buildAssetAiChatReply = ({
  question,
  snapshot,
  indicators,
  patterns,
  insight,
  news,
  conversation = []
}: AssetAiResponseInput): string => {
  const effectiveQuestion = getEffectiveQuestion(question, conversation)
  const normalizedQuestion = normalizeText(effectiveQuestion)
  const intent = inferIntent(effectiveQuestion)
  const flavor = getAnswerFlavor(effectiveQuestion, snapshot.profile.symbol)
  const latestNews = news[0]
  const riskLabel = getRiskLabel(indicators, insight, news, patterns)
  const technicalFactors = buildTechnicalFactors(snapshot, indicators, insight, news, patterns)
  const patternContext = formatPatternContext(patterns)
  const recentMoveSummary = getRecentMoveSummary(snapshot, indicators)
  const priceSummary = `${snapshot.profile.symbol} şu an ${formatCurrency(snapshot.quote.price, snapshot.profile.currency)} seviyesinde ve günlük değişim ${formatPercent(snapshot.quote.changePercent)}.`
  const entryBias =
    insight.tone === 'positive' && indicators.volumeTrend === 'rising'
      ? 'izlenebilir'
      : insight.tone === 'negative'
        ? 'erken'
        : 'teyit bekliyor'

  if (intent === 'risk') {
    return joinAnswer([
      `Kısa cevap: bu varlıkta risk seviyesi şu an ${riskLabel}.`,
      `${buildReasonLabel(flavor)} ${priceSummary} ${buildToneLead(flavor, insight.tone)} ${technicalFactors.slice(0, 3).join(' ')}`,
      `${buildWatchLabel(flavor)} ${buildWatchLevels(snapshot, indicators)} ${insight.risks.slice(0, 2).join(' ')} Bu yorum yatırım tavsiyesi değildir.`
    ])
  }

  if (intent === 'news') {
    return joinAnswer([
      `Kısa cevap: haber akışı ${getNewsTone(news) === 'positive' ? 'olumluya' : getNewsTone(news) === 'negative' ? 'negatife' : 'karışık bir görünüme'} yakın.`,
      latestNews
        ? `Öne çıkan başlık: ${latestNews.title}. ${latestNews.aiCommentary?.summary ?? latestNews.summary}`
        : 'Şu an ilgili varlık için güçlü bir haber başlığı akmıyor.',
      `${buildReasonLabel(flavor)} ${summarizeNews(news)} ${buildToneLead(flavor, getNewsTone(news))} Etkiyi teknik teyitle birlikte okumak daha sağlıklı.`
    ])
  }

  if (intent === 'technical') {
    return joinAnswer([
      `Kısa cevap: teknik görünüm ${insight.tone === 'positive' ? 'görece güçlü' : insight.tone === 'negative' ? 'zayıf ve temkinli' : 'karışık'} duruyor.`,
      `${buildReasonLabel(flavor)} ${priceSummary} ${buildToneLead(flavor, insight.tone)} ${technicalFactors.slice(0, 4).join(' ')}`,
      `${buildWatchLabel(flavor)} ${buildWatchLevels(snapshot, indicators)} Genel yorum: ${insight.summary}`
    ])
  }

  if (intent === 'pattern') {
    return joinAnswer([
      `Kısa cevap: formasyon tarafında ${patterns.some((pattern) => pattern.status === 'confirmed') ? 'teyit alınmış sinyal var' : 'net teyit yok'}.`,
      `${buildReasonLabel(flavor)} ${patternContext} ${buildToneLead(flavor, insight.tone)}`,
      `${buildWatchLabel(flavor)} ${buildWatchLevels(snapshot, indicators)} Formasyonlar tek başına karar vermek için yeterli değildir.`
    ])
  }

  if (intent === 'levels') {
    return joinAnswer([
      `Kısa cevap: en kritik destek ${formatCurrency(indicators.support, snapshot.profile.currency)}, ilk güçlü direnç ${formatCurrency(indicators.resistance, snapshot.profile.currency)}.`,
      `${buildReasonLabel(flavor)} Fiyat bu seviyelere göre ${snapshot.quote.price > indicators.resistance ? 'direnç üstünde' : snapshot.quote.price < indicators.support ? 'destek altında' : 'iki seviye arasında'} kalıyor.`,
      `${buildWatchLabel(flavor)} Ek not: EMA20 ${formatCurrency(indicators.ema20, snapshot.profile.currency)}, SMA50 ${formatCurrency(indicators.sma50, snapshot.profile.currency)}.`
    ])
  }

  if (intent === 'entry') {
    return joinAnswer([
      `Kısa cevap: şu an doğrudan “alınabilir” demek yerine ${entryBias} bir bölgede diyebilirim.`,
      `${buildReasonLabel(flavor)} ${priceSummary} Trend ${indicators.trend === 'bullish' ? 'yukarı' : indicators.trend === 'bearish' ? 'aşağı' : 'yatay'}, RSI ${indicators.rsi.toFixed(1)}, hacim ise ${indicators.volumeTrend === 'rising' ? 'destekleyici' : indicators.volumeTrend === 'falling' ? 'zayıf' : 'dengeye yakın'}.`,
      `${buildWatchLabel(flavor)} ${buildWatchLevels(snapshot, indicators)} Direnç üstü teyit veya destekten net tepki gelmeden agresif yorum yapmak sağlıklı olmaz.`
    ])
  }

  if (intent === 'why_move') {
    return joinAnswer([
      'Kısa cevap: son hareketi en iyi son mumun kapanış biçimi, hacim ve destek-direnç ilişkisi açıklıyor.',
      `${buildReasonLabel(flavor)} ${priceSummary} ${recentMoveSummary} ${buildToneLead(flavor, insight.tone)}`,
      `${buildWatchLabel(flavor)} ${summarizeNews(news)} ${patternContext} ${buildWatchLevels(snapshot, indicators)}`
    ])
  }

  if (intent === 'volume') {
    return joinAnswer([
      `Kısa cevap: hacim tarafı ${indicators.volumeTrend === 'rising' ? 'hareketi destekliyor' : indicators.volumeTrend === 'falling' ? 'zayıf kalıyor' : 'tek başına net sinyal vermiyor'}.`,
      `${buildReasonLabel(flavor)} Mevcut hacim ${formatVolume(snapshot.quote.volume)} ve fiyat değişimi ${formatPercent(snapshot.quote.changePercent)}.`,
      `${buildWatchLabel(flavor)} ${buildWatchLevels(snapshot, indicators)} Hacim artarken kırılım gelirse yorum daha güçlü olur.`
    ])
  }

  if (normalizedQuestion.includes('neden') && normalizedQuestion.includes('dus')) {
    return joinAnswer([
      'Kısa cevap: düşüşün ana sebebi zayıf haber tonu, baskılı teknik görünüm veya destek kaybı olabilir.',
      `${buildReasonLabel(flavor)} ${priceSummary} ${recentMoveSummary} ${technicalFactors.slice(0, 3).join(' ')}`,
      `${buildWatchLabel(flavor)} ${buildWatchLevels(snapshot, indicators)}`
    ])
  }

  return joinAnswer([
    `Kısa cevap: genel görünüm şu an ${insight.title.toLowerCase()} tarafında.`,
    `${buildReasonLabel(flavor)} ${priceSummary} ${recentMoveSummary} ${buildToneLead(flavor, insight.tone)} ${insight.summary}`,
    `${buildWatchLabel(flavor)} ${technicalFactors.slice(0, 4).join(' ')} ${buildWatchLevels(snapshot, indicators)} Bu cevap bilgi amaçlıdır, yatırım tavsiyesi değildir.`
  ])
}
