import type {
  AssetClass,
  AssetProfile,
  AssetQuote,
  AssetSnapshot,
  AssetTick,
  CandlePoint,
  MarketOverviewItem,
  Timeframe
} from '@shared/types/market'
import type { NewsItem } from '@shared/types/news'
import type { PatternType } from '@shared/types/patterns'
import { buildAssetNewsCommentary } from '@renderer/services/news-ai-service'
import { createId } from '@renderer/utils/id'

interface AssetSeed {
  id: string
  symbol: string
  name: string
  class: AssetClass
  exchange: string
  currency: string
  description: string
  tags: string[]
  basePrice: number
  baseVolume: number
  marketCap?: number
  volatility: number
  sentimentScore: number
  patternBias: PatternType
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const deepClone = <Value>(value: Value): Value =>
  JSON.parse(JSON.stringify(value)) as Value

const timeframeConfig: Record<Timeframe, { points: number; stepHours: number }> = {
  '1s': { points: 180, stepHours: 1 / 3600 },
  '1m': { points: 120, stepHours: 1 / 60 },
  '5m': { points: 120, stepHours: 5 / 60 },
  '15m': { points: 120, stepHours: 15 / 60 },
  '1H': { points: 72, stepHours: 1 },
  '4H': { points: 72, stepHours: 4 },
  '1D': { points: 90, stepHours: 24 },
  '1W': { points: 52, stepHours: 24 * 7 },
  '1M': { points: 48, stepHours: 24 * 30 }
}

const patternShapes: Record<PatternType, number[]> = {
  inverse_head_shoulders: [
    1.0,
    0.99,
    0.96,
    0.985,
    0.975,
    0.915,
    0.98,
    0.965,
    0.99,
    1.025,
    1.055,
    1.09
  ],
  head_shoulders: [
    1.0,
    1.035,
    1.07,
    1.03,
    1.06,
    1.11,
    1.045,
    1.025,
    1.07,
    1.03,
    0.99,
    0.955
  ],
  cup_handle: [
    1.0,
    0.985,
    0.95,
    0.92,
    0.9,
    0.905,
    0.93,
    0.965,
    0.99,
    1.005,
    0.985,
    1.03
  ],
  bull_flag: [
    1.0,
    1.025,
    1.055,
    1.085,
    1.11,
    1.125,
    1.11,
    1.095,
    1.08,
    1.085,
    1.09,
    1.14
  ]
}

const assetSeeds: AssetSeed[] = [
  {
    id: 'btc-usd',
    symbol: 'BTCUSD',
    name: 'Bitcoin',
    class: 'crypto',
    exchange: 'Binance',
    currency: 'USD',
    description: 'Largest crypto asset by market cap with strong liquidity and macro sensitivity.',
    tags: ['Layer1', 'Store of Value'],
    basePrice: 68450,
    baseVolume: 18200000000,
    marketCap: 1360000000000,
    volatility: 4.6,
    sentimentScore: 73,
    patternBias: 'bull_flag'
  },
  {
    id: 'eth-usd',
    symbol: 'ETHUSD',
    name: 'Ethereum',
    class: 'crypto',
    exchange: 'Binance',
    currency: 'USD',
    description: 'Smart contract leader with ecosystem-driven flows and catalyst-heavy sentiment.',
    tags: ['Smart Contracts', 'Layer1'],
    basePrice: 3180,
    baseVolume: 9200000000,
    marketCap: 382000000000,
    volatility: 5.1,
    sentimentScore: 68,
    patternBias: 'inverse_head_shoulders'
  },
  {
    id: 'nvda',
    symbol: 'NVDA',
    name: 'NVIDIA',
    class: 'stock',
    exchange: 'NASDAQ',
    currency: 'USD',
    description: 'AI infrastructure leader with momentum-sensitive price action and heavy options flow.',
    tags: ['AI', 'Semiconductor'],
    basePrice: 138,
    baseVolume: 52800000,
    marketCap: 3390000000000,
    volatility: 3.1,
    sentimentScore: 81,
    patternBias: 'cup_handle'
  },
  {
    id: 'aapl',
    symbol: 'AAPL',
    name: 'Apple',
    class: 'stock',
    exchange: 'NASDAQ',
    currency: 'USD',
    description: 'Mega-cap defensive growth name often used as a quality anchor in equity watchlists.',
    tags: ['Consumer Tech', 'Mega Cap'],
    basePrice: 214,
    baseVolume: 42100000,
    marketCap: 3220000000000,
    volatility: 1.8,
    sentimentScore: 62,
    patternBias: 'head_shoulders'
  },
  {
    id: 'spx',
    symbol: 'SPX',
    name: 'S&P 500',
    class: 'index',
    exchange: 'CBOE',
    currency: 'USD',
    description: 'Broad US equity benchmark that sets risk appetite across portfolios.',
    tags: ['Macro', 'Benchmark'],
    basePrice: 5740,
    baseVolume: 4100000000,
    volatility: 1.2,
    sentimentScore: 58,
    patternBias: 'head_shoulders'
  },
  {
    id: 'gold',
    symbol: 'XAUUSD',
    name: 'Gold Spot',
    class: 'commodity',
    exchange: 'COMEX',
    currency: 'USD',
    description: 'Defensive commodity watched for inflation and risk-off signals.',
    tags: ['Safe Haven', 'Macro'],
    basePrice: 2384,
    baseVolume: 129000000,
    volatility: 1.6,
    sentimentScore: 66,
    patternBias: 'inverse_head_shoulders'
  }
]

const hashString = (value: string): number =>
  Array.from(value).reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0)

