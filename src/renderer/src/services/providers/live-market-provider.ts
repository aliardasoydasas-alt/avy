import type { NewsItem } from '@shared/types/news'
import type {
  AssetMetrics,
  AssetProfile,
  AssetQuote,
  AssetSnapshot,
  AssetTick,
  CandlePoint,
  MarketOverviewItem,
  Timeframe
} from '@shared/types/market'
import { clamp } from '@renderer/utils/format'
import { buildAssetNewsCommentary } from '@renderer/services/news-ai-service'
import { createId } from '@renderer/utils/id'
import type { MarketDataProvider } from './market-provider'

type ProviderAssetSource = 'binance' | 'midas-us' | 'midas-bist'

interface BinanceExchangeSymbol {
  symbol: string
  status: string
  baseAsset: string
  quoteAsset: string
  isSpotTradingAllowed: boolean
}

interface BinanceExchangeInfoResponse {
  symbols: BinanceExchangeSymbol[]
}

interface BinanceTicker24h {
  symbol: string
  lastPrice: string
  priceChangePercent: string
  quoteVolume: string
  highPrice: string
  lowPrice: string
  openPrice: string
  closeTime: number
}

interface BinanceStreamTicker {
  s: string
  c: string
  P: string
  q: string
  h: string
  l: string
  o: string
  E: number
}

interface ProviderAssetRecord extends MarketOverviewItem {
  source: ProviderAssetSource
  detailUrl?: string
  sourceUrl?: string
  extra?: {
    pairSymbol?: string
    baseAsset?: string
    quoteAsset?: string
  }
}

interface MidasDetailChartSeries {
  values: number[]
  timestamps: number[]
  currencySymbol?: string
}

interface MidasDetailMetadata {
  name?: string
  description?: string
  chartSeries?: MidasDetailChartSeries
}

interface CacheContainer<Value> {
  value?: Value
  expiresAt?: number
  pending?: Promise<Value>
}

interface QuoteHistoryPoint {
  time: string
  price: number
  high: number
  low: number
  volume: number
}

interface YahooChartMeta {
  currency?: string
  regularMarketPrice?: number
  chartPreviousClose?: number
  previousClose?: number
  regularMarketDayHigh?: number
  regularMarketDayLow?: number
  regularMarketVolume?: number
  regularMarketTime?: number
}

interface YahooChartQuoteSet {
  open?: Array<number | null>
  high?: Array<number | null>
  low?: Array<number | null>
  close?: Array<number | null>
  volume?: Array<number | null>
}

interface YahooChartResult {
  meta?: YahooChartMeta
  timestamp?: number[]
  indicators?: {
    quote?: YahooChartQuoteSet[]
  }
}

interface YahooChartResponse {
  chart?: {
    result?: YahooChartResult[]
    error?: {
      description?: string
    }
  }
}

const MIDAS_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
} satisfies Record<string, string>

const BINANCE_API_BASE = 'https://api.binance.com'
const BINANCE_WS_BASE =
  import.meta.env.VITE_CRYPTO_WS_URL ?? 'wss://stream.binance.com:9443/ws'
const MIDAS_BASE = 'https://www.getmidas.com'
const MIDAS_US_LIST_URL = `${MIDAS_BASE}/amerikan-borsasi/`
const MIDAS_BIST_LIST_URL = `${MIDAS_BASE}/canli-borsa/tum-hisseler`
const YAHOO_FINANCE_CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart'
const GOOGLE_NEWS_SEARCH_URL = 'https://news.google.com/rss/search'

const preferredQuoteAssets = ['USDT', 'USDC', 'FDUSD', 'TUSD', 'TRY', 'BTC', 'ETH', 'BNB']
const stableDollarQuotes = new Set(['USDT', 'USDC', 'FDUSD', 'TUSD'])
const NEWS_HEADERS = {
  Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
  'Cache-Control': 'no-cache'
} satisfies Record<string, string>

const YAHOO_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*'
} satisfies Record<string, string>

const timeframeConfig: Record<Timeframe, { binanceInterval: string; points: number; stepHours: number }> = {
  '1s': { binanceInterval: '1s', points: 240, stepHours: 1 / 3600 },
  '1m': { binanceInterval: '1m', points: 240, stepHours: 1 / 60 },
  '5m': { binanceInterval: '5m', points: 240, stepHours: 5 / 60 },
  '15m': { binanceInterval: '15m', points: 240, stepHours: 15 / 60 },
  '1H': { binanceInterval: '1h', points: 240, stepHours: 1 },
  '4H': { binanceInterval: '4h', points: 240, stepHours: 4 },
  '1D': { binanceInterval: '1d', points: 365, stepHours: 24 },
  '1W': { binanceInterval: '1w', points: 260, stepHours: 24 * 7 },
  '1M': { binanceInterval: '1M', points: 180, stepHours: 24 * 30 }
}

const yahooTimeframeConfig: Record<
  Exclude<Timeframe, '1s'>,
  { interval: string; range: string; aggregateBars?: number }
> = {
  '1m': { interval: '1m', range: '7d' },
  '5m': { interval: '5m', range: '1mo' },
  '15m': { interval: '15m', range: '1mo' },
  '1H': { interval: '60m', range: '3mo' },
  '4H': { interval: '60m', range: '6mo', aggregateBars: 4 },
  '1D': { interval: '1d', range: '1y' },
  '1W': { interval: '1wk', range: '5y' },
  '1M': { interval: '1mo', range: '10y' }
}

const topCoinNames: Record<string, string> = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  BNB: 'BNB',
  SOL: 'Solana',
  XRP: 'XRP',
  ADA: 'Cardano',
  DOGE: 'Dogecoin',
  AVAX: 'Avalanche',
  LINK: 'Chainlink',
  SUI: 'Sui',
  TON: 'Toncoin',
  TRX: 'TRON',
  SHIB: 'Shiba Inu',
  PEPE: 'Pepe',
  ARB: 'Arbitrum',
  OP: 'Optimism'
}

const cloneValue = <Value>(value: Value): Value =>
  typeof structuredClone === 'function'
    ? structuredClone(value)
    : (JSON.parse(JSON.stringify(value)) as Value)

const cleanText = (value: string | null | undefined): string =>
  (value ?? '').replace(/\s+/g, ' ').trim()

const normalizeAssetId = (source: ProviderAssetSource, symbol: string): string =>
  `${source}:${symbol.toUpperCase()}`

