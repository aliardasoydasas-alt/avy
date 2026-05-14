type NewsItem = {
  title?: string
  summary?: string
  aiCommentary?: {
    tone?: 'positive' | 'negative' | 'neutral'
    summary?: string
  }
}

type PatternSignal = {
  label?: string
  status?: string
  direction?: string
  confidence?: number
}

type CandlePoint = {
  time?: string
  open?: number
  high?: number
  low?: number
  close?: number
  volume?: number
}

type AssetAiChatRequest = {
  question?: string
  conversation?: Array<{ role?: 'user' | 'assistant'; text?: string }>
  snapshot?: {
    profile?: {
      name?: string
      symbol?: string
      class?: string
      exchange?: string
      provider?: string
      currency?: string
    }
    quote?: {
      price?: number
      changePercent?: number
      high24h?: number
      low24h?: number
      volume?: number
    }
    overview?: string
    candles?: CandlePoint[]
  }
  indicators?: {
    trend?: string
    rsi?: number
    macd?: { histogram?: number }
    ema20?: number
    sma50?: number
    support?: number
    resistance?: number
    volumeTrend?: string
    summary?: string
  }
  patterns?: PatternSignal[]
  insight?: {
    title?: string
    summary?: string
    risks?: string[]
  }
  news?: NewsItem[]
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

const OPENAI_API_URL = 'https://api.openai.com/v1/responses'
const DEFAULT_MODEL = 'gpt-5.2'
const DEFAULT_REASONING_EFFORT = 'medium'

const json = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  })

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}

const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const asNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : [])

const formatNumber = (value: number | undefined, digits = 2): string =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '-'

