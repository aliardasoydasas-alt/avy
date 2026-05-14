import type { HomeNewsItem, MarketPulseItem } from '@shared/types/home'
import type { MarketOverviewItem } from '@shared/types/market'
import { buildHomeNewsInsight } from '@renderer/services/home-ai-engine'
import { createId } from '@renderer/utils/id'

interface CoinGeckoGlobalResponse {
  data?: {
    total_market_cap?: Record<string, number>
    market_cap_percentage?: Record<string, number>
    market_cap_change_percentage_24h_usd?: number
  }
}

interface ExternalPulseData {
  bist100?: {
    value: string
    change: string
    tone: 'positive' | 'negative' | 'neutral'
    note?: string
  }
  btcDominance?: {
    value: string
    change: string
    tone: 'positive' | 'negative' | 'neutral'
  }
}

const GOOGLE_NEWS_RSS_URL =
  'https://news.google.com/rss/search?q=(global%20markets%20OR%20federal%20reserve%20OR%20ECB%20OR%20inflation%20OR%20tariffs%20OR%20oil%20OR%20geopolitics)%20when%3A7d&hl=en-US&gl=US&ceid=US:en'
const GOOGLE_NEWS_TOP_FEED_URL = 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en'

const MIDAS_BIST100_URL = 'https://www.getmidas.com/canli-borsa/xu100-bist-100-hisseleri'
const COINGECKO_GLOBAL_URL = 'https://api.coingecko.com/api/v3/global'
const COINGECKO_HOME_URL = 'https://www.coingecko.com/'
const NEWS_FETCH_HEADERS = {
  Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
  'Cache-Control': 'no-cache'
}
const CRITICAL_NEWS_KEYWORDS = [
  'market',
  'markets',
  'fed',
  'federal reserve',
  'ecb',
  'inflation',
  'tariff',
  'tariffs',
  'oil',
  'geopolitic',
  'war',
  'rates',
  'stocks',
  'economy',
  'recession'
]

const getFetchJson = async <Value>(url: string): Promise<Value> => {
  if (window.desktopAPI?.fetchJson) {
    return window.desktopAPI.fetchJson<Value>(url)
  }

  const response = await fetch(url)

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

const parseXml = (xml: string): Document => new DOMParser().parseFromString(xml, 'text/xml')

const stripHtml = (value: string): string =>
  new DOMParser().parseFromString(value, 'text/html').body.textContent?.replace(/\s+/g, ' ').trim() ?? ''

const normalizeText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const formatPercent = (value: number): string =>
  `${value > 0 ? '+' : ''}${new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)}%`

const formatUsd = (value: number): string =>
  new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 ? 0 : 2
  }).format(value)

const hasRelevantKeyword = (value: string): boolean => {
  const text = value.toLowerCase()
  return CRITICAL_NEWS_KEYWORDS.some((keyword) => text.includes(keyword))
}

const mapNewsItems = (
  document: Document,
  options?: { filterRelevant?: boolean }
): HomeNewsItem[] => {
  if (document.querySelector('parsererror')) {
    return []
  }

  const items = Array.from(document.querySelectorAll('item'))

  return items
    .map((item, index) => {
      const rawTitle = item.querySelector('title')?.textContent?.trim() ?? 'Baslik yok'
      const link = item.querySelector('link')?.textContent?.trim() ?? ''
      const publishedAt = item.querySelector('pubDate')?.textContent?.trim() ?? new Date().toUTCString()
      const rawDescription = item.querySelector('description')?.textContent?.trim() ?? ''
      const sourceTag = item.querySelector('source')?.textContent?.trim()
      const sourceFromTitle = rawTitle.includes(' - ') ? rawTitle.split(' - ').at(-1)?.trim() : undefined
      const source = sourceTag || sourceFromTitle || 'Global Akis'
      const title = rawTitle.replace(/\s-\s[^-]+$/, '').trim()
      const summary = stripHtml(rawDescription) || title
      const relevantText = `${title} ${summary} ${source}`

      return {
        id: createId(`home-news-${index}`),
        title,
        source,
        publishedAt: new Date(publishedAt).toISOString(),
        summary,
        url: link,
        insight: buildHomeNewsInsight(title, summary),
        relevantText
      }
    })
    .filter((item) =>
      options?.filterRelevant ? hasRelevantKeyword(item.relevantText) : true
    )
    .map(({ relevantText: _relevantText, ...item }) => item)
}

export const getCriticalHomeNews = async (): Promise<HomeNewsItem[]> => {
  const feedCandidates: Array<{ url: string; filterRelevant?: boolean }> = [
    { url: GOOGLE_NEWS_RSS_URL },
    { url: GOOGLE_NEWS_TOP_FEED_URL, filterRelevant: true }
  ]

  for (const candidate of feedCandidates) {
    try {
      const xml = await getFetchText(candidate.url, NEWS_FETCH_HEADERS)
      const document = parseXml(xml)
      const items = mapNewsItems(document, { filterRelevant: candidate.filterRelevant })

      if (items.length) {
        return items.slice(0, 8)
      }
    } catch (error) {
      console.warn('Critical news feed fetch failed', candidate.url, error)
    }
  }

  return []
}