const quoteAssetToCurrency = (quoteAsset?: string): string => {
  if (!quoteAsset) {
    return 'USD'
  }

  if (stableDollarQuotes.has(quoteAsset)) {
    return 'USD'
  }

  return quoteAsset
}

const parseLooseNumber = (value: string | null | undefined): number => {
  const normalized = cleanText(value)
    .replace(/%/g, '')
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(/,/g, '.')

  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

const parseNumberArrayAttribute = (value: string | null | undefined): number[] => {
  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(value) as number[]
    return parsed.filter((item) => Number.isFinite(item))
  } catch {
    return []
  }
}

const isFiniteNumber = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const getYahooSymbol = (asset: ProviderAssetRecord): string =>
  asset.source === 'midas-bist' ? `${asset.profile.symbol.toUpperCase()}.IS` : asset.profile.symbol.toUpperCase()

const aggregateCandles = (candles: CandlePoint[], aggregateBars = 1): CandlePoint[] => {
  if (aggregateBars <= 1 || candles.length <= aggregateBars) {
    return candles
  }

  const aggregated: CandlePoint[] = []

  for (let index = 0; index < candles.length; index += aggregateBars) {
    const chunk = candles.slice(index, index + aggregateBars)

    if (!chunk.length) {
      continue
    }

    aggregated.push({
      time: chunk[0]!.time,
      open: chunk[0]!.open,
      high: Math.max(...chunk.map((candle) => candle.high)),
      low: Math.min(...chunk.map((candle) => candle.low)),
      close: chunk[chunk.length - 1]!.close,
      volume: chunk.reduce((sum, candle) => sum + candle.volume, 0)
    })
  }

  return aggregated
}

const buildCandlesFromYahooChart = (
  result: YahooChartResult,
  timeframe: Exclude<Timeframe, '1s'>
): CandlePoint[] => {
  const timestamps = result.timestamp ?? []
  const quoteSet = result.indicators?.quote?.[0]

  if (!timestamps.length || !quoteSet) {
    return []
  }

  const candles = timestamps
    .map((timestamp, index) => {
      const open = quoteSet.open?.[index]
      const high = quoteSet.high?.[index]
      const low = quoteSet.low?.[index]
      const close = quoteSet.close?.[index]
      const volume = quoteSet.volume?.[index]

      if (![open, high, low, close].every(isFiniteNumber)) {
        return null
      }

      return {
        time: new Date(timestamp * 1000).toISOString(),
        open,
        high,
        low,
        close,
        volume: isFiniteNumber(volume) ? volume : 0
      } satisfies CandlePoint
    })
    .filter((candle): candle is CandlePoint => Boolean(candle))

  if (!candles.length) {
    return []
  }

  const aggregateBars = yahooTimeframeConfig[timeframe].aggregateBars ?? 1
  return aggregateCandles(candles, aggregateBars)
}

const buildQuoteFromCandles = (
  candles: CandlePoint[],
  meta: YahooChartMeta | undefined,
  fallbackQuote: AssetQuote
): AssetQuote => {
  const latest = candles[candles.length - 1]

  if (!latest) {
    return fallbackQuote
  }

  const previousClose =
    (isFiniteNumber(meta?.chartPreviousClose) ? meta?.chartPreviousClose : undefined) ??
    (isFiniteNumber(meta?.previousClose) ? meta?.previousClose : undefined) ??
    candles[candles.length - 2]?.close ??
    latest.open

  const price =
    (isFiniteNumber(meta?.regularMarketPrice) ? meta?.regularMarketPrice : undefined) ?? latest.close

  return {
    price,
    changePercent: previousClose > 0 ? ((price - previousClose) / previousClose) * 100 : fallbackQuote.changePercent,
    volume:
      (isFiniteNumber(meta?.regularMarketVolume) ? meta?.regularMarketVolume : undefined) ??
      candles.slice(-Math.min(candles.length, 24)).reduce((sum, candle) => sum + candle.volume, 0) ??
      fallbackQuote.volume,
    high24h:
      (isFiniteNumber(meta?.regularMarketDayHigh) ? meta?.regularMarketDayHigh : undefined) ??
      Math.max(...candles.slice(-Math.min(candles.length, 24)).map((candle) => candle.high)),
    low24h:
      (isFiniteNumber(meta?.regularMarketDayLow) ? meta?.regularMarketDayLow : undefined) ??
      Math.min(...candles.slice(-Math.min(candles.length, 24)).map((candle) => candle.low)),
    openPrice: previousClose,
    updatedAt: new Date((meta?.regularMarketTime ?? Date.now() / 1000) * 1000).toISOString(),
    latency: 'delayed'
  }
}

const buildBinanceQuote = (ticker: BinanceTicker24h | BinanceStreamTicker): AssetQuote => {
  const lastPrice = 'lastPrice' in ticker ? ticker.lastPrice : ticker.c
  const changePercent = 'priceChangePercent' in ticker ? ticker.priceChangePercent : ticker.P
  const volume = 'quoteVolume' in ticker ? ticker.quoteVolume : ticker.q
  const highPrice = 'highPrice' in ticker ? ticker.highPrice : ticker.h
  const lowPrice = 'lowPrice' in ticker ? ticker.lowPrice : ticker.l
  const openPrice = 'openPrice' in ticker ? ticker.openPrice : ticker.o
  const timestamp = 'closeTime' in ticker ? ticker.closeTime : ticker.E

  return {
    price: Number.parseFloat(lastPrice),
    changePercent: Number.parseFloat(changePercent),
    volume: Number.parseFloat(volume),
    high24h: Number.parseFloat(highPrice),
    low24h: Number.parseFloat(lowPrice),
    openPrice: Number.parseFloat(openPrice),
    updatedAt: new Date(timestamp || Date.now()).toISOString(),
    latency: 'realtime'
  }
}

const inferCoinName = (baseAsset: string, quoteAsset: string): string =>
  topCoinNames[baseAsset] ?? `${baseAsset} / ${quoteAsset}`

const getSearchScore = (item: MarketOverviewItem, normalizedQuery: string): number => {
  const symbol = item.profile.symbol.toLowerCase()
  const name = item.profile.name.toLowerCase()
  const market = (item.profile.market ?? '').toLowerCase()
  const exchange = item.profile.exchange.toLowerCase()
  const tags = item.profile.tags.join(' ').toLowerCase()
  const assetId = item.assetId.toLowerCase()

  let score = 0

  if (symbol === normalizedQuery) {
    score += 1200
  } else if (symbol.startsWith(normalizedQuery)) {
    score += 800
  } else if (symbol.includes(normalizedQuery)) {
    score += 420
  }

  if (name === normalizedQuery) {
    score += 760
  } else if (name.startsWith(normalizedQuery)) {
    score += 520
  } else if (name.includes(normalizedQuery)) {
    score += 260
  }

  if (assetId.includes(`:${normalizedQuery}`)) {
    score += 260
  }

  if (market.includes(normalizedQuery)) {
    score += 90
  }

  if (exchange.includes(normalizedQuery)) {
    score += 80
  }

  if (tags.includes(normalizedQuery)) {
    score += 120
  }

  return score
}