const formatPercent = (value: number | undefined, digits = 2): string =>
  typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(digits)}%` : '-'

const normalizeCandles = (candles: CandlePoint[] | undefined): CandlePoint[] =>
  (candles ?? []).filter(
    (candle) =>
      typeof candle.open === 'number' &&
      typeof candle.high === 'number' &&
      typeof candle.low === 'number' &&
      typeof candle.close === 'number'
  )

const getRecentMoveSummary = (
  candles: CandlePoint[],
  support?: number,
  resistance?: number
): string => {
  if (candles.length < 2) {
    return 'Son hareketi yorumlamak icin yeterli mum verisi yok.'
  }

  const last = candles[candles.length - 1]
  const previous = candles[candles.length - 2]
  const recentWindow = candles.slice(-6)
  const windowStart = recentWindow[0]
  const oneCandleMove =
    previous.close && previous.close !== 0
      ? ((last.close! - previous.close) / previous.close) * 100
      : undefined
  const sixCandleMove =
    windowStart.open && windowStart.open !== 0
      ? ((last.close! - windowStart.open) / windowStart.open) * 100
      : undefined
  const lastRange =
    last.close && last.close !== 0 ? ((last.high! - last.low!) / last.close) * 100 : undefined
  const body =
    last.open && last.open !== 0 ? ((last.close! - last.open!) / last.open) * 100 : undefined
  const closeLocation =
    last.high === last.low ? 0.5 : ((last.close! - last.low!) / (last.high! - last.low!))
  const averageVolume =
    recentWindow.reduce((sum, candle) => sum + (candle.volume ?? 0), 0) / recentWindow.length
  const volumeRatio =
    averageVolume > 0 && typeof last.volume === 'number' ? last.volume / averageVolume : undefined

  let structureNote = 'yatay ve kararsiz bir sikisma gorunuyor'

  if (typeof resistance === 'number' && previous.close! <= resistance && last.close! > resistance) {
    structureNote = 'direnc uzeri kapanisla kisa vadeli yukari kirilim denemesi var'
  } else if (
    typeof support === 'number' &&
    previous.close! >= support &&
    last.close! < support
  ) {
    structureNote = 'destek altina sarkma ile zayiflama gorunuyor'
  } else if ((oneCandleMove ?? 0) > 0.75 && closeLocation >= 0.7) {
    structureNote = 'alinan mum guclu kapanisla momentumun alicilar lehine oldugunu gosteriyor'
  } else if ((oneCandleMove ?? 0) < -0.75 && closeLocation <= 0.3) {
    structureNote = 'satilan mum zayif kapanisla baskinin saticilarda oldugunu gosteriyor'
  } else if (Math.abs(body ?? 0) < 0.25 && (lastRange ?? 0) > 1) {
    structureNote = 'fitilli ve kararsiz bir mum var; yon teyidi zayif'
  }

  const volumeNote =
    typeof volumeRatio === 'number'
      ? volumeRatio >= 1.25
        ? 'hacim son mumda ortalamanin ustune cikmis'
        : volumeRatio <= 0.8
          ? 'hacim son mumda ortalamanin altinda kalmis'
          : 'hacim ortalamaya yakin'
      : 'hacim karsilastirmasi sinirli'

  return [
    `Son mum degisimi: ${formatPercent(oneCandleMove)} | son 6 mum degisimi: ${formatPercent(sixCandleMove)}.`,
    `Son mum araligi: ${formatPercent(lastRange)} | govde degisimi: ${formatPercent(body)}.`,
    `Kapanis konumu: ${closeLocation >= 0.7 ? 'ust bolgede' : closeLocation <= 0.3 ? 'alt bolgede' : 'orta bolgede'}.`,
    `Yapi: ${structureNote}.`,
    `Hacim notu: ${volumeNote}.`
  ].join(' ')
}

const getRecentCandlesTable = (candles: CandlePoint[]): string => {
  if (!candles.length) {
    return 'Mum listesi yok.'
  }

  return candles
    .slice(-6)
    .map((candle, index) => {
      const label = index === 5 ? 'en-guncel' : `mum-${index + 1}`
      return `${label}: O ${formatNumber(candle.open)} | H ${formatNumber(candle.high)} | L ${formatNumber(candle.low)} | C ${formatNumber(candle.close)} | V ${formatNumber(candle.volume, 0)}`
    })
    .join('\n')
}

const normalizeRequest = (value: unknown): AssetAiChatRequest => {
  const raw = asRecord(value)
  const question = asString(raw.question)

  if (!question) {
    throw new Error('Gecerli bir soru metni gerekiyor.')
  }

  return {
    question,
    conversation: asArray<{ role?: 'user' | 'assistant'; text?: string }>(raw.conversation).slice(
      -8
    ),
    snapshot: asRecord(raw.snapshot) as AssetAiChatRequest['snapshot'],
    indicators: asRecord(raw.indicators) as AssetAiChatRequest['indicators'],
    patterns: asArray<PatternSignal>(raw.patterns),
    insight: asRecord(raw.insight) as AssetAiChatRequest['insight'],
    news: asArray<NewsItem>(raw.news).slice(0, 4)
  }
}

const formatAssetContext = (request: AssetAiChatRequest): string => {
  const profile = request.snapshot?.profile ?? {}
  const quote = request.snapshot?.quote ?? {}
  const indicators = request.indicators ?? {}
  const insight = request.insight ?? {}
  const patterns = request.patterns ?? []
  const news = request.news ?? []
  const candles = normalizeCandles(request.snapshot?.candles)
  const recentMoveSummary = getRecentMoveSummary(candles, indicators.support, indicators.resistance)
  const recentCandlesTable = getRecentCandlesTable(candles)

  return [
    `Varlik: ${profile.name ?? '-'} (${profile.symbol ?? '-'})`,
    `Sinif: ${profile.class ?? '-'}`,
    `Borsa/Saglayici: ${profile.exchange ?? '-'}${profile.provider ? ` / ${profile.provider}` : ''}`,
    `Para birimi: ${profile.currency ?? '-'}`,
    `Son fiyat: ${asNumber(quote.price) ?? '-'}`,
    `Gunluk degisim yuzde: ${asNumber(quote.changePercent) ?? '-'}`,
    `24 saat yuksek: ${asNumber(quote.high24h) ?? '-'}`,
    `24 saat dusuk: ${asNumber(quote.low24h) ?? '-'}`,
    `Hacim: ${asNumber(quote.volume) ?? '-'}`,
    `Genel ozet: ${asString(request.snapshot?.overview) || '-'}`,
    `Son hareket ozeti: ${recentMoveSummary}`,
    `Son mumlar:\n${recentCandlesTable}`,
    `Trend: ${asString(indicators.trend) || '-'}`,
    `RSI: ${asNumber(indicators.rsi) ?? '-'}`,
    `MACD histogram: ${asNumber(indicators.macd?.histogram) ?? '-'}`,
    `EMA20: ${asNumber(indicators.ema20) ?? '-'}`,
    `SMA50: ${asNumber(indicators.sma50) ?? '-'}`,
    `Destek: ${asNumber(indicators.support) ?? '-'}`,
    `Direnc: ${asNumber(indicators.resistance) ?? '-'}`,
    `Hacim egilimi: ${asString(indicators.volumeTrend) || '-'}`,
    `Teknik ozet: ${asString(indicators.summary) || '-'}`,
    `AI durum rozeti: ${asString(insight.title) || '-'}`,
    `AI ozet: ${asString(insight.summary) || '-'}`,
    `AI riskler: ${asArray<string>(insight.risks).join(' | ') || '-'}`,
    `Formasyonlar: ${
      patterns.length
        ? patterns
            .map(
              (pattern) =>
                `${pattern.label ?? 'Formasyon'} (${pattern.status ?? '-'}, ${pattern.direction ?? '-'}, guven ${Math.round((pattern.confidence ?? 0) * 100)}%)`
            )
            .join(' | ')
        : 'yok'
    }`,
    `Son haberler: ${
      news.length
        ? news
            .map(
              (item) =>
                `${item.title ?? 'Haber'} | tone=${item.aiCommentary?.tone ?? 'neutral'} | yorum=${item.aiCommentary?.summary ?? item.summary ?? '-'}`
            )
            .join(' || ')
        : 'haber yok'
    }`
  ].join('\n')
}

const developerInstruction = [
  'Sen AVY icindeki profesyonel Turkce piyasa asistanisin.',
  'Kullaniciya sordugu soruya dogrudan cevap ver; konudan kacma.',
  'Her cevapta once "Kisa cevap:" diye tek cumlede net cevap ver.',
  'Sonra gerekiyorsa "Neden:" ve "Izlenecekler:" bolumleriyle devam et.',
  'Belirsizlik varsa bunu acikca soyle ama yine de eldeki veriye gore en net yorumu yap.',
  'Gereksiz uzun ve kendini tekrar eden cevap verme.',
  'Cevaplar Turkce olsun.',
  'Yatirim tavsiyesi dili kullanma; kesinlik iddiasinda bulunma.',
  'Kullanici cok kisa takip sorusu sorarsa onceki konusma baglamini kullan.',
  'Madde gerekiyorsa en fazla 3 kisa madde kullan.',
  'Kullanici son hareketi, son mumu, momentumun yonunu veya nedenini soruyorsa mutlaka son mumlar ve son hareket ozeti uzerinden cevap ver.',
  'Son hareket sorularinda son mumun yonu, kapanis bolgesi, hacim durumu ve destek-direnc iliskisini birlikte yorumla.',
  'Elindeki veride son mumlar varsa bunlara dayan; genel gecis cümleleri kurup gecme.'
].join('\n')

const mapConversation = (request: AssetAiChatRequest) =>
  (request.conversation ?? []).map((message) => ({
    role: message.role === 'assistant' ? 'assistant' : 'user',
    content: [
      {
        type: message.role === 'assistant' ? 'output_text' : 'input_text',
        text: asString(message.text)
      }
    ]
  }))

const extractResponseText = (payload: Record<string, unknown>): string => {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim()
  }

  const output = asArray<Record<string, unknown>>(payload.output)
  const chunks: string[] = []

  for (const item of output) {
    if (item.type !== 'message') {
      continue
    }

    const content = asArray<Record<string, unknown>>(item.content)

    for (const block of content) {
      if (block.type === 'output_text' && typeof block.text === 'string' && block.text.trim()) {
        chunks.push(block.text.trim())
      }
    }
  }

  return chunks.join('\n').trim()
}

const buildOpenAiPayload = (request: AssetAiChatRequest, model: string, reasoningEffort: string) => ({
  model,
  instructions: developerInstruction,
  reasoning: {
    effort: reasoningEffort
  },
  store: false,
  text: {
    format: {
      type: 'text'
    }
  },
  input: [
    {
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: `Varlik baglami:\n${formatAssetContext(request)}`
        }
      ]
    },
    ...mapConversation(request),
    {
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: request.question ?? ''
        }
      ]
    }
  ]
})

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    })
  }

  try {
    const openAiApiKey = Deno.env.get('OPENAI_API_KEY') ?? ''
    const model = Deno.env.get('OPENAI_MODEL') ?? DEFAULT_MODEL
    const reasoningEffort = Deno.env.get('OPENAI_REASONING_EFFORT') ?? DEFAULT_REASONING_EFFORT

    if (!openAiApiKey.trim()) {
      return json(503, {
        message: 'AVY_SHARED_AI_NOT_CONFIGURED'
      })
    }

    const body = normalizeRequest(await request.json())
    const openAiResponse = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAiApiKey}`
      },
      body: JSON.stringify(buildOpenAiPayload(body, model, reasoningEffort))
    })

    if (!openAiResponse.ok) {
      const errorText = await openAiResponse.text()
      return json(502, {
        message: `OpenAI istegi basarisiz oldu: ${openAiResponse.status} ${errorText}`
      })
    }

    const responsePayload = asRecord(await openAiResponse.json())
    const text = extractResponseText(responsePayload)

    if (!text) {
      return json(502, {
        message: 'OpenAI yaniti bos geldi.'
      })
    }

    return json(200, {
      text,
      model: asString(responsePayload.model) || model,
      source: 'openai'
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AVY AI istegi islenemedi.'
    return json(500, {
      message
    })
  }
})