const createRandom = (seed: number): (() => number) => {
  let t = seed + 0x6d2b79f5

  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const buildProfile = (seed: AssetSeed): AssetProfile => ({
  id: seed.id,
  symbol: seed.symbol,
  name: seed.name,
  class: seed.class,
  exchange: seed.exchange,
  currency: seed.currency,
  description: seed.description,
  tags: seed.tags
})

const buildTimeSeries = (seed: AssetSeed, timeframe: Timeframe): CandlePoint[] => {
  const { points, stepHours } = timeframeConfig[timeframe]
  const random = createRandom(hashString(`${seed.id}-${timeframe}`))
  const startTime = Date.now() - points * stepHours * 60 * 60 * 1000
  const candles: CandlePoint[] = []

  let current = seed.basePrice * (0.92 + random() * 0.06)

  for (let index = 0; index < points; index += 1) {
    const drift = seed.class === 'crypto' ? 0.0012 : 0.0007
    const noise = (random() - 0.5) * seed.volatility * 0.009
    const close = Math.max(1, current * (1 + drift + noise))
    const open = current
    const wickSize = close * (0.0025 + random() * 0.004)
    const high = Math.max(open, close) + wickSize
    const low = Math.max(1, Math.min(open, close) - wickSize)
    const volume = seed.baseVolume * (0.72 + random() * 0.42)

    candles.push({
      time: new Date(startTime + index * stepHours * 60 * 60 * 1000).toISOString(),
      open,
      high,
      low,
      close,
      volume
    })

    current = close
  }

  const pattern = patternShapes[seed.patternBias]
  const patternStart = candles.length - pattern.length
  const anchor = candles[Math.max(patternStart - 1, 0)]?.close ?? seed.basePrice

  pattern.forEach((multiplier, patternIndex) => {
    const candleIndex = patternStart + patternIndex
    const priorClose = candleIndex === 0 ? anchor : candles[candleIndex - 1].close
    const close = anchor * multiplier
    const wickSize = close * (0.004 + random() * 0.003)
    const high = Math.max(priorClose, close) + wickSize
    const low = Math.max(1, Math.min(priorClose, close) - wickSize)

    candles[candleIndex] = {
      ...candles[candleIndex],
      open: priorClose,
      high,
      low,
      close,
      volume: seed.baseVolume * (0.74 + random() * 0.55)
    }
  })

  return candles
}

const buildQuote = (candles: CandlePoint[]): AssetQuote => {
  const referenceWindow = candles.slice(-24)
  const previousClose = referenceWindow[0]?.open ?? candles[0]?.open ?? candles[0]?.close ?? 1
  const latest = candles[candles.length - 1]
  const high24h = Math.max(...referenceWindow.map((candle) => candle.high))
  const low24h = Math.min(...referenceWindow.map((candle) => candle.low))
  const volume = referenceWindow.reduce((sum, candle) => sum + candle.volume, 0)

  return {
    price: latest.close,
    changePercent: ((latest.close - previousClose) / previousClose) * 100,
    volume,
    high24h,
    low24h,
    updatedAt: new Date().toISOString()
  }
}

const buildSnapshot = (seed: AssetSeed, timeframe: Timeframe): AssetSnapshot => {
  const candles = buildTimeSeries(seed, timeframe)

  return {
    profile: buildProfile(seed),
    quote: buildQuote(candles),
    candles,
    overview: `${seed.name} is tracked in mock mode with provider boundaries ready for live market feeds.`,
    metrics: {
      marketCap: seed.marketCap,
      volatility: seed.volatility,
      sentimentScore: seed.sentimentScore
    }
  }
}

const buildNews = (seed: AssetSeed): NewsItem[] => {
  const templates = [
    {
      title: `${seed.name} liquidity profile remains in focus`,
      summary: `Market participants are watching ${seed.symbol} for continuation and volatility cues as session momentum builds.`,
      source: 'AVY Wire',
      importance: 'high'
    },
    {
      title: `${seed.symbol} traders reassess short-term resistance`,
      summary: `Order flow and positioning suggest traders are measuring breakout quality against nearby resistance bands.`,
      source: 'Terminal Pulse',
      importance: 'medium'
    },
    {
      title: `${seed.name} catalysts keep sentiment active`,
      summary: `The next move may depend on whether incoming headlines confirm the current technical trend and volume participation.`,
      source: 'Macro Desk',
      importance: 'low'
    }
  ] as const

  return templates.map((template, index) => ({
    id: createId('news'),
    assetId: seed.id,
    title: template.title,
    source: template.source,
    publishedAt: new Date(Date.now() - index * 1000 * 60 * 47).toISOString(),
    summary: template.summary,
    details: `${seed.name} icin bu baslik, kisa vadeli duyarlilik ve teknik teyit acisindan izleniyor. Hacim ve fiyatlama ayni yone devam ederse etkisi artabilir.`,
    url: `https://example.com/${seed.id}/${index + 1}`,
    importance: template.importance,
    aiCommentary: buildAssetNewsCommentary(seed.symbol, template.title, template.summary)
  }))
}

const assetSeedMap = new Map(assetSeeds.map((seed) => [seed.id, seed]))

class MockMarketProvider {
  private detailCache = new Map<string, Record<Timeframe, AssetSnapshot>>()
  private newsCache = new Map<string, NewsItem[]>()

  private ensureSnapshot(assetId: string, timeframe: Timeframe): AssetSnapshot {
    const existing = this.detailCache.get(assetId)

    if (existing?.[timeframe]) {
      return existing[timeframe]
    }

    const seed = assetSeedMap.get(assetId)

    if (!seed) {
      throw new Error(`Unknown asset: ${assetId}`)
    }

    const nextSnapshot = buildSnapshot(seed, timeframe)
    const nextRecord = {
      ...(existing ?? {}),
      [timeframe]: nextSnapshot
    }

    this.detailCache.set(assetId, nextRecord)
    return nextSnapshot
  }

  private ensureNews(assetId: string): NewsItem[] {
    const cached = this.newsCache.get(assetId)

    if (cached) {
      return cached
    }

    const seed = assetSeedMap.get(assetId)

    if (!seed) {
      throw new Error(`Unknown asset: ${assetId}`)
    }

    const news = buildNews(seed)
    this.newsCache.set(assetId, news)
    return news
  }

  private mutateAsset(assetId: string): AssetTick {
    const seed = assetSeedMap.get(assetId)

    if (!seed) {
      throw new Error(`Unknown asset: ${assetId}`)
    }

    const assetSnapshots = this.detailCache.get(assetId)

    if (!assetSnapshots) {
      this.ensureSnapshot(assetId, '1H')
    }

    const snapshots = this.detailCache.get(assetId)

    if (!snapshots) {
      throw new Error(`Failed to initialize snapshot for ${assetId}`)
    }

    const clock = Date.now() / 1000
    const baseImpulse =
      Math.sin(clock / 14 + hashString(assetId)) * 0.0012 +
      (Math.random() - 0.5) * seed.volatility * 0.00085

    ;(Object.keys(snapshots) as Timeframe[]).forEach((timeframe) => {
      const snapshot = snapshots[timeframe]
      const latest = snapshot.candles[snapshot.candles.length - 1]
      const nextClose = Math.max(1, latest.close * (1 + baseImpulse))
      const wickSize = nextClose * 0.0024

      latest.close = nextClose
      latest.high = Math.max(latest.high, nextClose + wickSize)
      latest.low = Math.min(latest.low, Math.max(1, nextClose - wickSize))
      latest.volume = latest.volume * (1 + Math.abs(baseImpulse) * 12)

      snapshot.quote = buildQuote(snapshot.candles)
    })

    return {
      assetId,
      quote: deepClone(snapshots['1H'].quote)
    }
  }

  async getOverview(): Promise<MarketOverviewItem[]> {
    await sleep(160)

    return assetSeeds
      .map((seed) => {
        const snapshot = this.ensureSnapshot(seed.id, '1H')

        return {
          assetId: seed.id,
          profile: snapshot.profile,
          quote: deepClone(snapshot.quote)
        }
      })
      .sort((left, right) => right.quote.volume - left.quote.volume)
  }

  async searchAssets(query: string): Promise<MarketOverviewItem[]> {
    const normalized = query.trim().toLowerCase()
    const allItems = await this.getOverview()

    if (!normalized) {
      return allItems
    }

    return allItems.filter((item) =>
      [item.profile.name, item.profile.symbol, item.profile.class, item.profile.tags.join(' ')]
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    )
  }

  async getAssetDetail(assetId: string, timeframe: Timeframe): Promise<AssetSnapshot> {
    await sleep(110)
    return deepClone(this.ensureSnapshot(assetId, timeframe))
  }

  async getNews(assetId: string): Promise<NewsItem[]> {
    await sleep(90)
    return deepClone(this.ensureNews(assetId))
  }

  subscribe(assetIds: string[], onTick: (tick: AssetTick) => void): () => void {
    const timer = window.setInterval(() => {
      assetIds.forEach((assetId) => {
        onTick(this.mutateAsset(assetId))
      })
    }, 4200)

    return () => window.clearInterval(timer)
  }
}

export const mockMarketProvider = new MockMarketProvider()