export const getExternalHomePulse = async (): Promise<ExternalPulseData> => {
  const [bistHtml, coinGecko, coinGeckoHome] = await Promise.allSettled([
    getFetchText(MIDAS_BIST100_URL),
    getFetchJson<CoinGeckoGlobalResponse>(COINGECKO_GLOBAL_URL),
    getFetchText(COINGECKO_HOME_URL)
  ])

  const output: ExternalPulseData = {}

  if (bistHtml.status === 'fulfilled') {
    const text = normalizeText(bistHtml.value)
    const match = text.match(/Gunluk Degisim\s*[^0-9+-]*([\d.,]+)\s*\(([-+]?[\d.,]+%)\)/i)

    if (match) {
      const rawChange = match[2].replace(',', '.').replace('%', '')
      const changeValue = Number.parseFloat(rawChange)
      output.bist100 = {
        value: match[2],
        change: match[2],
        tone: Number.isFinite(changeValue)
          ? changeValue > 0
            ? 'positive'
            : changeValue < 0
              ? 'negative'
              : 'neutral'
          : 'neutral',
        note: `Gunluk nominal degisim ${match[1]}`
      }
    }
  }

  const dominanceFromHome =
    coinGeckoHome.status === 'fulfilled'
      ? normalizeText(coinGeckoHome.value)
          .match(/bitcoin dominance is at\s*([\d.]+)%/i)?.[1]
      : undefined

  if (coinGecko.status === 'fulfilled' || dominanceFromHome) {
    const apiDominance = coinGecko.status === 'fulfilled'
      ? coinGecko.value.data?.market_cap_percentage?.btc
      : undefined
    const dominance =
      typeof dominanceFromHome === 'string'
        ? Number.parseFloat(dominanceFromHome)
        : apiDominance
    const dominanceChange = coinGecko.status === 'fulfilled'
      ? coinGecko.value.data?.market_cap_change_percentage_24h_usd
      : undefined

    if (typeof dominance === 'number') {
      output.btcDominance = {
        value: `${new Intl.NumberFormat('tr-TR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(dominance)}%`,
        change:
          typeof dominanceChange === 'number'
            ? `Kripto piyasa değeri 24s ${formatPercent(dominanceChange)}`
            : 'Kripto piyasa hakimiyeti',
        tone:
          typeof dominanceChange === 'number'
            ? dominanceChange > 0
              ? 'positive'
              : dominanceChange < 0
                ? 'negative'
                : 'neutral'
            : 'neutral'
      }
    }
  }

  return output
}

export const buildHomePulseItems = (
  overviewItems: MarketOverviewItem[],
  externalPulse?: ExternalPulseData
): MarketPulseItem[] => {
  const overviewMap = new Map(overviewItems.map((item) => [item.assetId, item]))
  const btc = overviewMap.get('binance:BTCUSDT')
  const spy = overviewMap.get('midas-us:SPY')

  const items: MarketPulseItem[] = []

  if (externalPulse?.bist100) {
    items.push({
      id: 'pulse-bist100',
      label: 'BIST100',
      value: externalPulse.bist100.value,
      change: externalPulse.bist100.change,
      source: 'Midas',
      tone: externalPulse.bist100.tone,
      note: externalPulse.bist100.note ?? 'Midas BIST100 gorunumu'
    })
  }

  if (spy) {
    items.push({
      id: 'pulse-sp500',
      label: 'S&P 500',
      value: formatUsd(spy.quote.price),
      change: formatPercent(spy.quote.changePercent),
      source: 'Midas / SPY',
      tone: spy.quote.changePercent > 0 ? 'positive' : spy.quote.changePercent < 0 ? 'negative' : 'neutral',
      note: 'SPY ETF ile temsil edilir'
    })
  }

  if (btc) {
    items.push({
      id: 'pulse-btc',
      label: 'Bitcoin',
      value: formatUsd(btc.quote.price),
      change: formatPercent(btc.quote.changePercent),
      source: 'Binance',
      tone: btc.quote.changePercent > 0 ? 'positive' : btc.quote.changePercent < 0 ? 'negative' : 'neutral'
    })
  }

  if (externalPulse?.btcDominance) {
    items.push({
      id: 'pulse-btc-d',
      label: 'Bitcoin Dominance',
      value: externalPulse.btcDominance.value,
      change: externalPulse.btcDominance.change,
      source: 'CoinGecko',
      tone: externalPulse.btcDominance.tone,
      note: 'BTC piyasa hakimiyeti'
    })
  }

  return items
}