const getMidasLatencyLabel = (): AssetQuote['latency'] => 'delayed'

const buildMidasDerivedQuote = (
  price: number,
  changePercent: number,
  referenceA: number,
  referenceB: number,
  volume: number
): AssetQuote => {
  const low = [price, referenceA, referenceB].filter((value) => value > 0)
  const high = [price, referenceA, referenceB].filter((value) => value > 0)

  return {
    price,
    changePercent,
    volume,
    high24h: high.length ? Math.max(...high) : price,
    low24h: low.length ? Math.min(...low) : price,
    openPrice: referenceA > 0 ? referenceA : referenceB > 0 ? referenceB : undefined,
    updatedAt: new Date().toISOString(),
    latency: getMidasLatencyLabel()
  }
}

const buildBistQuote = (
  price: number,
  changePercent: number,
  openPrice: number,
  highPrice: number,
  lowPrice: number,
  volumeLot: number
): AssetQuote => ({
  price,
  changePercent,
  volume: volumeLot,
  high24h: highPrice || price,
  low24h: lowPrice || price,
  openPrice,
  updatedAt: new Date().toISOString(),
  latency: getMidasLatencyLabel()
})

const hashString = (value: string): number =>
  Array.from(value).reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0)

const buildDerivedCandles = (
  assetId: string,
  quote: AssetQuote,
  timeframe: Timeframe
): CandlePoint[] => {
  const { points, stepHours } = timeframeConfig[timeframe]
  const now = Date.now()
  const highBound = Math.max(quote.high24h || quote.price, quote.price, quote.openPrice ?? quote.price)
  const lowBound = Math.min(quote.low24h || quote.price, quote.price, quote.openPrice ?? quote.price)
  const range = Math.max(Math.abs(highBound - lowBound), quote.price * 0.015)
  const originPrice =
    quote.openPrice && quote.openPrice > 0
      ? quote.openPrice
      : quote.price / Math.max(0.01, 1 + quote.changePercent / 100)
  const seed = hashString(assetId)
  const candles: CandlePoint[] = []

  let previousClose = originPrice

  for (let index = 0; index < points; index += 1) {
    const progress = points === 1 ? 1 : index / (points - 1)
    const baseline = originPrice + (quote.price - originPrice) * progress
    const wavePrimary = Math.sin(seed * 0.017 + progress * Math.PI * 2.6) * range * 0.16
    const waveSecondary = Math.cos(seed * 0.011 + progress * Math.PI * 6.1) * range * 0.05
    const driftedClose = baseline + wavePrimary + waveSecondary
    const close = clamp(driftedClose, lowBound, highBound)
    const open = previousClose
    const wick = range * (0.018 + ((index + seed) % 7) * 0.0025)
    const high = clamp(Math.max(open, close) + wick, lowBound, highBound)
    const low = clamp(Math.min(open, close) - wick, lowBound, highBound)
    const time = new Date(now - (points - index) * stepHours * 60 * 60 * 1000).toISOString()

    candles.push({
      time,
      open,
      high,
      low,
      close,
      volume: quote.volume / Math.max(points, 1)
    })

    previousClose = close
  }

  const lastCandle = candles[candles.length - 1]

  if (lastCandle) {
    lastCandle.close = quote.price
    lastCandle.high = clamp(Math.max(lastCandle.high, quote.price), lowBound, highBound)
    lastCandle.low = clamp(Math.min(lastCandle.low, quote.price), lowBound, highBound)
  }

  return candles
}

const buildWeightedVolumeProfile = (
  values: number[],
  totalVolume: number
): number[] => {
  if (!values.length) {
    return []
  }

  const safeTotalVolume = Number.isFinite(totalVolume) && totalVolume > 0 ? totalVolume : values.length
  const weights = values.map((value, index) => {
    const previousValue = values[index - 1] ?? value
    const nextValue = values[index + 1] ?? value
    const movementWeight =
      Math.abs(value - previousValue) + Math.abs(nextValue - value) + Math.max(Math.abs(value) * 0.00035, 1)

    return Math.max(movementWeight, 1)
  })
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1

  return weights.map((weight) => (safeTotalVolume * weight) / totalWeight)
}

const buildIntervalVolumes = (history: QuoteHistoryPoint[]): number[] =>
  history.map((point, index) => {
    if (index === 0) {
      return Math.max(point.volume / Math.max(history.length, 1), 0)
    }

    const previousPoint = history[index - 1]
    const delta = point.volume - previousPoint.volume

    if (delta >= 0) {
      return delta
    }

    return Math.max(point.volume / Math.max(history.length, 1), 0)
  })

const remapVolumeProfile = (
  sourceVolumes: number[],
  targetLength: number,
  fallbackTotalVolume: number
): number[] => {
  if (!targetLength) {
    return []
  }

  if (!sourceVolumes.length) {
    return new Array(targetLength).fill(Math.max(fallbackTotalVolume / Math.max(targetLength, 1), 0))
  }

  if (sourceVolumes.length === targetLength) {
    return sourceVolumes
  }

  return Array.from({ length: targetLength }, (_, index) => {
    if (targetLength === 1) {
      return sourceVolumes[sourceVolumes.length - 1] ?? 0
    }

    const ratio = index / (targetLength - 1)
    const sourceIndex = Math.round(ratio * (sourceVolumes.length - 1))
    return sourceVolumes[sourceIndex] ?? sourceVolumes[sourceVolumes.length - 1] ?? 0
  })
}

