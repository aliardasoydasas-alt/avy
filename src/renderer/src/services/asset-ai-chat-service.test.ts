import { describe, expect, it } from 'vitest'
import type { AiInsight } from '@renderer/services/ai-insight-engine'
import { buildAssetAiChatReply } from '@renderer/services/asset-ai-chat-service'
import type { AssetChatMessage } from '@renderer/store/use-asset-chat-store'
import type { IndicatorSnapshot } from '@shared/types/analysis'
import type { AssetSnapshot } from '@shared/types/market'
import type { NewsItem } from '@shared/types/news'
import type { PatternSignal } from '@shared/types/patterns'

const snapshot: AssetSnapshot = {
  profile: {
    id: 'binance:BTCUSDT',
    symbol: 'BTC',
    name: 'Bitcoin',
    class: 'crypto',
    exchange: 'Binance',
    currency: 'USDT',
    description: '',
    tags: []
  },
  quote: {
    price: 75671.17,
    changePercent: 2.5,
    volume: 123456,
    high24h: 77000,
    low24h: 74000,
    updatedAt: '2026-04-22T10:00:00.000Z'
  },
  candles: [
    { time: '2026-04-22T05:00:00.000Z', open: 74800, high: 75100, low: 74620, close: 74940, volume: 82000 },
    { time: '2026-04-22T06:00:00.000Z', open: 74940, high: 75320, low: 74890, close: 75210, volume: 91000 },
    { time: '2026-04-22T07:00:00.000Z', open: 75210, high: 75540, low: 75100, close: 75490, volume: 98000 },
    { time: '2026-04-22T08:00:00.000Z', open: 75490, high: 76020, low: 75420, close: 75880, volume: 112000 },
    { time: '2026-04-22T09:00:00.000Z', open: 75880, high: 76320, low: 75790, close: 76140, volume: 134000 },
    { time: '2026-04-22T10:00:00.000Z', open: 76140, high: 76710, low: 76080, close: 75671.17, volume: 128000 }
  ],
  overview: '',
  metrics: {
    volatility: 3.2,
    sentimentScore: 61
  }
}

const indicators: IndicatorSnapshot = {
  rsi: 58.4,
  macd: {
    value: 1.2,
    signal: 0.9,
    histogram: 0.3
  },
  ema20: 75110,
  sma50: 74480,
  bollinger: {
    upper: 76800,
    middle: 75200,
    lower: 73600
  },
  support: 74800,
  resistance: 76400,
  volumeTrend: 'rising',
  trend: 'bullish',
  recommendation: 'buy',
  summary: 'Kisa vadede toparlanan bir teknik tablo var.'
}

const patterns: PatternSignal[] = [
  {
    id: 'pattern-1',
    type: 'bull_flag',
    label: 'Flama',
    description: 'Yukari kirilim ihtimali izleniyor.',
    confidence: 0.76,
    direction: 'bullish',
    status: 'confirmed',
    startIndex: 0,
    endIndex: 1,
    breakoutLevel: 76400
  }
]

const insight: AiInsight = {
  title: 'Olumlu gorunum',
  tone: 'positive',
  confidence: 74,
  summary: 'Momentum su an alici taraf lehine calisiyor.',
  rationale: ['Trend ozeti: yukselis.'],
  risks: ['Destek alti sarkarsa momentum zayiflar.', 'Direnc asilamadan ivme sinirli kalabilir.'],
  horizon: 'Kisa vade teknik yorum',
  disclaimer: 'Bu panel deneysel bir ozet uretir; kesin yatirim tavsiyesi degildir.'
}

const news: NewsItem[] = [
  {
    id: 'news-1',
    assetId: 'binance:BTCUSDT',
    title: 'Bitcoin gains as ETF inflows accelerate',
    source: 'Reuters',
    publishedAt: '2026-04-22T09:00:00.000Z',
    summary: 'ETF tarafinda alislar hizlaniyor.',
    details: 'Kurumsal ilginin arttigi izleniyor.',
    url: 'https://example.com/news-1',
    importance: 'high',
    aiCommentary: {
      tone: 'positive',
      summary: 'Kurumsal talep fiyatlamayi destekliyor.',
      impact: 'Olumlu'
    }
  }
]

describe('asset-ai-chat-service', () => {
  it('returns a direct risk answer instead of a generic summary', () => {
    const output = buildAssetAiChatReply({
      question: 'Bu varlikta risk nedir?',
      snapshot,
      indicators,
      patterns,
      insight,
      news
    })

    expect(output).toContain('Kısa cevap: bu varlıkta risk seviyesi')
    expect(output).toContain('Yakından izlenecek seviyeler')
    expect(output).not.toContain('genel görünüm şu an')
  })

  it('keeps news answers specific to the headline', () => {
    const output = buildAssetAiChatReply({
      question: 'Haberlerin etkisi ne olabilir?',
      snapshot,
      indicators,
      patterns,
      insight,
      news
    })

    expect(output).toContain('Öne çıkan başlık: Bitcoin gains as ETF inflows accelerate')
    expect(output).toContain('Kurumsal talep fiyatlamayi destekliyor')
  })

  it('uses previous conversation for short follow-up questions', () => {
    const conversation: AssetChatMessage[] = [
      {
        id: 'message-1',
        role: 'user',
        text: 'Teknik olarak guclu mu?',
        createdAt: '2026-04-22T09:59:00.000Z'
      }
    ]

    const output = buildAssetAiChatReply({
      question: 'neden?',
      snapshot,
      indicators,
      patterns,
      insight,
      news,
      conversation
    })

    expect(output).toContain('Kısa cevap: teknik görünüm görece güçlü duruyor.')
    expect(output).toContain('RSI 58.4')
  })

  it('explains the latest move using recent candles', () => {
    const output = buildAssetAiChatReply({
      question: 'Son hareketi nasil yorumluyorsun?',
      snapshot,
      indicators,
      patterns,
      insight,
      news
    })

    expect(output).toContain('Kısa cevap: son hareketi en iyi son mumun kapanış biçimi, hacim ve destek-direnç ilişkisi açıklıyor.')
    expect(output).toContain('Son mum değişimi')
    expect(output).toContain('Hacim son mumda')
  })
})