const buildCandlesFromPriceSeries = (
  series: MidasDetailChartSeries,
  quote: AssetQuote,
  timeframe: Timeframe
): CandlePoint[] => {
  const rawPoints = series.values
    .map((value, index) => ({
      value,
      timestamp: series.timestamps[index]
    }))
    .filter((point) => Number.isFinite(point.value) && Number.isFinite(point.timestamp))

  if (rawPoints.length < 8) {
    return []
  }

  const maxPoints =
    timeframe === '1m'
      ? 180
      : timeframe === '5m'
        ? 180
        : timeframe === '15m'
          ? 180
          : timeframe === '1H'
            ? 120
            : timeframe === '4H'
              ? 180
              : timeframe === '1D'
                ? 240
                : timeframe === '1W'
                  ? 320
                  : 180

  const points = rawPoints.slice(-maxPoints)
  const quoteRange = Math.max(Math.abs(quote.high24h - quote.low24h), quote.price * 0.003)
  const volumeProfile = buildWeightedVolumeProfile(
    points.map((point) => point.value),
    quote.volume
  )

  return points.map((point, index) => {
    const previousValue = points[index - 1]?.value ?? point.value
    const nextValue = points[index + 1]?.value ?? point.value
    const localSwing = Math.max(
      Math.abs(point.value - previousValue),
      Math.abs(nextValue - point.value),
      quoteRange * 0.08
    )
    const wickSize = localSwing * 0.35

    return {
      time: new Date(point.timestamp).toISOString(),
      open: previousValue,
      high: Math.max(previousValue, point.value) + wickSize,
      low: Math.min(previousValue, point.value) - wickSize,
      close: point.value,
      volume: volumeProfile[index] ?? quote.volume / Math.max(points.length, 1)
    }
  })
}

const buildCandlesFromQuoteHistory = (
  history: QuoteHistoryPoint[]
): CandlePoint[] => {
  const intervalVolumes = buildIntervalVolumes(history)

  return history.map((point, index) => {
    const previous = history[index - 1]?.price ?? point.price
    const next = history[index + 1]?.price ?? point.price
    const wickPadding = Math.max(Math.abs(next - previous), point.price * 0.0015)

    return {
      time: point.time,
      open: previous,
      high: Math.max(point.high, previous, point.price) + wickPadding * 0.25,
      low: Math.min(point.low, previous, point.price) - wickPadding * 0.25,
      close: point.price,
      volume: intervalVolumes[index] ?? 0
    }
  })
}

const createMetrics = (quote: AssetQuote, marketCap?: number): AssetMetrics => {
  const priceRangePercent =
    quote.price > 0 ? ((quote.high24h - quote.low24h) / quote.price) * 100 : 0

  return {
    marketCap,
    volatility: Number.parseFloat(priceRangePercent.toFixed(2)),
    sentimentScore: Math.round(clamp(50 + quote.changePercent * 3, 10, 90))
  }
}

const getFetchJson = async <Value>(
  url: string,
  headers?: Record<string, string>
): Promise<Value> => {
  if (window.desktopAPI?.fetchJson) {
    return window.desktopAPI.fetchJson<Value>(url, { headers })
  }

  const response = await fetch(url, { headers })

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}: ${url}`)
  }

  return response.json() as Promise<Value>
}

const getFetchText = async (
  url: string,
  headers?: Record<string, string>
): Promise<string> => {
  if (window.desktopAPI?.fetchText) {
    return window.desktopAPI.fetchText(url, { headers })
  }

  const response = await fetch(url, { headers })

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}: ${url}`)
  }

  return response.text()
}

const parseHtml = (html: string): Document =>
  new DOMParser().parseFromString(html, 'text/html')

const parseXml = (xml: string): Document =>
  new DOMParser().parseFromString(xml, 'text/xml')

const stripHtml = (value: string): string =>
  new DOMParser().parseFromString(value, 'text/html').body.textContent?.replace(/\s+/g, ' ').trim() ?? ''

const tokenizeName = (value: string): string[] =>
  value
    .split(/[^A-Za-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)

const buildAssetNewsSearchUrls = (asset: ProviderAssetRecord): string[] => {
  const { symbol, name } = asset.profile
  const pairSymbol = asset.extra?.pairSymbol ?? symbol
  const queryTemplates =
    asset.source === 'binance'
      ? [
          `("${symbol}" OR "${name}" OR "${pairSymbol}") (crypto OR token OR binance OR market) when:7d`,
          `("${name}" OR "${symbol}") (altcoin OR bitcoin OR ethereum OR market) when:7d`
        ]
      : asset.source === 'midas-bist'
        ? [
            `("${symbol}" OR "${name}") (borsa OR hisse OR sirket OR bilanco OR market) when:7d`,
            `("${symbol}" OR "${name}") (stock OR shares OR earnings) when:7d`
          ]
        : [
            `("${symbol}" OR "${name}") (stock OR shares OR earnings OR market) when:7d`,
            `("${symbol}" OR "${name}") (nasdaq OR nyse OR market) when:7d`
          ]

  return queryTemplates.map(
    (query) => `${GOOGLE_NEWS_SEARCH_URL}?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`
  )
}

const isRelevantNewsItem = (
  asset: ProviderAssetRecord,
  title: string,
  summary: string,
  source: string
): boolean => {
  const text = `${title} ${summary} ${source}`.toLowerCase()
  const directTokens = [asset.profile.symbol, asset.profile.name, asset.extra?.pairSymbol ?? '']
    .map((token) => token.toLowerCase())
    .filter(Boolean)
  const nameTokens = tokenizeName(asset.profile.name.toLowerCase())

  return [...directTokens, ...nameTokens].some((token) => text.includes(token))
}

const inferNewsImportance = (
  title: string,
  summary: string,
  publishedAt: string
): NewsItem['importance'] => {
  const text = `${title} ${summary}`.toLowerCase()
  const hoursSincePublished =
    Math.abs(Date.now() - new Date(publishedAt).getTime()) / 3_600_000

  if (
    text.includes('earnings') ||
    text.includes('fed') ||
    text.includes('guidance') ||
    text.includes('binance') ||
    text.includes('etf') ||
    text.includes('inflation') ||
    text.includes('war')
  ) {
    return 'high'
  }

  if (hoursSincePublished <= 16) {
    return 'medium'
  }

  return 'low'
}

const buildAssetNewsDetails = (summary: string, title: string): string => {
  const normalizedSummary = cleanText(summary)
  return normalizedSummary || title
}

const normalizeNewsTitle = (rawTitle: string, sourceTag?: string): string => {
  const cleaned = cleanText(rawTitle)

  if (!cleaned) {
    return ''
  }

  if (sourceTag && cleaned.toLowerCase().endsWith(` - ${sourceTag.toLowerCase()}`)) {
    return cleaned.slice(0, cleaned.length - sourceTag.length - 3).trim()
  }

  return cleaned
}

const dedupeNewsItems = (items: NewsItem[]): NewsItem[] => {
  const seen = new Set<string>()

  return items.filter((item) => {
    const key = `${item.title.toLowerCase()}|${item.source.toLowerCase()}|${item.url}`.trim()

    if (!key || seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

class LiveMarketProvider implements MarketDataProvider {
  private assetMap = new Map<string, ProviderAssetRecord>()
  private detailMetadataCache = new Map<string, MidasDetailMetadata>()
  private cacheRegistry = new Map<string, CacheContainer<ProviderAssetRecord[]>>()
  private newsCache = new Map<string, CacheContainer<NewsItem[]>>()
  private quoteHistoryCache = new Map<string, QuoteHistoryPoint[]>()

  private recordQuoteHistory(assetId: string, quote: AssetQuote): void {
    if (!Number.isFinite(quote.price) || quote.price <= 0) {
      return
    }

    const history = this.quoteHistoryCache.get(assetId) ?? []
    const point: QuoteHistoryPoint = {
      time: quote.updatedAt || new Date().toISOString(),
      price: quote.price,
      high: quote.high24h || quote.price,
      low: quote.low24h || quote.price,
      volume: quote.volume
    }
    const lastPoint = history[history.length - 1]

    if (lastPoint && Math.abs(new Date(lastPoint.time).getTime() - new Date(point.time).getTime()) < 15_000) {
      history[history.length - 1] = point
    } else {
      history.push(point)
    }

    this.quoteHistoryCache.set(assetId, history.slice(-720))
  }

  private getQuoteHistoryCandles(assetId: string, timeframe: Timeframe): CandlePoint[] {
    const history = this.quoteHistoryCache.get(assetId) ?? []
    const limit =
      timeframe === '1m'
        ? 180
        : timeframe === '5m'
          ? 240
          : timeframe === '15m'
            ? 280
            : timeframe === '1H'
              ? 180
              : timeframe === '4H'
                ? 240
                : timeframe === '1D'
                  ? 320
                  : timeframe === '1W'
                    ? 420
                    : 180

    if (history.length < 8) {
      return []
    }

    return buildCandlesFromQuoteHistory(history.slice(-limit))
  }

  private async loadCached(
    key: string,
    ttlMs: number,
    loader: () => Promise<ProviderAssetRecord[]>,
    force = false
  ): Promise<ProviderAssetRecord[]> {
    const cached = this.cacheRegistry.get(key) ?? {}

    if (!force && cached.value && (cached.expiresAt ?? 0) > Date.now()) {
      return cloneValue(cached.value)
    }

    if (cached.pending) {
      return cloneValue(await cached.pending)
    }

    const pending = loader()
      .then((items) => {
        this.cacheRegistry.set(key, {
          value: items,
          expiresAt: Date.now() + ttlMs
        })
        items.forEach((item) => {
          this.assetMap.set(item.assetId, item)
          this.recordQuoteHistory(item.assetId, item.quote)
        })
        return items
      })
      .finally(() => {
        const latest = this.cacheRegistry.get(key)
        if (latest) {
          delete latest.pending
        }
      })

    this.cacheRegistry.set(key, {
      ...cached,
      pending
    })

    return cloneValue(await pending)
  }

  private async loadBinanceOverview(force = false): Promise<ProviderAssetRecord[]> {
    return this.loadCached(
      'binance-overview',
      60_000,
      async () => {
        const [exchangeInfo, tickers] = await Promise.all([
          getFetchJson<BinanceExchangeInfoResponse>(`${BINANCE_API_BASE}/api/v3/exchangeInfo`),
          getFetchJson<BinanceTicker24h[]>(`${BINANCE_API_BASE}/api/v3/ticker/24hr`)
        ])

        const tickerMap = new Map(tickers.map((ticker) => [ticker.symbol, ticker]))
        const selectedByBase = new Map<string, ProviderAssetRecord>()

        exchangeInfo.symbols
          .filter((symbol) => symbol.status === 'TRADING' && symbol.isSpotTradingAllowed)
          .forEach((symbol) => {
            const ticker = tickerMap.get(symbol.symbol)
            if (!ticker) {
              return
            }

            const rank = preferredQuoteAssets.indexOf(symbol.quoteAsset)
            if (rank === -1) {
              return
            }

            const assetId = normalizeAssetId('binance', symbol.symbol)
            const quote = buildBinanceQuote(ticker)
            const candidate: ProviderAssetRecord = {
              assetId,
              source: 'binance',
              profile: {
                id: assetId,
                symbol: symbol.baseAsset,
                name: inferCoinName(symbol.baseAsset, symbol.quoteAsset),
                class: 'crypto',
                exchange: 'Binance',
                currency: quoteAssetToCurrency(symbol.quoteAsset),
                description: `${symbol.baseAsset}, Binance resmi spot paritesinden canli olarak izleniyor.`,
                tags: ['Binance', 'Kripto', symbol.quoteAsset],
                provider: 'binance',
                market: 'spot',
                sourceUrl: `${BINANCE_API_BASE}/api/v3/ticker/24hr?symbol=${symbol.symbol}`
              },
              quote,
              extra: {
                pairSymbol: symbol.symbol,
                baseAsset: symbol.baseAsset,
                quoteAsset: symbol.quoteAsset
              }
            }

            const existing = selectedByBase.get(symbol.baseAsset)

            if (!existing) {
              selectedByBase.set(symbol.baseAsset, candidate)
              return
            }

            const existingRank = preferredQuoteAssets.indexOf(existing.extra?.quoteAsset ?? '')
            const existingVolume = existing.quote.volume
            const candidateVolume = candidate.quote.volume

            if (rank < existingRank || (rank === existingRank && candidateVolume > existingVolume)) {
              selectedByBase.set(symbol.baseAsset, candidate)
            }
          })

        return Array.from(selectedByBase.values()).sort((left, right) => right.quote.volume - left.quote.volume)
      },
      force
    )
  }

  private parseMidasUsOverview(html: string): ProviderAssetRecord[] {
    const document = parseHtml(html)
    const rows = Array.from(document.querySelectorAll('tbody.table-body tr.table-row'))

    return rows
      .map((row) => {
        const cells = Array.from(row.querySelectorAll('td'))
        const symbolAnchor = row.querySelector<HTMLAnchorElement>('a.stock-code')
        const symbol = cleanText(symbolAnchor?.textContent)

        if (!symbol || cells.length < 5) {
          return null
        }

        const price = parseLooseNumber(cells[1]?.textContent)
        const changePercent = parseLooseNumber(cells[2]?.textContent)
        const referenceA = parseLooseNumber(cells[3]?.textContent)
        const referenceB = parseLooseNumber(cells[4]?.textContent)
        const volume = parseLooseNumber(cells[5]?.textContent)
        const assetId = normalizeAssetId('midas-us', symbol)
        const detailUrl = `${MIDAS_BASE}${symbolAnchor?.getAttribute('href') ?? ''}`
        const quote = buildMidasDerivedQuote(price, changePercent, referenceA, referenceB, volume)

        return {
          assetId,
          source: 'midas-us',
          profile: {
            id: assetId,
            symbol,
            name: symbol,
            class: 'stock',
            exchange: 'Midas ABD',
            currency: 'USD',
            description: `${symbol} fiyatlari, Midas'in resmi ABD hisse sayfasindan aliniyor.`,
            tags: ['Midas', 'ABD'],
            provider: 'midas',
            market: 'us',
            detailUrl,
            sourceUrl: detailUrl
          },
          quote
        } satisfies ProviderAssetRecord
      })
      .filter((item): item is ProviderAssetRecord => Boolean(item))
  }

  private parseMidasBistOverview(html: string): ProviderAssetRecord[] {
    const document = parseHtml(html)
    const rows = Array.from(document.querySelectorAll('tbody.table-body tr.table-row'))

    return rows
      .map((row) => {
        const cells = Array.from(row.querySelectorAll('td'))
        const symbolAnchor = row.querySelector<HTMLAnchorElement>('a.stock-code')
        const symbol = cleanText(symbolAnchor?.textContent)

        if (!symbol || cells.length < 10) {
          return null
        }

        const price = parseLooseNumber(cells[1]?.textContent)
        const changePercent = parseLooseNumber(cells[4]?.textContent)
        const openPrice = parseLooseNumber(cells[5]?.textContent)
        const highPrice = parseLooseNumber(cells[6]?.textContent)
        const lowPrice = parseLooseNumber(cells[7]?.textContent)
        const volumeLot = parseLooseNumber(cells[9]?.textContent)
        const assetId = normalizeAssetId('midas-bist', symbol)
        const detailUrl = `${MIDAS_BASE}${symbolAnchor?.getAttribute('href') ?? ''}`
        const quote = buildBistQuote(price, changePercent, openPrice, highPrice, lowPrice, volumeLot)

        return {
          assetId,
          source: 'midas-bist',
          profile: {
            id: assetId,
            symbol,
            name: symbol,
            class: 'stock',
            exchange: 'Midas BIST',
            currency: 'TRY',
            description: `${symbol} fiyatlari, Midas'in resmi BIST sayfasindan aliniyor.`,
            tags: ['Midas', 'BIST'],
            provider: 'midas',
            market: 'bist',
            detailUrl,
            sourceUrl: detailUrl
          },
          quote
        } satisfies ProviderAssetRecord
      })
      .filter((item): item is ProviderAssetRecord => Boolean(item))
  }

  private async loadMidasUsOverview(force = false): Promise<ProviderAssetRecord[]> {
    return this.loadCached(
      'midas-us-overview',
      120_000,
      async () => {
        const html = await getFetchText(MIDAS_US_LIST_URL, MIDAS_HEADERS)
        return this.parseMidasUsOverview(html)
      },
      force
    )
  }

  private async loadMidasBistOverview(force = false): Promise<ProviderAssetRecord[]> {
    return this.loadCached(
      'midas-bist-overview',
      120_000,
      async () => {
        const html = await getFetchText(MIDAS_BIST_LIST_URL, MIDAS_HEADERS)
        return this.parseMidasBistOverview(html)
      },
      force
    )
  }

  private async ensureAssetRecord(assetId: string): Promise<ProviderAssetRecord> {
    const cached = this.assetMap.get(assetId)

    if (cached) {
      return cloneValue(cached)
    }

    await this.getOverview()

    const resolved = this.assetMap.get(assetId)

    if (!resolved) {
      throw new Error(`Asset not found: ${assetId}`)
    }

    return cloneValue(resolved)
  }

  private async getMidasDetailMetadata(asset: ProviderAssetRecord): Promise<MidasDetailMetadata> {
    const detailUrl = asset.detailUrl ?? asset.profile.detailUrl

    if (!detailUrl) {
      return {}
    }

    const cached = this.detailMetadataCache.get(detailUrl)

    if (cached) {
      return cached
    }

    try {
      const html = await getFetchText(detailUrl, MIDAS_HEADERS)
      const document = parseHtml(html)
      const title = cleanText(document.querySelector('title')?.textContent)
      const description =
        document
          .querySelector('meta[name="description"]')
          ?.getAttribute('content')
          ?.trim() ?? ''
      const chartCanvas = document.querySelector<HTMLCanvasElement>('canvas#line-chart, canvas.abd-line-chart')
      const chartSeries =
        chartCanvas
          ? {
              values: parseNumberArrayAttribute(chartCanvas.getAttribute('data-val')),
              timestamps: parseNumberArrayAttribute(chartCanvas.getAttribute('data-dates')),
              currencySymbol: chartCanvas.getAttribute('data-curr') ?? undefined
            }
          : undefined

      const match = title.match(/&\s*(.+?)\s*-\s*Midas/i)
      const metadata: MidasDetailMetadata = {
        name: match?.[1]?.trim() || asset.profile.name,
        description: description || asset.profile.description,
        chartSeries:
          chartSeries &&
          chartSeries.values.length > 8 &&
          chartSeries.values.length === chartSeries.timestamps.length
            ? chartSeries
            : undefined
      }

      this.detailMetadataCache.set(detailUrl, metadata)
      return metadata
    } catch {
      return {}
    }
  }

  private async buildStockSnapshotFromYahoo(
    asset: ProviderAssetRecord,
    timeframe: Exclude<Timeframe, '1s'>,
    metadata?: MidasDetailMetadata
  ): Promise<AssetSnapshot> {
    const yahooSymbol = getYahooSymbol(asset)
    const config = yahooTimeframeConfig[timeframe]
    const url = `${YAHOO_FINANCE_CHART_BASE}/${encodeURIComponent(yahooSymbol)}?interval=${config.interval}&range=${config.range}&includePrePost=false&events=div%2Csplits`
    const response = await getFetchJson<YahooChartResponse>(url, YAHOO_HEADERS)
    const result = response.chart?.result?.[0]

    if (!result) {
      throw new Error(response.chart?.error?.description ?? `Yahoo chart data not found for ${yahooSymbol}`)
    }

    const candles = buildCandlesFromYahooChart(result, timeframe)

    if (candles.length < 8) {
      throw new Error(`Yahoo chart data is too short for ${yahooSymbol}`)
    }

    const quote = buildQuoteFromCandles(candles, result.meta, asset.quote)
    const snapshot: AssetSnapshot = {
      profile: {
        ...asset.profile,
        name: metadata?.name ?? asset.profile.name,
        description:
          metadata?.description ??
          `${asset.profile.symbol} icin OHLC mum verileri Yahoo Finance chart akisi ile olusturuluyor.`
      },
      quote,
      candles,
      overview:
        'Hisse grafigi dogrudan OHLC veri serisinden kuruluyor. Mumlar yapay uretim degil; acilis, yuksek, dusuk ve kapanis degerleri zaman serisinden geliyor.',
      metrics: createMetrics(quote),
      syntheticHistory: false
    }

    this.assetMap.set(asset.assetId, {
      ...asset,
      quote: snapshot.quote
    })

    return snapshot
  }

  private async buildBinanceSnapshot(
    asset: ProviderAssetRecord,
    timeframe: Timeframe
  ): Promise<AssetSnapshot> {
    const pairSymbol = asset.extra?.pairSymbol

    if (!pairSymbol) {
      throw new Error(`Missing Binance symbol for ${asset.assetId}`)
    }

    const [ticker, klines] = await Promise.all([
      getFetchJson<BinanceTicker24h>(`${BINANCE_API_BASE}/api/v3/ticker/24hr?symbol=${pairSymbol}`),
      getFetchJson<Array<[number, string, string, string, string, string]>>(
        `${BINANCE_API_BASE}/api/v3/klines?symbol=${pairSymbol}&interval=${timeframeConfig[timeframe].binanceInterval}&limit=${timeframeConfig[timeframe].points}`
      )
    ])

    const quote = buildBinanceQuote(ticker)
    const candles: CandlePoint[] = klines.map((entry) => ({
      time: new Date(entry[0]).toISOString(),
      open: Number.parseFloat(entry[1]),
      high: Number.parseFloat(entry[2]),
      low: Number.parseFloat(entry[3]),
      close: Number.parseFloat(entry[4]),
      volume: Number.parseFloat(entry[5])
    }))

    const snapshot: AssetSnapshot = {
      profile: {
        ...asset.profile,
        description: `${asset.profile.name} icin fiyat, hacim ve mum verileri Binance resmi REST ve websocket servislerinden geliyor.`
      },
      quote,
      candles,
      overview:
        'Canli Binance verisi aktif. Fiyat, 24s degisim, hacim ve mum verileri dogrudan Binance resmi servislerinden geliyor.',
      metrics: createMetrics(quote),
      syntheticHistory: false
    }

    this.assetMap.set(asset.assetId, {
      ...asset,
      quote: snapshot.quote
    })

    return snapshot
  }

  private async buildMidasSnapshot(
    asset: ProviderAssetRecord,
    timeframe: Timeframe
  ): Promise<AssetSnapshot> {
    const metadata = await this.getMidasDetailMetadata(asset)

    if (timeframe !== '1s') {
      try {
        return await this.buildStockSnapshotFromYahoo(asset, timeframe, metadata)
      } catch (error) {
        console.warn('Yahoo stock chart fallback engaged', asset.assetId, timeframe, error)
      }
    }

    const quote = asset.quote
    const baseChartCandles = metadata.chartSeries
      ? buildCandlesFromPriceSeries(metadata.chartSeries, quote, timeframe)
      : []
    const quoteHistoryCandles = this.getQuoteHistoryCandles(asset.assetId, timeframe)
    const remappedHistoryVolumes = remapVolumeProfile(
      quoteHistoryCandles.map((candle) => candle.volume),
      baseChartCandles.length,
      quote.volume
    )
    const chartCandles = baseChartCandles.map((candle, index) => ({
      ...candle,
      volume: remappedHistoryVolumes[index] ?? candle.volume
    }))
    const preferredCandles =
      chartCandles.length >= 8 ? chartCandles : quoteHistoryCandles.length >= 8 ? quoteHistoryCandles : []
    const hasLiveSeries = preferredCandles.length >= 8

    return {
      profile: {
        ...asset.profile,
        name: metadata.name ?? asset.profile.name,
        description: metadata.description ?? asset.profile.description
      },
      quote,
      candles: hasLiveSeries ? preferredCandles : buildDerivedCandles(asset.assetId, quote, timeframe),
      overview:
        chartCandles.length >= 8
          ? 'Midas resmi detay sayfasindaki fiyat serisi kullaniliyor. Hisse grafigi public sayfadaki gercek veri noktalarindan olusturuluyor.'
          : quoteHistoryCandles.length >= 8
            ? 'Midas canli fiyat akisi birikimli quote gecmisi ile grafige donusturuluyor. Yeni fiyatlar geldikce grafik guncellenir.'
            : 'Midas resmi piyasa sayfasi baglandi. Fiyatlar Midas kaynagindan gelir; grafik ise yeterli seri birikene kadar canli quote tabanli onizleme kullanir.',
      metrics: createMetrics(quote),
      syntheticHistory: !hasLiveSeries
    }
  }

  private async fetchAssetNews(asset: ProviderAssetRecord): Promise<NewsItem[]> {
    for (const url of buildAssetNewsSearchUrls(asset)) {
      try {
        const xml = await getFetchText(url, NEWS_HEADERS)
        const document = parseXml(xml)

        if (document.querySelector('parsererror')) {
          continue
        }

        const items = Array.from(document.querySelectorAll('item'))
          .map((item, index) => {
            const rawTitle = item.querySelector('title')?.textContent?.trim() ?? ''
            const rawDescription = item.querySelector('description')?.textContent?.trim() ?? ''
            const sourceTag = item.querySelector('source')?.textContent?.trim()
            const title = normalizeNewsTitle(rawTitle, sourceTag)
            const summarySource = stripHtml(rawDescription) || title
            const sourceFromTitle = rawTitle.includes(' - ') ? rawTitle.split(' - ').at(-1)?.trim() : undefined
            const source = sourceTag || sourceFromTitle || asset.profile.exchange
            const url = item.querySelector('link')?.textContent?.trim() ?? ''
            const publishedAt = new Date(
              item.querySelector('pubDate')?.textContent?.trim() ?? new Date().toUTCString()
            ).toISOString()

            if (!title || !url || !isRelevantNewsItem(asset, title, summarySource, source)) {
              return null
            }

            return {
              id: createId(`news-${asset.profile.symbol}-${index}`),
              assetId: asset.assetId,
              title,
              source,
              publishedAt,
              summary: summarySource,
              details: buildAssetNewsDetails(summarySource, title),
              url,
              importance: inferNewsImportance(title, summarySource, publishedAt),
              aiCommentary: buildAssetNewsCommentary(asset.profile.symbol, title, summarySource)
            } satisfies NewsItem
          })
          .filter((newsItem): newsItem is NewsItem => Boolean(newsItem))

        const distinctItems = dedupeNewsItems(items)

        if (distinctItems.length) {
          return distinctItems.slice(0, 6)
        }
      } catch (error) {
        console.warn('Asset news feed fetch failed', asset.assetId, url, error)
      }
    }

    return []
  }

  private async loadAssetNews(asset: ProviderAssetRecord): Promise<NewsItem[]> {
    const key = asset.assetId
    const cached = this.newsCache.get(key) ?? {}

    if (cached.value && (cached.expiresAt ?? 0) > Date.now()) {
      return cloneValue(cached.value)
    }

    if (cached.pending) {
      return cloneValue(await cached.pending)
    }

    const pending = this.fetchAssetNews(asset)
      .then((items) => {
        this.newsCache.set(key, {
          value: items,
          expiresAt: Date.now() + 1000 * 60 * 10
        })
        return items
      })
      .finally(() => {
        const latest = this.newsCache.get(key)
        if (latest) {
          delete latest.pending
        }
      })

    this.newsCache.set(key, {
      ...cached,
      pending
    })

    return cloneValue(await pending)
  }

  async getOverview(): Promise<MarketOverviewItem[]> {
    const results = await Promise.allSettled([
      this.loadBinanceOverview(),
      this.loadMidasUsOverview(),
      this.loadMidasBistOverview()
    ])

    const items = results.flatMap((result) =>
      result.status === 'fulfilled' ? result.value : []
    )

    if (items.length === 0) {
      throw new Error('Canli veri kaynaklarina su anda ulasilamiyor.')
    }

    return cloneValue(
      items.sort((left, right) => right.quote.volume - left.quote.volume)
    )
  }

  async searchAssets(query: string): Promise<MarketOverviewItem[]> {
    const normalized = query.trim().toLowerCase()
    const allItems = await this.getOverview()

    if (!normalized) {
      return allItems
    }

    return allItems
      .map((item) => ({
        item,
        score: getSearchScore(item, normalized)
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score
        }

        return right.item.quote.volume - left.item.quote.volume
      })
      .map((entry) => entry.item)
  }

  async getAssetDetail(assetId: string, timeframe: Timeframe): Promise<AssetSnapshot> {
    const asset = await this.ensureAssetRecord(assetId)

    if (asset.source === 'binance') {
      return this.buildBinanceSnapshot(asset, timeframe)
    }

    return this.buildMidasSnapshot(asset, timeframe)
  }

  async getNews(assetId: string): Promise<NewsItem[]> {
    const asset = await this.ensureAssetRecord(assetId)
    return this.loadAssetNews(asset)
  }

  subscribe(assetIds: string[], onTick: (tick: AssetTick) => void): () => void {
    const uniqueAssetIds = Array.from(new Set(assetIds))
    const binanceAssets = uniqueAssetIds
      .map((assetId) => this.assetMap.get(assetId))
      .filter((asset): asset is ProviderAssetRecord => Boolean(asset && asset.source === 'binance'))
    const midasUsAssets = uniqueAssetIds
      .map((assetId) => this.assetMap.get(assetId))
      .filter((asset): asset is ProviderAssetRecord => Boolean(asset && asset.source === 'midas-us'))
    const midasBistAssets = uniqueAssetIds
      .map((assetId) => this.assetMap.get(assetId))
      .filter((asset): asset is ProviderAssetRecord => Boolean(asset && asset.source === 'midas-bist'))

    const stopHandlers: Array<() => void> = []

    if (binanceAssets.length) {
      const streams = binanceAssets
        .map((asset) => `${asset.extra?.pairSymbol?.toLowerCase()}@ticker`)
        .filter(Boolean)
        .join('/')

      if (streams) {
        const socket = new WebSocket(`${BINANCE_WS_BASE.replace(/\/ws$/, '')}/stream?streams=${streams}`)

        socket.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data) as { data?: BinanceStreamTicker }
            const ticker = payload.data

            if (!ticker) {
              return
            }

            const asset = binanceAssets.find((item) => item.extra?.pairSymbol === ticker.s)

            if (!asset) {
              return
            }

            const quote = buildBinanceQuote(ticker)
            this.assetMap.set(asset.assetId, {
              ...asset,
              quote
            })
            onTick({
              assetId: asset.assetId,
              quote
            })
          } catch {
            return
          }
        }

        stopHandlers.push(() => socket.close())
      }
    }

    const needsMidasPolling = midasUsAssets.length > 0 || midasBistAssets.length > 0

    if (needsMidasPolling) {
      let polling = false
      const poll = async () => {
        if (polling) {
          return
        }

        polling = true

        try {
          if (midasUsAssets.length) {
            const refreshed = await this.loadMidasUsOverview(true)
            const refreshedMap = new Map(refreshed.map((item) => [item.assetId, item]))

            midasUsAssets.forEach((asset) => {
              const latest = refreshedMap.get(asset.assetId)

              if (!latest) {
                return
              }

              onTick({
                assetId: latest.assetId,
                quote: latest.quote
              })
              this.recordQuoteHistory(latest.assetId, latest.quote)
            })
          }

          if (midasBistAssets.length) {
            const refreshed = await this.loadMidasBistOverview(true)
            const refreshedMap = new Map(refreshed.map((item) => [item.assetId, item]))

            midasBistAssets.forEach((asset) => {
              const latest = refreshedMap.get(asset.assetId)

              if (!latest) {
                return
              }

              onTick({
                assetId: latest.assetId,
                quote: latest.quote
              })
              this.recordQuoteHistory(latest.assetId, latest.quote)
            })
          }
        } finally {
          polling = false
        }
      }

      void poll()
      const timer = window.setInterval(() => {
        void poll()
      }, 30_000)

      stopHandlers.push(() => window.clearInterval(timer))
    }

    return () => {
      stopHandlers.forEach((stop) => stop())
    }
  }
}

export const liveMarketProvider = new LiveMarketProvider()
