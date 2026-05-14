import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from 'react'
import { memo } from 'react'
import {
  ChevronDown,
  Maximize2,
  Minimize2,
  Redo2,
  Share2,
  StepBack,
  StepForward,
  Trash2,
  Undo2,
  Wand2,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import {
  createChart,
  type AreaData,
  type CandlestickData,
  type LineData,
  type UTCTimestamp
} from 'lightweight-charts'
import { Panel } from '@renderer/components/panel'
import { buildChartMetricSeries, type ChartViewMode } from '@renderer/services/chart-metric-engine'
import { buildAiPreviewScenario } from '@renderer/services/chart-preview-engine'
import { useSettingsStore } from '@renderer/store/use-settings-store'
import { createId } from '@renderer/utils/id'
import { TIMEFRAME_LABELS, TIMEFRAME_OPTIONS } from '@renderer/utils/constants'
import { clamp, formatCurrency, formatEditableNumber, formatPercent, formatVolume } from '@renderer/utils/format'
import type { IndicatorSnapshot } from '@shared/types/analysis'
import type {
  ChartDrawing,
  ChartDrawingAnchor,
  ChartDrawingStyle,
  ChartDrawingTool,
  ChartDrawingType
} from '@shared/types/chart'
import type { AssetQuote, AssetSnapshot, CandlePoint, Timeframe } from '@shared/types/market'
import type { NewsItem } from '@shared/types/news'
import type { PatternSignal } from '@shared/types/patterns'

interface ShareableFriend {
  id: string
  displayName: string
  username: string
}

interface SelectedAssetLiveTickDetail {
  assetId: string
  timeframe: Timeframe
  quote: AssetQuote
}

const areCandlesEquivalent = (left: CandlePoint[], right: CandlePoint[]): boolean => {
  if (left === right) {
    return true
  }

  if (left.length !== right.length) {
    return false
  }

  const leftLast = left[left.length - 1]
  const rightLast = right[right.length - 1]
  const leftFirst = left[0]
  const rightFirst = right[0]

  if (!leftLast || !rightLast || !leftFirst || !rightFirst) {
    return left.length === right.length
  }

  return (
    leftFirst.time === rightFirst.time &&
    leftLast.time === rightLast.time &&
    leftLast.open === rightLast.open &&
    leftLast.high === rightLast.high &&
    leftLast.low === rightLast.low &&
    leftLast.close === rightLast.close &&
    leftLast.volume === rightLast.volume
  )
}

const areSnapshotsEquivalent = (left: AssetSnapshot, right: AssetSnapshot): boolean =>
  left === right ||
  (left.profile.id === right.profile.id &&
    left.quote.price === right.quote.price &&
    left.quote.changePercent === right.quote.changePercent &&
    left.quote.volume === right.quote.volume &&
    left.quote.updatedAt === right.quote.updatedAt &&
    left.metrics.volatility === right.metrics.volatility &&
    left.metrics.sentimentScore === right.metrics.sentimentScore &&
    areCandlesEquivalent(left.candles, right.candles))

const arePatternListsEquivalent = (left: PatternSignal[], right: PatternSignal[]): boolean => {
  if (left === right) {
    return true
  }

  if (left.length !== right.length) {
    return false
  }

  return left.every((pattern, index) => {
    const other = right[index]
    return (
      pattern.type === other?.type &&
      pattern.startIndex === other?.startIndex &&
      pattern.endIndex === other?.endIndex &&
      pattern.confidence === other?.confidence &&
      pattern.status === other?.status
    )
  })
}

const areNewsListsEquivalent = (left: NewsItem[], right: NewsItem[]): boolean => {
  if (left === right) {
    return true
  }

  if (left.length !== right.length) {
    return false
  }

  return left.every((item, index) => {
    const other = right[index]
    return (
      item.id === other?.id &&
      item.title === other?.title &&
      item.publishedAt === other?.publishedAt &&
      item.aiCommentary?.summary === other?.aiCommentary?.summary
    )
  })
}

const areFriendsEquivalent = (left: ShareableFriend[], right: ShareableFriend[]): boolean => {
  if (left === right) {
    return true
  }

  if (left.length !== right.length) {
    return false
  }

  return left.every((friend, index) => {
    const other = right[index]
    return friend.id === other?.id && friend.username === other?.username
  })
}

const areChartPanelPropsEqual = (
  previous: ChartPanelProps,
  next: ChartPanelProps
): boolean =>
  areSnapshotsEquivalent(previous.snapshot, next.snapshot) &&
  arePatternListsEquivalent(previous.patterns, next.patterns) &&
  previous.indicators === next.indicators &&
  areNewsListsEquivalent(previous.news, next.news) &&
  previous.drawings === next.drawings &&
  previous.selectedTimeframe === next.selectedTimeframe &&
  previous.canPublishAnalysis === next.canPublishAnalysis &&
  areFriendsEquivalent(previous.shareableFriends, next.shareableFriends)

interface ChartPanelProps {
  snapshot: AssetSnapshot
  patterns: PatternSignal[]
  indicators: IndicatorSnapshot
  news: NewsItem[]
  drawings: ChartDrawing[]
  selectedTimeframe: Timeframe
  canPublishAnalysis: boolean
  shareableFriends: ShareableFriend[]
  onTimeframeChange: (timeframe: Timeframe) => void
  onAddDrawing: (viewId: string, drawing: ChartDrawing) => void
  onSetDrawings: (viewId: string, drawings: ChartDrawing[]) => void
  onRemoveLastDrawing: (viewId: string) => void
  onClearDrawings: (viewId: string) => void
  onPublishAnalysis: (input: {
    title: string
    body: string
    snapshotDataUrl?: string
  }) => Promise<void>
  onShareAnalysisToFriend: (input: {
    friendId: string
    title: string
    body: string
    snapshotDataUrl?: string
  }) => Promise<void>
}

type ChartApi = ReturnType<typeof createChart>
type CandlestickSeriesApi = ReturnType<ChartApi['addCandlestickSeries']>
type MetricSeriesApi = ReturnType<ChartApi['addAreaSeries']>
type LineSeriesApi = ReturnType<ChartApi['addLineSeries']>
type PriceLineApi = ReturnType<CandlestickSeriesApi['createPriceLine']>
type PreviewSeriesApi = ReturnType<ChartApi['addCandlestickSeries']>
type ShareTarget = 'profile' | 'direct'
type LayerToggle = 'user' | 'ai'
type InteractionKind = 'draw' | 'move' | 'resize'
type ResizeHandle = 'start' | 'end'

interface PointGeometry {
  x: number
  y: number
}

interface DrawingHit {
  drawingId: string
  kind: 'move' | 'resize'
  handle?: ResizeHandle
}

interface InteractionState {
  pointerId: number
  kind: InteractionKind
  tool: ChartDrawingTool
  startAnchor: ChartDrawingAnchor
  startClientX: number
  startClientY: number
  drawingId?: string
  handle?: ResizeHandle
  draftDrawing?: ChartDrawing
  previewDrawing?: ChartDrawing
}

interface ViewHistory {
  past: ChartDrawing[][]
  future: ChartDrawing[][]
}

const DRAWING_COLOR = '#f6c445'
const SUPPORT_COLOR = '#35c9a8'
const RISK_COLOR = '#f87171'
const REWARD_COLOR = '#34d399'
const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
const MAX_HISTORY_DEPTH = 60
const MIN_DRAG_DISTANCE = 6
const HANDLE_RADIUS = 7
const HIT_DISTANCE = 11
const DEFAULT_CHART_HEIGHT = 560
const PRICE_SCALE_GUTTER = 76
const SINGLE_POINT_TOOLS: ChartDrawingType[] = ['horizontal_line', 'vertical_line', 'text_note', 'price_label']
const MAX_SHARE_SNAPSHOT_WIDTH = 1440
const SHARE_SNAPSHOT_QUALITY = 0.82
const DEFAULT_STYLE: ChartDrawingStyle = {
  strokeWidth: 2.4,
  fillOpacity: 0.16,
  textSize: 12
}

const legacyChartTools: Array<{ id: ChartDrawingTool; label: string; short: string }> = [
  { id: 'cursor', label: 'İmleç', short: 'İ' },
  { id: 'trend_line', label: 'Trend çizgisi', short: 'T' },
  { id: 'horizontal_line', label: 'Yatay çizgi', short: 'Y' },
  { id: 'vertical_line', label: 'Dikey çizgi', short: 'D' },
  { id: 'rectangle', label: 'Dikdörtgen', short: 'B' },
  { id: 'support_resistance_zone', label: 'Destek/direnç', short: 'S' },
  { id: 'fib_retracement', label: 'Fib', short: 'F' },
  { id: 'arrow', label: 'Ok', short: 'O' },
  { id: 'text_note', label: 'Not', short: 'N' },
  { id: 'price_label', label: 'Fiyat etiketi', short: 'P' },
  { id: 'risk_reward', label: 'Risk/ödül', short: 'R' },
  { id: 'brush', label: 'Serbest çizim', short: 'Ç' },
  { id: 'ruler', label: 'Ölçüm', short: 'Ö' }
]

const chartToolGroups: Array<{
  id: string
  label: string
  tools: Array<{ id: ChartDrawingTool; label: string; short: string }>
}> = [
  {
    id: 'selection',
    label: 'Seçim',
    tools: [{ id: 'cursor', label: 'İmleç', short: 'İ' }]
  },
  {
    id: 'lines',
    label: 'Çizgiler',
    tools: [
      { id: 'trend_line', label: 'Trend çizgisi', short: 'T' },
      { id: 'horizontal_line', label: 'Yatay çizgi', short: 'Y' },
      { id: 'vertical_line', label: 'Dikey çizgi', short: 'D' },
      { id: 'arrow', label: 'Ok', short: 'O' }
    ]
  },
  {
    id: 'zones',
    label: 'Bölgeler',
    tools: [
      { id: 'rectangle', label: 'Dikdörtgen', short: 'B' },
      { id: 'support_resistance_zone', label: 'Destek/direnç', short: 'S' },
      { id: 'fib_retracement', label: 'Fib', short: 'F' },
      { id: 'risk_reward', label: 'Risk/ödül', short: 'R' }
    ]
  },
  {
    id: 'notes',
    label: 'Notlar',
    tools: [
      { id: 'text_note', label: 'Not', short: 'N' },
      { id: 'price_label', label: 'Fiyat etiketi', short: 'P' }
    ]
  },
  {
    id: 'measure',
    label: 'Ölçüm',
    tools: [
      { id: 'brush', label: 'Serbest çizim', short: 'Ç' },
      { id: 'ruler', label: 'Ölçüm', short: 'Ö' }
    ]
  }
]

const chartTools = chartToolGroups.flatMap((group) => group.tools)
type ToolGlyphKind =
  | 'cursor'
  | 'lines'
  | 'trend_line'
  | 'horizontal_line'
  | 'vertical_line'
  | 'arrow'
  | 'zones'
  | 'rectangle'
  | 'support_resistance_zone'
  | 'fib_retracement'
  | 'risk_reward'
  | 'notes'
  | 'text_note'
  | 'price_label'
  | 'measure'
  | 'brush'
  | 'ruler'
  | 'undo'
  | 'clear'

interface GroupedToolDescriptor {
  id: ChartDrawingTool
  label: string
  glyph: ToolGlyphKind
}

interface GroupedToolGroup {
  id: string
  label: string
  glyph: ToolGlyphKind
  tools: GroupedToolDescriptor[]
}

const groupedToolConfig: GroupedToolGroup[] = [
  {
    id: 'selection',
    label: 'Secim',
    glyph: 'cursor',
    tools: [{ id: 'cursor', label: 'Imlec', glyph: 'cursor' }]
  },
  {
    id: 'lines',
    label: 'Trend ve cizgiler',
    glyph: 'lines',
    tools: [
      { id: 'trend_line', label: 'Trend cizgisi', glyph: 'trend_line' },
      { id: 'horizontal_line', label: 'Yatay cizgi', glyph: 'horizontal_line' },
      { id: 'vertical_line', label: 'Dikey cizgi', glyph: 'vertical_line' },
      { id: 'arrow', label: 'Ok', glyph: 'arrow' }
    ]
  },
  {
    id: 'zones',
    label: 'Bolgeler ve fib',
    glyph: 'zones',
    tools: [
      { id: 'rectangle', label: 'Dikdortgen bolge', glyph: 'rectangle' },
      { id: 'support_resistance_zone', label: 'Destek / direnc', glyph: 'support_resistance_zone' },
      { id: 'fib_retracement', label: 'Fib retracement', glyph: 'fib_retracement' },
      { id: 'risk_reward', label: 'Risk / odul', glyph: 'risk_reward' }
    ]
  },
  {
    id: 'notes',
    label: 'Yazi ve etiketler',
    glyph: 'notes',
    tools: [
      { id: 'text_note', label: 'Metin notu', glyph: 'text_note' },
      { id: 'price_label', label: 'Fiyat etiketi', glyph: 'price_label' }
    ]
  },
  {
    id: 'measure',
    label: 'Olcum ve cizim',
    glyph: 'measure',
    tools: [
      { id: 'brush', label: 'Serbest cizim', glyph: 'brush' },
      { id: 'ruler', label: 'Olcum araci', glyph: 'ruler' }
    ]
  }
]

const chartViewModes: Array<{ id: ChartViewMode; label: string; description: string }> = [
  { id: 'main', label: 'Main', description: 'Ana mum grafiği ve çizim araçları' },
  { id: 'volume', label: 'Hacim', description: 'Hacim akışının çizgisel görünümü' },
  { id: 'momentum', label: 'Momentum', description: 'Kısa vadeli itme kuvveti' },
  { id: 'volatility', label: 'Volatilite', description: 'Mum aralığına göre oynaklık' },
  { id: 'rsi', label: 'RSI', description: '14 periyot göreceli güç görünümü' },
  { id: 'macd', label: 'MACD', description: 'Histogram ivmesi' }
]

const toChartTime = (value: string): UTCTimestamp =>
  Math.floor(new Date(value).getTime() / 1000) as UTCTimestamp

const getPricePrecision = (value: number): number => {
  if (value >= 1000) {
    return 2
  }

  if (value >= 1) {
    return 3
  }

  if (value >= 0.1) {
    return 4
  }

  if (value >= 0.01) {
    return 5
  }

  return 6
}

const getDefaultVisibleRange = (length: number) => {
  const visibleBars = Math.min(Math.max(length * 0.35, 80), 140)
  return {
    from: Math.max(0, length - visibleBars),
    to: length + 6
  }
}

const getMetricSeriesPalette = (mode: Exclude<ChartViewMode, 'main'>) => {
  if (mode === 'volume') {
    return {
      lineColor: '#5ea6ff',
      topColor: 'rgba(94, 166, 255, 0.30)',
      bottomColor: 'rgba(94, 166, 255, 0.04)'
    }
  }

  if (mode === 'momentum') {
    return {
      lineColor: '#8b5cf6',
      topColor: 'rgba(139, 92, 246, 0.26)',
      bottomColor: 'rgba(139, 92, 246, 0.04)'
    }
  }

  if (mode === 'volatility') {
    return {
      lineColor: '#f59e0b',
      topColor: 'rgba(245, 158, 11, 0.24)',
      bottomColor: 'rgba(245, 158, 11, 0.04)'
    }
  }

  if (mode === 'rsi') {
    return {
      lineColor: '#22c55e',
      topColor: 'rgba(34, 197, 94, 0.22)',
      bottomColor: 'rgba(34, 197, 94, 0.03)'
    }
  }

  return {
    lineColor: '#fb7185',
    topColor: 'rgba(251, 113, 133, 0.24)',
    bottomColor: 'rgba(251, 113, 133, 0.03)'
  }
}

const formatMetricAxisValue = (mode: Exclude<ChartViewMode, 'main'>, value: number): string => {
  if (mode === 'volume') {
    return formatVolume(value)
  }

  if (mode === 'rsi') {
    return `${value.toFixed(0)}`
  }

  if (mode === 'macd') {
    return value.toFixed(3)
  }

  return formatPercent(value)
}

const areCandlestickDataPointsEqual = (
  left?: CandlestickData,
  right?: CandlestickData
): boolean =>
  left?.time === right?.time &&
  left?.open === right?.open &&
  left?.high === right?.high &&
  left?.low === right?.low &&
  left?.close === right?.close

const areAreaDataPointsEqual = (left?: AreaData, right?: AreaData): boolean =>
  left?.time === right?.time && left?.value === right?.value

const loadSvgIntoCanvas = async (
  context: CanvasRenderingContext2D,
  svgElement: SVGSVGElement,
  width: number,
  height: number
): Promise<void> => {
  const serialized = new XMLSerializer().serializeToString(svgElement)
  const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  try {
    await new Promise<void>((resolve, reject) => {
      const image = new Image()
      image.onload = () => {
        context.drawImage(image, 0, 0, width, height)
        resolve()
      }
      image.onerror = () => reject(new Error('Grafik katmanı görsele dönüştürülemedi.'))
      image.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

const captureChartSnapshot = async (
  stage: HTMLDivElement,
  overlay: SVGSVGElement | null
): Promise<string | undefined> => {
  const canvases = Array.from(stage.querySelectorAll('canvas'))

  if (!canvases.length) {
    return undefined
  }

  const stageWidth = Math.max(stage.clientWidth, 1)
  const stageHeight = Math.max(stage.clientHeight, 1)
  const aspectRatio = stageHeight / stageWidth
  const width = Math.min(MAX_SHARE_SNAPSHOT_WIDTH, Math.round(stageWidth))
  const height = Math.max(1, Math.round(width * aspectRatio))
  const composite = document.createElement('canvas')
  composite.width = width
  composite.height = height

  const context = composite.getContext('2d')

  if (!context) {
    return undefined
  }

  canvases.forEach((canvas) => {
    context.drawImage(canvas, 0, 0, width, height)
  })

  if (overlay) {
    await loadSvgIntoCanvas(context, overlay, width, height)
  }

  return composite.toDataURL('image/jpeg', SHARE_SNAPSHOT_QUALITY)
}

const formatMeasureLabel = (start: ChartDrawingAnchor, end: ChartDrawingAnchor): string => {
  const priceDelta = end.price - start.price
  const percentDelta = start.price ? (priceDelta / start.price) * 100 : 0

  return `${priceDelta >= 0 ? '+' : ''}${priceDelta.toFixed(2)} • ${percentDelta >= 0 ? '+' : ''}${percentDelta.toFixed(2)}%`
}

const sortAnchorsByTime = (
  start: ChartDrawingAnchor,
  end: ChartDrawingAnchor
): [ChartDrawingAnchor, ChartDrawingAnchor] =>
  new Date(start.time).getTime() <= new Date(end.time).getTime() ? [start, end] : [end, start]

const buildShareTitle = (symbol: string, title: string): string =>
  title.trim() || `${symbol} teknik inceleme`

const buildShareBody = (
  symbol: string,
  timeframe: Timeframe,
  drawings: ChartDrawing[],
  patterns: PatternSignal[],
  body: string
): string => {
  if (body.trim()) {
    return body.trim()
  }

  const drawingSummary = drawings.length ? `${drawings.length} çizim` : 'manuel çizim eklenmeden'
  const patternSummary = patterns.length ? `${patterns.length} formasyon işareti` : 'ek AI formasyonu olmadan'

  return `${symbol} için ${timeframe} grafiğinde ${drawingSummary} ve ${patternSummary} ile hazırlanan teknik inceleme.`
}

const normalizeStyle = (drawing: ChartDrawing): ChartDrawingStyle => ({
  strokeWidth: drawing.style?.strokeWidth ?? DEFAULT_STYLE.strokeWidth,
  fillOpacity: drawing.style?.fillOpacity ?? DEFAULT_STYLE.fillOpacity,
  textSize: drawing.style?.textSize ?? DEFAULT_STYLE.textSize
})

const cloneAnchor = (anchor: ChartDrawingAnchor): ChartDrawingAnchor => ({
  time: anchor.time,
  price: anchor.price
})

const cloneDrawing = (drawing: ChartDrawing): ChartDrawing => ({
  ...drawing,
  start: cloneAnchor(drawing.start),
  end: cloneAnchor(drawing.end),
  points: drawing.points?.map(cloneAnchor),
  style: drawing.style ? { ...drawing.style } : undefined
})

const cloneDrawings = (drawings: ChartDrawing[]): ChartDrawing[] => drawings.map(cloneDrawing)

const areAnchorsEqual = (left: ChartDrawingAnchor, right: ChartDrawingAnchor): boolean =>
  left.time === right.time && Math.abs(left.price - right.price) < 0.000001

const areStylesEqual = (
  left?: Partial<ChartDrawingStyle>,
  right?: Partial<ChartDrawingStyle>
): boolean =>
  (left?.strokeWidth ?? DEFAULT_STYLE.strokeWidth) ===
    (right?.strokeWidth ?? DEFAULT_STYLE.strokeWidth) &&
  (left?.fillOpacity ?? DEFAULT_STYLE.fillOpacity) ===
    (right?.fillOpacity ?? DEFAULT_STYLE.fillOpacity) &&
  (left?.textSize ?? DEFAULT_STYLE.textSize) ===
    (right?.textSize ?? DEFAULT_STYLE.textSize)

const areDrawingsEqual = (left: ChartDrawing, right: ChartDrawing): boolean => {
  if (
    left.id !== right.id ||
    left.type !== right.type ||
    left.layer !== right.layer ||
    left.color !== right.color ||
    left.fillColor !== right.fillColor ||
    left.textColor !== right.textColor ||
    left.label !== right.label ||
    left.note !== right.note ||
    !areAnchorsEqual(left.start, right.start) ||
    !areAnchorsEqual(left.end, right.end) ||
    !areStylesEqual(left.style, right.style)
  ) {
    return false
  }

  const leftPoints = left.points ?? []
  const rightPoints = right.points ?? []

  if (leftPoints.length !== rightPoints.length) {
    return false
  }

  return leftPoints.every((point, index) => areAnchorsEqual(point, rightPoints[index]!))
}

const areDrawingCollectionsEqual = (left: ChartDrawing[], right: ChartDrawing[]): boolean =>
  left.length === right.length && left.every((drawing, index) => areDrawingsEqual(drawing, right[index]!))

const getDrawingLabel = (type: ChartDrawingType): string | undefined => {
  if (type === 'support_resistance_zone') {
    return 'Takip bölgesi'
  }

  if (type === 'text_note') {
    return 'Takip notu'
  }

  return undefined
}

const buildDrawing = (
  type: ChartDrawingType,
  start: ChartDrawingAnchor,
  end: ChartDrawingAnchor,
  snapshot: AssetSnapshot
): ChartDrawing => {
  const base: ChartDrawing = {
    id: createId('drawing'),
    type,
    start,
    end,
    layer: 'user',
    color:
      type === 'support_resistance_zone'
        ? SUPPORT_COLOR
        : type === 'risk_reward'
          ? REWARD_COLOR
          : DRAWING_COLOR,
    fillColor:
      type === 'support_resistance_zone'
        ? 'rgba(53, 201, 168, 0.18)'
        : type === 'risk_reward'
          ? 'rgba(52, 211, 153, 0.18)'
          : undefined,
    textColor: '#f8fafc',
    label:
      type === 'ruler'
        ? formatMeasureLabel(start, end)
        : type === 'price_label'
          ? formatEditableNumber(start.price)
          : getDrawingLabel(type),
    note: type === 'text_note' ? `${snapshot.profile.symbol} için izleme notu` : undefined,
    style: { ...DEFAULT_STYLE }
  }

  if (type === 'brush') {
    base.points = [start, end]
  }

  return base
}

const distanceToSegment = (point: PointGeometry, start: PointGeometry, end: PointGeometry): number => {
  const dx = end.x - start.x
  const dy = end.y - start.y

  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y)
  }

  const t = clamp(
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy),
    0,
    1
  )
  const projectedX = start.x + t * dx
  const projectedY = start.y + t * dy

  return Math.hypot(point.x - projectedX, point.y - projectedY)
}

const findCandleIndexByTime = (candles: AssetSnapshot['candles'], time: string): number => {
  const exactIndex = candles.findIndex((candle) => candle.time === time)

  if (exactIndex >= 0) {
    return exactIndex
  }

  const target = new Date(time).getTime()
  let bestIndex = 0
  let bestDistance = Number.POSITIVE_INFINITY

  candles.forEach((candle, index) => {
    const distance = Math.abs(new Date(candle.time).getTime() - target)

    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  })

  return bestIndex
}

const shiftAnchor = (
  anchor: ChartDrawingAnchor,
  candles: AssetSnapshot['candles'],
  barOffset: number,
  priceOffset: number
): ChartDrawingAnchor => {
  const currentIndex = findCandleIndexByTime(candles, anchor.time)
  const nextIndex = clamp(currentIndex + barOffset, 0, candles.length - 1)
  const nextCandle = candles[nextIndex] ?? candles[currentIndex]

  return {
    time: nextCandle.time,
    price: Math.max(0, anchor.price + priceOffset)
  }
}

const shiftDrawing = (
  drawing: ChartDrawing,
  candles: AssetSnapshot['candles'],
  barOffset: number,
  priceOffset: number
): ChartDrawing => ({
  ...drawing,
  start: shiftAnchor(drawing.start, candles, barOffset, priceOffset),
  end: shiftAnchor(drawing.end, candles, barOffset, priceOffset),
  points: drawing.points?.map((point) => shiftAnchor(point, candles, barOffset, priceOffset))
})

const withUpdatedHandle = (
  drawing: ChartDrawing,
  handle: ResizeHandle,
  nextAnchor: ChartDrawingAnchor
): ChartDrawing => {
  const nextDrawing = cloneDrawing(drawing)

  if (handle === 'start') {
    nextDrawing.start = nextAnchor

    if (nextDrawing.type === 'brush' && nextDrawing.points?.length) {
      nextDrawing.points[0] = nextAnchor
    }
  } else {
    nextDrawing.end = nextAnchor

    if (nextDrawing.type === 'brush' && nextDrawing.points?.length) {
      nextDrawing.points[nextDrawing.points.length - 1] = nextAnchor
    }
  }

  if (nextDrawing.type === 'price_label') {
    nextDrawing.label = formatEditableNumber(handle === 'start' ? nextDrawing.start.price : nextDrawing.end.price)
  }

  if (nextDrawing.type === 'ruler') {
    nextDrawing.label = formatMeasureLabel(nextDrawing.start, nextDrawing.end)
  }

  return nextDrawing
}

const createArrowHead = (
  start: PointGeometry,
  end: PointGeometry,
  size = 14
): string => {
  const angle = Math.atan2(end.y - start.y, end.x - start.x)
  const left = {
    x: end.x - size * Math.cos(angle - Math.PI / 6),
    y: end.y - size * Math.sin(angle - Math.PI / 6)
  }
  const right = {
    x: end.x - size * Math.cos(angle + Math.PI / 6),
    y: end.y - size * Math.sin(angle + Math.PI / 6)
  }

  return `${end.x},${end.y} ${left.x},${left.y} ${right.x},${right.y}`
}

const brushPointReduction = (points: ChartDrawingAnchor[]): ChartDrawingAnchor[] => {
  if (points.length <= 2) {
    return points
  }

  return points.filter((_, index) => index === 0 || index === points.length - 1 || index % 2 === 0)
}

interface ChartOverlayProps {
  overlayRef: MutableRefObject<SVGSVGElement | null>
  refreshHandlerRef: MutableRefObject<(() => void) | null>
  stageSize: { width: number; height: number }
  renderedDrawings: ChartDrawing[]
  draftDrawingId?: string
  renderDrawing: (drawing: ChartDrawing, draft?: boolean) => ReactNode
}

const ChartOverlay = ({
  overlayRef,
  refreshHandlerRef,
  stageSize,
  renderedDrawings,
  draftDrawingId,
  renderDrawing
}: ChartOverlayProps) => {
  const frameRef = useRef<number | null>(null)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    refreshHandlerRef.current = () => {
      if (frameRef.current !== null) {
        return
      }

      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null
        setRevision((value) => value + 1)
      })
    }

    return () => {
      refreshHandlerRef.current = null

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
      }
    }
  }, [refreshHandlerRef])

  void revision

  return (
    <svg
      ref={overlayRef}
      className="chart-overlay"
      width={stageSize.width}
      height={stageSize.height}
      viewBox={`0 0 ${stageSize.width} ${stageSize.height}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {renderedDrawings.map((drawing) => renderDrawing(drawing, drawing.id === draftDrawingId))}
    </svg>
  )
}

interface CompactToolbarSelectProps<Value extends string> {
  label: string
  value: Value
  options: Array<{ value: Value; label: string; hint?: string }>
  isOpen: boolean
  onToggle: () => void
  onSelect: (value: Value) => void
}

const CompactToolbarSelect = <Value extends string>({
  label,
  value,
  options,
  isOpen,
  onToggle,
  onSelect
}: CompactToolbarSelectProps<Value>) => {
  const selected = options.find((option) => option.value === value) ?? options[0]

  return (
    <div className="chart-toolbar-select">
      <button
        type="button"
        className={isOpen ? 'chart-toolbar-select__button chart-toolbar-select__button--active' : 'chart-toolbar-select__button'}
        onClick={onToggle}
        title={label}
      >
        <span>{selected?.label ?? value}</span>
        <ChevronDown size={14} />
      </button>

      {isOpen ? (
        <div className="chart-toolbar-select__menu" role="menu" aria-label={label}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={
                option.value === value
                  ? 'chart-toolbar-select__item chart-toolbar-select__item--active'
                  : 'chart-toolbar-select__item'
              }
              onClick={() => onSelect(option.value)}
              title={option.hint}
            >
              <strong>{option.label}</strong>
              {option.hint ? <span>{option.hint}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

const ToolGlyph = ({ kind }: { kind: ToolGlyphKind }) => {
  if (kind === 'cursor') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 6h5M13 6h5M6 18h5M13 18h5M12 4v5M12 15v5" />
      </svg>
    )
  }

  if (kind === 'trend_line' || kind === 'lines') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 17 10 12 14 14 19 7" />
        <circle cx="5" cy="17" r="1.5" />
        <circle cx="10" cy="12" r="1.5" />
        <circle cx="14" cy="14" r="1.5" />
        <circle cx="19" cy="7" r="1.5" />
      </svg>
    )
  }

  if (kind === 'horizontal_line') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 9h14M5 15h14" />
      </svg>
    )
  }

  if (kind === 'vertical_line') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 5v14M15 5v14" />
      </svg>
    )
  }

  if (kind === 'arrow') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 18 18 6M12 6h6v6" />
      </svg>
    )
  }

  if (kind === 'rectangle' || kind === 'zones') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="5" y="7" width="14" height="10" rx="2" />
      </svg>
    )
  }

  if (kind === 'support_resistance_zone') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 8h16M4 16h16" />
        <rect x="6" y="9.5" width="12" height="5" rx="1.5" />
      </svg>
    )
  }

  if (kind === 'fib_retracement') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 18 18 6" />
        <path d="M7 16h10M8 13h8M9 10h6" />
      </svg>
    )
  }

  if (kind === 'risk_reward') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 18V7M17 18V10" />
        <path d="M5 18h14" />
      </svg>
    )
  }

  if (kind === 'text_note' || kind === 'notes') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 7h12M12 7v10" />
      </svg>
    )
  }

  if (kind === 'price_label') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12h8" />
        <rect x="13" y="8" width="6" height="8" rx="2" />
      </svg>
    )
  }

  if (kind === 'brush' || kind === 'measure') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 16c2-4 5-6 8-7 2-.7 4-2.3 6-4" />
        <path d="M6 18h6" />
      </svg>
    )
  }

  if (kind === 'ruler') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 17 17 5" />
        <path d="M8 14 10 16M11 11l2 2M14 8l2 2" />
      </svg>
    )
  }

  if (kind === 'undo') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 7 5 11l4 4" />
        <path d="M6 11h7a5 5 0 1 1 0 10" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6 18 18M18 6 6 18" />
    </svg>
  )
}

const ChartPanelComponent = ({
  snapshot,
  patterns,
  indicators,
  news,
  drawings,
  selectedTimeframe,
  canPublishAnalysis,
  shareableFriends,
  onTimeframeChange,
  onAddDrawing,
  onSetDrawings,
  onRemoveLastDrawing,
  onClearDrawings,
  onPublishAnalysis,
  onShareAnalysisToFriend
}: ChartPanelProps) => {
  const themeMode = useSettingsStore((state) => state.settings.themeMode)
  const chartShellRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const overlayRef = useRef<SVGSVGElement | null>(null)
  const sharePanelRef = useRef<HTMLDivElement | null>(null)
  const timeframeMenuRef = useRef<HTMLDivElement | null>(null)
  const chartViewMenuRef = useRef<HTMLDivElement | null>(null)
  const toolRailRef = useRef<HTMLElement | null>(null)
  const chartRef = useRef<ChartApi | null>(null)
  const candleSeriesRef = useRef<CandlestickSeriesApi | null>(null)
  const metricSeriesRef = useRef<MetricSeriesApi | null>(null)
  const previewSeriesRef = useRef<PreviewSeriesApi | null>(null)
  const patternSeriesRef = useRef<LineSeriesApi[]>([])
  const priceLinesRef = useRef<PriceLineApi[]>([])
  const interactionRef = useRef<InteractionState | null>(null)
  const historyByViewRef = useRef<Record<string, ViewHistory>>({})
  const viewKeyRef = useRef('')
  const overlayRefreshHandlerRef = useRef<(() => void) | null>(null)
  const overlayRefreshFrameRef = useRef<number | null>(null)
  const interactionFrameRef = useRef<number | null>(null)
  const pendingDraftRef = useRef<ChartDrawing | null>(null)
  const pendingPreviewRef = useRef<ChartDrawing | null>(null)
  const overlaySignatureRef = useRef('')
  const clipboardDrawingRef = useRef<ChartDrawing | null>(null)
  const isChartFocusedRef = useRef(false)

  const [stageSize, setStageSize] = useState({ width: 0, height: DEFAULT_CHART_HEIGHT })
  const [activeTool, setActiveTool] = useState<ChartDrawingTool>('cursor')
  const [selectedDrawingId, setSelectedDrawingId] = useState('')
  const [draftDrawing, setDraftDrawing] = useState<ChartDrawing | null>(null)
  const [previewDrawing, setPreviewDrawing] = useState<ChartDrawing | null>(null)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [shareTitle, setShareTitle] = useState('')
  const [shareBody, setShareBody] = useState('')
  const [shareTarget, setShareTarget] = useState<ShareTarget>('profile')
  const [shareFriendId, setShareFriendId] = useState('')
  const [shareStatus, setShareStatus] = useState('')
  const [isPublishing, setIsPublishing] = useState(false)
  const [chartViewMode, setChartViewMode] = useState<ChartViewMode>('main')
  const [showUserLayer, setShowUserLayer] = useState(true)
  const [showAiLayer, setShowAiLayer] = useState(true)
  const [previewCandles, setPreviewCandles] = useState<CandlePoint[]>([])
  const [previewSummary, setPreviewSummary] = useState('')
  const [previewError, setPreviewError] = useState('')
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [isChartFullscreen, setIsChartFullscreen] = useState(false)
  const [isChartFocused, setIsChartFocused] = useState(false)
  const [isTimeframeMenuOpen, setIsTimeframeMenuOpen] = useState(false)
  const [isChartViewMenuOpen, setIsChartViewMenuOpen] = useState(false)
  const [expandedToolGroupId, setExpandedToolGroupId] = useState<string | null>(null)
  const previewDismissRef = useRef<number>()
  const renderedCandleDataRef = useRef<CandlestickData[]>([])
  const renderedMetricDataRef = useRef<AreaData[]>([])
  const renderedPreviewDataRef = useRef<CandlestickData[]>([])
  const liveCandleRef = useRef<CandlestickData | null>(null)
  const overlayEnabledRef = useRef(false)

  const candleData = useMemo<CandlestickData[]>(
    () =>
      snapshot.candles.map((candle) => ({
        time: toChartTime(candle.time),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close
      })),
    [snapshot.candles]
  )
  const metricSeriesData = useMemo<AreaData[]>(
    () =>
      chartViewMode === 'main'
        ? []
        : buildChartMetricSeries(snapshot.candles, chartViewMode).map((point) => ({
            time: toChartTime(point.time),
            value: point.value
          })),
    [chartViewMode, snapshot.candles]
  )
  const previewSeriesData = useMemo<CandlestickData[]>(
    () =>
      previewCandles.map((candle) => ({
        time: toChartTime(candle.time),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close
      })),
    [previewCandles]
  )

  const precision = useMemo(() => getPricePrecision(snapshot.quote.price), [snapshot.quote.price])
  const viewId = `${snapshot.profile.id}:${selectedTimeframe}`
  const isMainChartMode = chartViewMode === 'main'
  const activeMetricMode = chartViewModes.find((mode) => mode.id === chartViewMode) ?? chartViewModes[0]
  const availableTimeframes = useMemo(
    () =>
      snapshot.profile.class === 'crypto'
        ? TIMEFRAME_OPTIONS
        : TIMEFRAME_OPTIONS.filter((timeframe) => timeframe !== '1s'),
    [snapshot.profile.class]
  )
  const timeframeMenuOptions = useMemo(
    () =>
      availableTimeframes.map((timeframe) => ({
        value: timeframe,
        label: timeframe === '1s' ? '1S' : timeframe.toUpperCase(),
        hint: TIMEFRAME_LABELS[timeframe]
      })),
    [availableTimeframes]
  )
  const chartViewMenuOptions = useMemo(
    () =>
      chartViewModes.map((mode) => ({
        value: mode.id,
        label: mode.label,
        hint: mode.description
      })),
    []
  )
  const metricMode = chartViewMode === 'main' ? null : chartViewMode
  const metricPalette = useMemo(
    () => (metricMode ? getMetricSeriesPalette(metricMode) : null),
    [metricMode]
  )
  const chartMinPrice = useMemo(
    () => Math.min(...snapshot.candles.map((candle) => candle.low)),
    [snapshot.candles]
  )
  const chartMaxPrice = useMemo(
    () => Math.max(...snapshot.candles.map((candle) => candle.high)),
    [snapshot.candles]
  )
  const activeToolGroupId = useMemo(
    () =>
      groupedToolConfig.find((group) => group.tools.some((tool) => tool.id === activeTool))?.id ??
      groupedToolConfig[0]?.id ??
      'selection',
    [activeTool]
  )
  const history = useMemo(() => historyByViewRef.current[viewId] ?? { past: [], future: [] }, [viewId, drawings])
  const canUndo = history.past.length > 0
  const canRedo = history.future.length > 0

  const scheduleOverlayRefresh = useCallback(() => {
    if (!overlayEnabledRef.current) {
      return
    }

    if (overlayRefreshFrameRef.current !== null) {
      return
    }

    overlayRefreshFrameRef.current = window.requestAnimationFrame(() => {
      overlayRefreshFrameRef.current = null
      overlayRefreshHandlerRef.current?.()
    })
  }, [])

  const flushInteractionState = useCallback(() => {
    if (interactionFrameRef.current !== null) {
      return
    }

    interactionFrameRef.current = window.requestAnimationFrame(() => {
      interactionFrameRef.current = null
      setDraftDrawing(pendingDraftRef.current ? cloneDrawing(pendingDraftRef.current) : null)
      setPreviewDrawing(pendingPreviewRef.current ? cloneDrawing(pendingPreviewRef.current) : null)
    })
  }, [])

  const chartPalette = useMemo(
    () =>
      themeMode === 'light'
        ? {
            background: '#eff8ff',
            text: '#33526f',
            grid: 'rgba(81, 135, 182, 0.14)',
            crosshair: '#5f93bf',
            support: 'rgba(29, 137, 121, 0.9)',
            resistance: 'rgba(38, 128, 222, 0.92)',
            lineFill: 'rgba(255, 255, 255, 0.82)',
            labelFill: 'rgba(234, 245, 255, 0.94)',
            labelStroke: 'rgba(92, 142, 187, 0.24)',
            labelText: '#2f5e8a'
          }
        : {
            background: '#07111d',
            text: '#a8b3c7',
            grid: 'rgba(255, 255, 255, 0.05)',
            crosshair: '#45618a',
            support: 'rgba(123, 215, 196, 0.92)',
            resistance: 'rgba(248, 187, 78, 0.92)',
            lineFill: 'rgba(7, 17, 29, 0.88)',
            labelFill: 'rgba(7, 17, 29, 0.88)',
            labelStroke: 'rgba(246, 196, 69, 0.22)',
            labelText: '#f6c445'
          },
    [themeMode]
  )

  const ensureHistory = () => {
    if (!historyByViewRef.current[viewId]) {
      historyByViewRef.current[viewId] = {
        past: [],
        future: []
      }
    }

    return historyByViewRef.current[viewId]
  }

  const replaceDrawings = (nextDrawings: ChartDrawing[], pushHistory = true) => {
    const normalizedNext = cloneDrawings(nextDrawings)

    if (areDrawingCollectionsEqual(normalizedNext, drawings)) {
      return
    }

    const viewHistory = ensureHistory()

    if (pushHistory) {
      viewHistory.past = [...viewHistory.past, cloneDrawings(drawings)].slice(-MAX_HISTORY_DEPTH)
      viewHistory.future = []
    }

    onSetDrawings(viewId, normalizedNext)
  }

  const undoDrawings = () => {
    const viewHistory = ensureHistory()
    const previous = viewHistory.past.pop()

    if (!previous) {
      return
    }

    viewHistory.future = [cloneDrawings(drawings), ...viewHistory.future].slice(0, MAX_HISTORY_DEPTH)
    onSetDrawings(viewId, cloneDrawings(previous))
    setSelectedDrawingId('')
  }

  const redoDrawings = () => {
    const viewHistory = ensureHistory()
    const next = viewHistory.future.shift()

    if (!next) {
      return
    }

    viewHistory.past = [...viewHistory.past, cloneDrawings(drawings)].slice(-MAX_HISTORY_DEPTH)
    onSetDrawings(viewId, cloneDrawings(next))
    setSelectedDrawingId('')
  }

  useEffect(
    () => () => {
      if (overlayRefreshFrameRef.current !== null) {
        window.cancelAnimationFrame(overlayRefreshFrameRef.current)
      }

      if (interactionFrameRef.current !== null) {
        window.cancelAnimationFrame(interactionFrameRef.current)
      }
    },
    []
  )

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsChartFullscreen(document.fullscreenElement === chartShellRef.current)
      scheduleOverlayRefresh()
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [scheduleOverlayRefresh])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const timeframeTarget = timeframeMenuRef.current
      const chartViewTarget = chartViewMenuRef.current
      const toolRailTarget = toolRailRef.current

      if (timeframeTarget && !timeframeTarget.contains(event.target as Node)) {
        setIsTimeframeMenuOpen(false)
      }

      if (chartViewTarget && !chartViewTarget.contains(event.target as Node)) {
        setIsChartViewMenuOpen(false)
      }

      if (toolRailTarget && !toolRailTarget.contains(event.target as Node)) {
        setExpandedToolGroupId(null)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
    }
  }, [])

  useEffect(() => {
    if (previewDismissRef.current) {
      window.clearTimeout(previewDismissRef.current)
    }
    overlaySignatureRef.current = ''
    pendingDraftRef.current = null
    pendingPreviewRef.current = null
    setDraftDrawing(null)
    setPreviewDrawing(null)
    interactionRef.current = null
    setSelectedDrawingId('')
    setShareTarget('profile')
    setShareTitle(`${snapshot.profile.symbol} teknik inceleme`)
    setShareBody('')
    setShareStatus('')
    setPreviewCandles([])
    setPreviewSummary('')
    setPreviewError('')
    setIsPreviewLoading(false)
    setChartViewMode('main')
    setExpandedToolGroupId(null)
  }, [snapshot.profile.symbol, viewId])

  useEffect(() => {
    if (!shareableFriends.length) {
      if (shareFriendId) {
        setShareFriendId('')
      }
      return
    }

    const currentStillExists = shareableFriends.some((friend) => friend.id === shareFriendId)

    if (!currentStillExists) {
      setShareFriendId(shareableFriends[0]?.id ?? '')
    }
  }, [shareFriendId, shareableFriends])

  const setChartFocusState = useCallback((focused: boolean) => {
    isChartFocusedRef.current = focused
    setIsChartFocused(focused)
  }, [])

  const handleChartFocus = useCallback(() => {
    setChartFocusState(true)
  }, [setChartFocusState])

  const handleChartBlur = useCallback(
    (event: ReactFocusEvent<HTMLDivElement>) => {
      if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
        return
      }

      setChartFocusState(false)
      setIsTimeframeMenuOpen(false)
      setIsChartViewMenuOpen(false)
      setExpandedToolGroupId(null)
    },
    [setChartFocusState]
  )

  useEffect(() => {
    if (!containerRef.current || !stageRef.current) {
      return
    }

    const stage = stageRef.current
    const initialHeight = Math.max(stage.clientHeight || DEFAULT_CHART_HEIGHT, DEFAULT_CHART_HEIGHT)
    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: chartPalette.background },
        textColor: chartPalette.text
      },
      localization: {
        locale: 'tr-TR'
      },
      grid: {
        vertLines: { color: chartPalette.grid },
        horzLines: { color: chartPalette.grid }
      },
      crosshair: {
        vertLine: { color: chartPalette.crosshair },
        horzLine: { color: chartPalette.crosshair }
      },
      width: stage.clientWidth,
      height: initialHeight,
      rightPriceScale: {
        borderVisible: false
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        rightOffset: 6,
        barSpacing: 10,
        lockVisibleTimeRangeOnResize: true
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: {
          time: false,
          price: true
        }
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false
      }
    })

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#f97316',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#f97316',
      priceFormat: {
        type: 'price',
        precision,
        minMove: 1 / 10 ** precision
      }
    })

    const metricSeries = chart.addAreaSeries({
      lineColor: '#4f8cff',
      topColor: 'rgba(79, 140, 255, 0.24)',
      bottomColor: 'rgba(79, 140, 255, 0.02)',
      lineWidth: 3,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      visible: false
    })

    const previewSeries = chart.addCandlestickSeries({
      upColor: 'rgba(79, 140, 255, 0.48)',
      downColor: 'rgba(246, 196, 69, 0.48)',
      borderUpColor: 'rgba(79, 140, 255, 0.7)',
      borderDownColor: 'rgba(246, 196, 69, 0.7)',
      wickUpColor: 'rgba(79, 140, 255, 0.7)',
      wickDownColor: 'rgba(246, 196, 69, 0.7)',
      lastValueVisible: false,
      priceLineVisible: false
    })

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    metricSeriesRef.current = metricSeries
    previewSeriesRef.current = previewSeries
    renderedCandleDataRef.current = []
    renderedMetricDataRef.current = []
    renderedPreviewDataRef.current = []
    setStageSize({ width: stage.clientWidth, height: initialHeight })

    const observer = new ResizeObserver(() => {
      const width = stage.clientWidth
      const height = Math.max(stage.clientHeight || DEFAULT_CHART_HEIGHT, DEFAULT_CHART_HEIGHT)
      chart.applyOptions({ width, height })
      setStageSize({ width, height })
      scheduleOverlayRefresh()
    })

    const handleVisibleRangeChange = () => {
      scheduleOverlayRefresh()
    }

    observer.observe(stage)
    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange)

    return () => {
      observer.disconnect()
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange)
      patternSeriesRef.current = []
      priceLinesRef.current = []
      candleSeriesRef.current = null
      metricSeriesRef.current = null
      previewSeriesRef.current = null
      renderedCandleDataRef.current = []
      renderedMetricDataRef.current = []
      renderedPreviewDataRef.current = []
      chartRef.current = null
      chart.remove()
    }
  }, [chartPalette, precision, scheduleOverlayRefresh])

  useEffect(() => {
    const chart = chartRef.current

    if (!chart) {
      return
    }

    chart.applyOptions({
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: activeTool === 'cursor',
        horzTouchDrag: true,
        vertTouchDrag: false
      }
    })
  }, [activeTool])

  useEffect(() => {
    const chart = chartRef.current
    const candleSeries = candleSeriesRef.current
    const metricSeries = metricSeriesRef.current
    const previewSeries = previewSeriesRef.current

    if (!chart || !candleSeries || !metricSeries || !previewSeries) {
      return
    }

    candleSeries.applyOptions({
      priceFormat: {
        type: 'price',
        precision,
        minMove: 1 / 10 ** precision
      },
      visible: isMainChartMode
    })
    const nextCandleData = isMainChartMode ? candleData : []
    const previousCandleData = renderedCandleDataRef.current

    if (!nextCandleData.length) {
      if (previousCandleData.length) {
        candleSeries.setData([])
      }
      liveCandleRef.current = null
    } else if (
      previousCandleData.length === nextCandleData.length &&
      areCandlestickDataPointsEqual(
        previousCandleData[previousCandleData.length - 2],
        nextCandleData[nextCandleData.length - 2]
      ) &&
      !areCandlestickDataPointsEqual(
        previousCandleData[previousCandleData.length - 1],
        nextCandleData[nextCandleData.length - 1]
      )
    ) {
      candleSeries.update(nextCandleData[nextCandleData.length - 1]!)
    } else if (
      !previousCandleData.length ||
      previousCandleData.length !== nextCandleData.length ||
      !areCandlestickDataPointsEqual(previousCandleData[0], nextCandleData[0]) ||
      !areCandlestickDataPointsEqual(
        previousCandleData[previousCandleData.length - 1],
        nextCandleData[nextCandleData.length - 1]
      )
    ) {
      candleSeries.setData(nextCandleData)
    }

    renderedCandleDataRef.current = nextCandleData
    liveCandleRef.current = nextCandleData[nextCandleData.length - 1] ?? null

    metricSeries.applyOptions(
      metricMode
        ? {
            ...metricPalette,
            visible: true,
            priceLineVisible: false,
            lastValueVisible: true,
            crosshairMarkerVisible: true,
            lineWidth: metricMode === 'volume' ? 2.4 : 2.8,
            priceFormat: {
              type: 'custom',
              minMove: metricMode === 'rsi' ? 1 : 0.001,
              formatter: (value: number) => formatMetricAxisValue(metricMode, value)
            }
          }
        : {
            visible: false
          }
    )
    const nextMetricData = metricMode ? metricSeriesData : []
    const previousMetricData = renderedMetricDataRef.current

    if (!nextMetricData.length) {
      if (previousMetricData.length) {
        metricSeries.setData([])
      }
    } else if (
      previousMetricData.length === nextMetricData.length &&
      areAreaDataPointsEqual(
        previousMetricData[previousMetricData.length - 2],
        nextMetricData[nextMetricData.length - 2]
      ) &&
      !areAreaDataPointsEqual(
        previousMetricData[previousMetricData.length - 1],
        nextMetricData[nextMetricData.length - 1]
      )
    ) {
      metricSeries.update(nextMetricData[nextMetricData.length - 1]!)
    } else if (
      !previousMetricData.length ||
      previousMetricData.length !== nextMetricData.length ||
      !areAreaDataPointsEqual(previousMetricData[0], nextMetricData[0]) ||
      !areAreaDataPointsEqual(
        previousMetricData[previousMetricData.length - 1],
        nextMetricData[nextMetricData.length - 1]
      )
    ) {
      metricSeries.setData(nextMetricData)
    }

    renderedMetricDataRef.current = nextMetricData

    previewSeries.applyOptions({
      visible: isMainChartMode && previewSeriesData.length > 0
    })
    const nextPreviewData = isMainChartMode ? previewSeriesData : []
    const previousPreviewData = renderedPreviewDataRef.current

    if (
      previousPreviewData.length !== nextPreviewData.length ||
      !areCandlestickDataPointsEqual(previousPreviewData[0], nextPreviewData[0]) ||
      !areCandlestickDataPointsEqual(
        previousPreviewData[previousPreviewData.length - 1],
        nextPreviewData[nextPreviewData.length - 1]
      )
    ) {
      previewSeries.setData(nextPreviewData)
    }

    renderedPreviewDataRef.current = nextPreviewData

    const overlaySignature = JSON.stringify({
      assetId: snapshot.profile.id,
      chartViewMode,
      showAiLayer,
      support: Number(indicators.support.toFixed(precision)),
      resistance: Number(indicators.resistance.toFixed(precision)),
      patterns: patterns.map((pattern) => [
        pattern.type,
        pattern.startIndex,
        pattern.endIndex,
        pattern.status,
        pattern.direction,
        pattern.breakoutLevel ? Number(pattern.breakoutLevel.toFixed(precision)) : null
      ])
    })

    if (overlaySignatureRef.current !== overlaySignature) {
      overlaySignatureRef.current = overlaySignature

    candleSeries.setMarkers(
      isMainChartMode && showAiLayer
        ? patterns.flatMap((pattern) => {
            const startCandle = snapshot.candles[pattern.startIndex]
            const endCandle = snapshot.candles[pattern.endIndex] ?? snapshot.candles[snapshot.candles.length - 1]

            if (!startCandle || !endCandle) {
              return []
            }

            const color = pattern.direction === 'bearish' ? '#ff7a18' : '#22c55e'
            const markerPosition = pattern.direction === 'bearish' ? 'aboveBar' : 'belowBar'

            return [
              {
                time: toChartTime(startCandle.time),
                position: markerPosition,
                color,
                shape: 'circle',
                text: `${pattern.label} başlangıç`
              },
              {
                time: toChartTime(endCandle.time),
                position: markerPosition,
                color,
                shape: pattern.direction === 'bearish' ? 'arrowDown' : 'arrowUp',
                text: pattern.label
              }
            ]
          })
        : []
    )

    chart.applyOptions({
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: metricMode
          ? {
              top: 0.08,
              bottom: 0.08
            }
          : {
              top: 0.05,
              bottom: 0.12
            }
      }
    })

    patternSeriesRef.current.forEach((series) => chart.removeSeries(series))
    patternSeriesRef.current = []

    priceLinesRef.current.forEach((priceLine) => candleSeries.removePriceLine(priceLine))
    priceLinesRef.current = []

    if (isMainChartMode && showAiLayer) {
      patterns.forEach((pattern) => {
        const color = pattern.direction === 'bearish' ? '#ff7a18' : '#22c55e'
        const lineSeries = chart.addLineSeries({
          color,
          lineWidth: 4,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
          priceFormat: {
            type: 'price',
            precision,
            minMove: 1 / 10 ** precision
          }
        })

        const lineData: LineData[] = snapshot.candles
          .slice(pattern.startIndex, pattern.endIndex + 1)
          .map((candle) => ({
            time: toChartTime(candle.time),
            value: candle.close
          }))

        lineSeries.setData(lineData)
        patternSeriesRef.current.push(lineSeries)

        if (pattern.breakoutLevel) {
          priceLinesRef.current.push(
            candleSeries.createPriceLine({
              price: pattern.breakoutLevel,
              color,
              lineStyle: 2,
              lineWidth: 2,
              title: `${pattern.label} ${formatEditableNumber(pattern.breakoutLevel)}`
            })
          )
        }
      })
    }

    priceLinesRef.current.push(
      candleSeries.createPriceLine({
        price: indicators.support,
        color: chartPalette.support,
        lineStyle: 2,
        lineWidth: 2,
        title: `Destek ${formatEditableNumber(indicators.support)}`
      })
    )

    priceLinesRef.current.push(
      candleSeries.createPriceLine({
        price: indicators.resistance,
        color: chartPalette.resistance,
        lineStyle: 2,
        lineWidth: 2,
        title: `Direnç ${formatEditableNumber(indicators.resistance)}`
      })
    )

    }

    const nextViewKey = `${snapshot.profile.id}:${selectedTimeframe}`

    if (viewKeyRef.current !== nextViewKey) {
      chart.timeScale().setVisibleLogicalRange(getDefaultVisibleRange(candleData.length))
      viewKeyRef.current = nextViewKey
      scheduleOverlayRefresh()
    }
  }, [
    candleData,
    chartPalette.resistance,
    chartPalette.support,
    chartViewMode,
    indicators,
    isMainChartMode,
    metricMode,
    metricPalette,
    metricSeriesData,
    patterns,
    precision,
    previewCandles,
    selectedTimeframe,
    showAiLayer,
    snapshot.candles,
    snapshot.profile.id,
    scheduleOverlayRefresh
  ])

  useEffect(() => {
    if (!isMainChartMode) {
      return
    }

    const handleLiveTick = (event: Event) => {
      const customEvent = event as CustomEvent<SelectedAssetLiveTickDetail>
      const candleSeries = candleSeriesRef.current

      if (
        !candleSeries ||
        customEvent.detail.assetId !== snapshot.profile.id ||
        customEvent.detail.timeframe !== selectedTimeframe
      ) {
        return
      }

      const currentLast =
        liveCandleRef.current ??
        renderedCandleDataRef.current[renderedCandleDataRef.current.length - 1]

      if (!currentLast) {
        return
      }

      const nextPrice = customEvent.detail.quote.price
      const nextLiveCandle: CandlestickData = {
        ...currentLast,
        close: nextPrice,
        high: Math.max(currentLast.high, nextPrice),
        low: Math.min(currentLast.low, nextPrice)
      }

      if (areCandlestickDataPointsEqual(currentLast, nextLiveCandle)) {
        return
      }

      liveCandleRef.current = nextLiveCandle
      candleSeries.update(nextLiveCandle)
    }

    window.addEventListener(
      'avy:selected-asset-live-tick',
      handleLiveTick as EventListener
    )

    return () => {
      window.removeEventListener(
        'avy:selected-asset-live-tick',
        handleLiveTick as EventListener
      )
    }
  }, [isMainChartMode, selectedTimeframe, snapshot.profile.id])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isChartFocusedRef.current) {
        return
      }

      const activeElement = document.activeElement
      const isTextInput =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement

      if (event.key === 'Escape') {
        event.preventDefault()
        interactionRef.current = null
        setSelectedDrawingId('')
        setDraftDrawing(null)
        setPreviewDrawing(null)
        return
      }

      if (isTextInput) {
        return
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedDrawingId) {
        event.preventDefault()
        replaceDrawings(drawings.filter((drawing) => drawing.id !== selectedDrawingId))
        setSelectedDrawingId('')
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c' && selectedDrawingId) {
        event.preventDefault()
        const selected = drawings.find((drawing) => drawing.id === selectedDrawingId)

        if (!selected) {
          return
        }

        clipboardDrawingRef.current = cloneDrawing(selected)
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v' && clipboardDrawingRef.current) {
        event.preventDefault()
        const pasted = shiftDrawing(
          { ...cloneDrawing(clipboardDrawingRef.current), id: createId('drawing') },
          snapshot.candles,
          2,
          snapshot.quote.price * 0.0025
        )
        replaceDrawings([...drawings, pasted])
        setSelectedDrawingId(pasted.id)
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd' && selectedDrawingId) {
        event.preventDefault()
        const selected = drawings.find((drawing) => drawing.id === selectedDrawingId)

        if (!selected) {
          return
        }

        const duplicated = shiftDrawing({ ...cloneDrawing(selected), id: createId('drawing') }, snapshot.candles, 2, snapshot.quote.price * 0.0025)
        replaceDrawings([...drawings, duplicated])
        setSelectedDrawingId(duplicated.id)
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && event.shiftKey) {
        event.preventDefault()
        redoDrawings()
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        undoDrawings()
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        redoDrawings()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [drawings, selectedDrawingId, snapshot.candles, snapshot.quote.price])

  const toX = (anchor: ChartDrawingAnchor): number | null => {
    const chart = chartRef.current

    if (!chart) {
      return null
    }

    return chart.timeScale().timeToCoordinate(toChartTime(anchor.time)) ?? null
  }

  const toY = (price: number): number | null => {
    const candleSeries = candleSeriesRef.current

    if (!candleSeries) {
      return null
    }

    return candleSeries.priceToCoordinate(price) ?? null
  }

  const toPoint = (anchor: ChartDrawingAnchor): PointGeometry | null => {
    const x = toX(anchor)
    const y = toY(anchor.price)

    if (x === null || y === null) {
      return null
    }

    return { x, y }
  }

  const snapPriceToCandle = (rawPrice: number, _candleIndex: number): number => rawPrice

  const buildAnchorFromClientPoint = (clientX: number, clientY: number): ChartDrawingAnchor | null => {
    const chart = chartRef.current
    const candleSeries = candleSeriesRef.current
    const stage = stageRef.current

    if (!chart || !candleSeries || !stage) {
      return null
    }

    const rect = stage.getBoundingClientRect()
    const x = clamp(clientX - rect.left, 0, rect.width)
    const y = clamp(clientY - rect.top, 0, rect.height)
    const logical = chart.timeScale().coordinateToLogical(x)
    const price = candleSeries.coordinateToPrice(y)

    if (logical === null || logical === undefined || price === null || price === undefined) {
      return null
    }

    const candleIndex = clamp(Math.round(logical), 0, snapshot.candles.length - 1)
    const candle = snapshot.candles[candleIndex]

    if (!candle) {
      return null
    }

    return {
      time: candle.time,
      price: snapPriceToCandle(price, candleIndex)
    }
  }

  const drawingToPoints = (drawing: ChartDrawing): PointGeometry[] => {
    if (drawing.type === 'brush' && drawing.points?.length) {
      return drawing.points
        .map((point) => toPoint(point))
        .filter((point): point is PointGeometry => Boolean(point))
    }

    const points = [toPoint(drawing.start), toPoint(drawing.end)]
    return points.filter((point): point is PointGeometry => Boolean(point))
  }

  const getDrawingHit = (drawing: ChartDrawing, point: PointGeometry): DrawingHit | null => {
    const start = toPoint(drawing.start)
    const end = toPoint(drawing.end)

    if (!start || !end) {
      return null
    }

    if (Math.hypot(point.x - start.x, point.y - start.y) <= HIT_DISTANCE) {
      return { drawingId: drawing.id, kind: 'resize', handle: 'start' }
    }

    if (Math.hypot(point.x - end.x, point.y - end.y) <= HIT_DISTANCE) {
      return { drawingId: drawing.id, kind: 'resize', handle: 'end' }
    }

    if (drawing.type === 'horizontal_line') {
      return Math.abs(point.y - start.y) <= HIT_DISTANCE
        ? { drawingId: drawing.id, kind: 'move' }
        : null
    }

    if (drawing.type === 'vertical_line') {
      return Math.abs(point.x - start.x) <= HIT_DISTANCE
        ? { drawingId: drawing.id, kind: 'move' }
        : null
    }

    if (
      drawing.type === 'rectangle' ||
      drawing.type === 'support_resistance_zone' ||
      drawing.type === 'risk_reward' ||
      drawing.type === 'fib_retracement'
    ) {
      const left = Math.min(start.x, end.x) - HIT_DISTANCE
      const right = Math.max(start.x, end.x) + HIT_DISTANCE
      const top = Math.min(start.y, end.y) - HIT_DISTANCE
      const bottom = Math.max(start.y, end.y) + HIT_DISTANCE

      if (point.x >= left && point.x <= right && point.y >= top && point.y <= bottom) {
        return { drawingId: drawing.id, kind: 'move' }
      }

      return null
    }

    if (drawing.type === 'text_note' || drawing.type === 'price_label') {
      const width = drawing.type === 'text_note' ? 184 : 120
      const height = drawing.type === 'text_note' ? 60 : 26

      if (
        point.x >= start.x - 12 &&
        point.x <= start.x + width &&
        point.y >= start.y - height &&
        point.y <= start.y + 12
      ) {
        return { drawingId: drawing.id, kind: 'move' }
      }

      return null
    }

    if (drawing.type === 'brush') {
      const points = drawingToPoints(drawing)

      for (let index = 0; index < points.length - 1; index += 1) {
        if (distanceToSegment(point, points[index], points[index + 1]) <= HIT_DISTANCE) {
          return { drawingId: drawing.id, kind: 'move' }
        }
      }

      return null
    }

    return distanceToSegment(point, start, end) <= HIT_DISTANCE
      ? { drawingId: drawing.id, kind: 'move' }
      : null
  }

  const pickDrawingAtClientPoint = (clientX: number, clientY: number): DrawingHit | null => {
    const stage = stageRef.current

    if (!stage) {
      return null
    }

    const rect = stage.getBoundingClientRect()
    const point = {
      x: clamp(clientX - rect.left, 0, rect.width),
      y: clamp(clientY - rect.top, 0, rect.height)
    }

    const orderedDrawings = [...drawings].reverse()

    for (const drawing of orderedDrawings) {
      const hit = getDrawingHit(drawing, point)

      if (hit) {
        return hit
      }
    }

    return null
  }

  const focusChartShell = () => {
    chartShellRef.current?.focus({ preventScroll: true })
    setChartFocusState(true)
  }

  const beginDrawing = (event: ReactPointerEvent<HTMLDivElement>) => {
    focusChartShell()
    const anchor = buildAnchorFromClientPoint(event.clientX, event.clientY)

    if (!anchor) {
      return
    }

    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Pointer capture is a best-effort quality improvement.
    }

    setShareStatus('')

    if (activeTool === 'cursor') {
      const hit = pickDrawingAtClientPoint(event.clientX, event.clientY)

      if (!hit) {
        setSelectedDrawingId('')
        return
      }

      const selectedDrawing = drawings.find((drawing) => drawing.id === hit.drawingId)

      if (!selectedDrawing) {
        return
      }

      setSelectedDrawingId(selectedDrawing.id)
      interactionRef.current = {
        pointerId: event.pointerId,
        kind: hit.kind,
        tool: activeTool,
        startAnchor: anchor,
        startClientX: event.clientX,
        startClientY: event.clientY,
        drawingId: selectedDrawing.id,
        handle: hit.handle
      }
      return
    }

    if (SINGLE_POINT_TOOLS.includes(activeTool as ChartDrawingType)) {
      const nextDrawing = buildDrawing(activeTool as ChartDrawingType, anchor, anchor, snapshot)
      onAddDrawing(viewId, nextDrawing)
      setSelectedDrawingId(nextDrawing.id)
      return
    }

    const initialDrawing = buildDrawing(activeTool as ChartDrawingType, anchor, anchor, snapshot)

    interactionRef.current = {
      pointerId: event.pointerId,
      kind: 'draw',
      tool: activeTool,
      startAnchor: anchor,
      startClientX: event.clientX,
      startClientY: event.clientY,
      draftDrawing: initialDrawing
    }

    pendingDraftRef.current = initialDrawing
    pendingPreviewRef.current = null
    flushInteractionState()
  }

  const updateDrawing = (event: ReactPointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current

    if (!interaction || interaction.pointerId !== event.pointerId) {
      return
    }

    const anchor = buildAnchorFromClientPoint(event.clientX, event.clientY)

    if (!anchor) {
      return
    }

    if (interaction.kind === 'draw' && interaction.draftDrawing) {
      if (interaction.tool === 'brush') {
        const nextPoints = [...(interaction.draftDrawing.points ?? [interaction.startAnchor])]
        const lastPoint = nextPoints[nextPoints.length - 1]
        const deltaBars = Math.abs(
          findCandleIndexByTime(snapshot.candles, anchor.time) - findCandleIndexByTime(snapshot.candles, lastPoint.time)
        )
        const deltaPrice = Math.abs(anchor.price - lastPoint.price)

        if (deltaBars >= 1 || deltaPrice >= snapshot.quote.price * 0.0008) {
          nextPoints.push(anchor)
        }

        const nextDrawing: ChartDrawing = {
          ...interaction.draftDrawing,
          end: anchor,
          points: brushPointReduction(nextPoints)
        }

        interactionRef.current = {
          ...interaction,
          draftDrawing: nextDrawing
        }
        pendingDraftRef.current = nextDrawing
        flushInteractionState()
        return
      }

      const nextDrawing = buildDrawing(
        interaction.tool as ChartDrawingType,
        interaction.startAnchor,
        anchor,
        snapshot
      )
      nextDrawing.id = interaction.draftDrawing.id
      nextDrawing.note = interaction.draftDrawing.note
      nextDrawing.label = interaction.tool === 'ruler' ? formatMeasureLabel(interaction.startAnchor, anchor) : interaction.draftDrawing.label
      interactionRef.current = {
        ...interaction,
        draftDrawing: nextDrawing
      }
      pendingDraftRef.current = nextDrawing
      flushInteractionState()
      return
    }

    const baseDrawing = drawings.find((drawing) => drawing.id === interaction.drawingId)

    if (!baseDrawing) {
      return
    }

    if (interaction.kind === 'resize' && interaction.handle) {
      const nextDrawing = withUpdatedHandle(baseDrawing, interaction.handle, anchor)
      interactionRef.current = {
        ...interaction,
        previewDrawing: nextDrawing
      }
      pendingPreviewRef.current = nextDrawing
      flushInteractionState()
      return
    }

    const barOffset =
      findCandleIndexByTime(snapshot.candles, anchor.time) -
      findCandleIndexByTime(snapshot.candles, interaction.startAnchor.time)
    const priceOffset = anchor.price - interaction.startAnchor.price
    const nextDrawing = shiftDrawing(baseDrawing, snapshot.candles, barOffset, priceOffset)

    interactionRef.current = {
      ...interaction,
      previewDrawing: nextDrawing
    }
    pendingPreviewRef.current = nextDrawing
    flushInteractionState()
  }

  const finishDrawing = (event: ReactPointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current

    if (!interaction) {
      return
    }

    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // Pointer capture may already be released.
    }

    if (interaction.kind === 'draw') {
      const anchor = buildAnchorFromClientPoint(event.clientX, event.clientY) ?? draftDrawing?.end ?? interaction.startAnchor
      const delta = Math.hypot(event.clientX - interaction.startClientX, event.clientY - interaction.startClientY)

      if (interaction.tool !== 'brush' && delta < MIN_DRAG_DISTANCE) {
        setShareStatus('Çizim için grafikte tıklayıp sürüklemen gerekiyor.')
        interactionRef.current = null
        setDraftDrawing(null)
        return
      }

      const drawing =
        interaction.tool === 'brush' && interaction.draftDrawing
          ? {
              ...interaction.draftDrawing,
              end: anchor,
              points: brushPointReduction(interaction.draftDrawing.points ?? [interaction.startAnchor, anchor])
            }
          : interaction.draftDrawing
            ? {
                ...interaction.draftDrawing,
                end: anchor,
                label:
                  interaction.tool === 'ruler'
                    ? formatMeasureLabel(interaction.startAnchor, anchor)
                    : interaction.draftDrawing.label
              }
            : buildDrawing(interaction.tool as ChartDrawingType, interaction.startAnchor, anchor, snapshot)

      onAddDrawing(viewId, drawing)
      setSelectedDrawingId(drawing.id)
      interactionRef.current = null
      pendingDraftRef.current = null
      pendingPreviewRef.current = null
      setDraftDrawing(null)
      setPreviewDrawing(null)
      return
    }

    if (interaction.previewDrawing && interaction.drawingId) {
      replaceDrawings(
        drawings.map((drawing) => (drawing.id === interaction.drawingId ? interaction.previewDrawing! : drawing))
      )
      setSelectedDrawingId(interaction.drawingId)
    }

    interactionRef.current = null
    pendingDraftRef.current = null
    pendingPreviewRef.current = null
    setPreviewDrawing(null)
  }

  const cancelDrawing = () => {
    interactionRef.current = null
    pendingDraftRef.current = null
    pendingPreviewRef.current = null
    setDraftDrawing(null)
    setPreviewDrawing(null)
  }

  const renderSelectionHandles = (drawing: ChartDrawing) => {
    const start = toPoint(drawing.start)
    const end = toPoint(drawing.end)

    if (!start || !end) {
      return null
    }

    return (
      <>
        <circle cx={start.x} cy={start.y} r={HANDLE_RADIUS} fill="#ffffff" stroke={drawing.color} strokeWidth={2} />
        <circle cx={end.x} cy={end.y} r={HANDLE_RADIUS} fill="#ffffff" stroke={drawing.color} strokeWidth={2} />
      </>
    )
  }

  const renderRiskReward = (drawing: ChartDrawing, opacity: number) => {
    const start = toPoint(drawing.start)
    const end = toPoint(drawing.end)

    if (!start || !end) {
      return null
    }

    const left = Math.min(start.x, end.x)
    const width = Math.max(Math.abs(end.x - start.x), 48)
    const entryY = start.y
    const targetDistance = end.y - start.y
    const stopY = entryY - targetDistance / 2
    const top = Math.min(stopY, entryY, end.y)
    const bottom = Math.max(stopY, entryY, end.y)
    const targetTop = Math.min(entryY, end.y)
    const targetHeight = Math.abs(entryY - end.y)
    const riskTop = Math.min(entryY, stopY)
    const riskHeight = Math.abs(entryY - stopY)

    return (
      <g key={drawing.id} opacity={opacity}>
        <rect x={left} y={targetTop} width={width} height={targetHeight} fill="rgba(52, 211, 153, 0.18)" stroke={REWARD_COLOR} strokeWidth={1.5} rx={12} />
        <rect x={left} y={riskTop} width={width} height={riskHeight} fill="rgba(248, 113, 113, 0.18)" stroke={RISK_COLOR} strokeWidth={1.5} rx={12} />
        <line x1={left} x2={left + width} y1={entryY} y2={entryY} stroke={drawing.color} strokeWidth={2} strokeDasharray="6 5" />
        {selectedDrawingId === drawing.id ? renderSelectionHandles(drawing) : null}
      </g>
    )
  }

  const renderDrawing = (drawing: ChartDrawing, draft = false) => {
    const width = stageSize.width
    const height = stageSize.height

    if (!width || !height) {
      return null
    }

    const style = normalizeStyle(drawing)
    const opacity = draft ? 0.7 : 1
    const isSelected = selectedDrawingId === drawing.id
    const start = toPoint(drawing.start)
    const end = toPoint(drawing.end)

    if (!start || !end) {
      return null
    }

    if (drawing.type === 'horizontal_line') {
      return (
        <g key={drawing.id} opacity={opacity}>
          <line x1={0} x2={width} y1={start.y} y2={start.y} stroke={drawing.color} strokeWidth={style.strokeWidth} strokeDasharray="8 6" />
          {isSelected ? renderSelectionHandles(drawing) : null}
        </g>
      )
    }

    if (drawing.type === 'vertical_line') {
      return (
        <g key={drawing.id} opacity={opacity}>
          <line x1={start.x} x2={start.x} y1={0} y2={height} stroke={drawing.color} strokeWidth={style.strokeWidth} strokeDasharray="8 6" />
          {isSelected ? renderSelectionHandles(drawing) : null}
        </g>
      )
    }

    if (drawing.type === 'rectangle' || drawing.type === 'support_resistance_zone') {
      const rectX = Math.min(start.x, end.x)
      const rectY = Math.min(start.y, end.y)
      const rectWidth = Math.abs(end.x - start.x)
      const rectHeight = Math.abs(end.y - start.y)

      return (
        <g key={drawing.id} opacity={opacity}>
          <rect
            x={rectX}
            y={rectY}
            width={rectWidth}
            height={rectHeight}
            fill={drawing.fillColor ?? `rgba(246, 196, 69, ${style.fillOpacity})`}
            stroke={drawing.color}
            strokeWidth={style.strokeWidth}
            rx={12}
          />
          {drawing.label ? (
            <>
              <rect
                x={rectX + 8}
                y={rectY + 8}
                width={Math.max(84, drawing.label.length * 6.4)}
                height={22}
                rx={11}
                fill={chartPalette.labelFill}
                stroke={chartPalette.labelStroke}
              />
              <text x={rectX + 14} y={rectY + 23} fill={drawing.textColor ?? chartPalette.labelText} fontSize={style.textSize}>
                {drawing.label}
              </text>
            </>
          ) : null}
          {isSelected ? renderSelectionHandles(drawing) : null}
        </g>
      )
    }

    if (drawing.type === 'fib_retracement') {
      const [startAnchor, endAnchor] = sortAnchorsByTime(drawing.start, drawing.end)
      const startPoint = toPoint(startAnchor)
      const endPoint = toPoint(endAnchor)

      if (!startPoint || !endPoint) {
        return null
      }

      const baseX = Math.min(startPoint.x, endPoint.x)
      const fibWidth = Math.abs(endPoint.x - startPoint.x)
      const high = Math.max(startAnchor.price, endAnchor.price)
      const low = Math.min(startAnchor.price, endAnchor.price)
      const range = high - low || 1

      return (
        <g key={drawing.id} opacity={opacity}>
          <rect
            x={baseX}
            y={Math.min(startPoint.y, endPoint.y)}
            width={fibWidth}
            height={Math.abs(endPoint.y - startPoint.y)}
            fill={drawing.fillColor ?? `rgba(246, 196, 69, ${style.fillOpacity * 0.5})`}
            stroke="rgba(246, 196, 69, 0.22)"
            strokeWidth={1.5}
            rx={12}
          />
          {FIB_LEVELS.map((level) => {
            const value = high - range * level
            const levelY = toY(value)

            if (levelY === null) {
              return null
            }

            return (
              <g key={`${drawing.id}-${level}`}>
                <line
                  x1={baseX}
                  x2={baseX + fibWidth}
                  y1={levelY}
                  y2={levelY}
                  stroke={drawing.color}
                  strokeWidth={level === 0 || level === 1 ? style.strokeWidth : Math.max(1.4, style.strokeWidth - 0.8)}
                  strokeDasharray={level === 0 || level === 1 ? '0' : '6 5'}
                />
                <text x={baseX + 14} y={levelY - 4} fill={chartPalette.labelText} fontSize={11}>
                  {`${(level * 100).toFixed(1)}%`}
                </text>
              </g>
            )
          })}
          {isSelected ? renderSelectionHandles(drawing) : null}
        </g>
      )
    }

    if (drawing.type === 'arrow') {
      return (
        <g key={drawing.id} opacity={opacity}>
          <line x1={start.x} x2={end.x} y1={start.y} y2={end.y} stroke={drawing.color} strokeWidth={style.strokeWidth} />
          <polygon points={createArrowHead(start, end)} fill={drawing.color} />
          {isSelected ? renderSelectionHandles(drawing) : null}
        </g>
      )
    }

    if (drawing.type === 'text_note') {
      const widthValue = 184
      const heightValue = 60

      return (
        <g key={drawing.id} opacity={opacity}>
          <rect
            x={start.x}
            y={start.y - heightValue}
            width={widthValue}
            height={heightValue}
            rx={16}
            fill={chartPalette.lineFill}
            stroke={drawing.color}
            strokeWidth={style.strokeWidth}
          />
          <text x={start.x + 14} y={start.y - 34} fill={drawing.textColor ?? chartPalette.labelText} fontSize={style.textSize + 1}>
            {drawing.label ?? 'Not'}
          </text>
          <text x={start.x + 14} y={start.y - 16} fill={drawing.textColor ?? chartPalette.text} fontSize={style.textSize}>
            {(drawing.note ?? 'Not ekle').slice(0, 38)}
          </text>
          {isSelected ? renderSelectionHandles(drawing) : null}
        </g>
      )
    }

    if (drawing.type === 'price_label') {
      const label = drawing.label ?? formatEditableNumber(drawing.start.price)

      return (
        <g key={drawing.id} opacity={opacity}>
          <line x1={start.x} x2={width} y1={start.y} y2={start.y} stroke={drawing.color} strokeWidth={1.25} strokeDasharray="5 4" />
          <rect x={width - 118} y={start.y - 12} width={110} height={24} rx={12} fill={chartPalette.labelFill} stroke={drawing.color} strokeWidth={1.5} />
          <text x={width - 63} y={start.y + 4} fill={drawing.textColor ?? chartPalette.labelText} fontSize={style.textSize} textAnchor="middle">
            {label}
          </text>
          {isSelected ? renderSelectionHandles(drawing) : null}
        </g>
      )
    }

    if (drawing.type === 'risk_reward') {
      return renderRiskReward(drawing, opacity)
    }

    if (drawing.type === 'brush') {
      const points = drawingToPoints(drawing)

      if (points.length < 2) {
        return null
      }

      return (
        <g key={drawing.id} opacity={opacity}>
          <polyline
            points={points.map((point) => `${point.x},${point.y}`).join(' ')}
            fill="none"
            stroke={drawing.color}
            strokeWidth={style.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {isSelected ? renderSelectionHandles(drawing) : null}
        </g>
      )
    }

    if (drawing.type === 'ruler') {
      const midX = (start.x + end.x) / 2
      const midY = (start.y + end.y) / 2
      const startIndex = snapshot.candles.findIndex((candle) => candle.time === drawing.start.time)
      const endIndex = snapshot.candles.findIndex((candle) => candle.time === drawing.end.time)
      const bars = startIndex >= 0 && endIndex >= 0 ? Math.abs(endIndex - startIndex) : 0
      const label = drawing.label ?? `${formatMeasureLabel(drawing.start, drawing.end)} • ${bars} bar`

      return (
        <g key={drawing.id} opacity={opacity}>
          <line x1={start.x} x2={end.x} y1={start.y} y2={end.y} stroke={drawing.color} strokeWidth={style.strokeWidth} />
          <rect
            x={midX - 96}
            y={midY - 16}
            width={192}
            height={24}
            rx={12}
            fill={chartPalette.labelFill}
            stroke={chartPalette.labelStroke}
          />
          <text x={midX} y={midY + 1} fill={chartPalette.labelText} textAnchor="middle" fontSize={style.textSize}>
            {label}
          </text>
          {isSelected ? renderSelectionHandles(drawing) : null}
        </g>
      )
    }

    return (
      <g key={drawing.id} opacity={opacity}>
        <line x1={start.x} x2={end.x} y1={start.y} y2={end.y} stroke={drawing.color} strokeWidth={style.strokeWidth} />
        {isSelected ? renderSelectionHandles(drawing) : null}
      </g>
    )
  }

  const renderedDrawings = useMemo(() => {
    if (!isMainChartMode) {
      return []
    }

    const next = showUserLayer ? [...drawings] : []

    if (previewDrawing) {
      const index = next.findIndex((drawing) => drawing.id === previewDrawing.id)

      if (index >= 0) {
        next[index] = previewDrawing
      } else {
        next.push(previewDrawing)
      }
    }

    if (draftDrawing) {
      next.push(draftDrawing)
    }

    return next
  }, [draftDrawing, drawings, isMainChartMode, previewDrawing, showUserLayer])
  const hasOverlayContent = renderedDrawings.length > 0

  useEffect(() => {
    overlayEnabledRef.current = hasOverlayContent
  }, [hasOverlayContent])

  const shiftViewport = (direction: 'left' | 'right') => {
    const chart = chartRef.current
    if (!chart) {
      return
    }

    const range = chart.timeScale().getVisibleLogicalRange()
    if (!range) {
      return
    }

    const span = range.to - range.from
    const delta = span * 0.35 * (direction === 'left' ? -1 : 1)
    chart.timeScale().setVisibleLogicalRange({
      from: range.from + delta,
      to: range.to + delta
    })
  }

  const zoomViewport = (direction: 'in' | 'out') => {
    const chart = chartRef.current
    if (!chart) {
      return
    }

    const range = chart.timeScale().getVisibleLogicalRange()
    if (!range) {
      return
    }

    const span = range.to - range.from
    const center = (range.to + range.from) / 2
    const nextSpan =
      direction === 'in'
        ? Math.max(20, span * 0.72)
        : Math.min(snapshot.candles.length + 24, span * 1.35)

    chart.timeScale().setVisibleLogicalRange({
      from: center - nextSpan / 2,
      to: center + nextSpan / 2
    })
  }

  const resetViewport = () => {
    const chart = chartRef.current
    if (!chart) {
      return
    }

    chart.timeScale().setVisibleLogicalRange(getDefaultVisibleRange(candleData.length))
  }

  const clearPreview = useCallback(() => {
    if (previewDismissRef.current) {
      window.clearTimeout(previewDismissRef.current)
      previewDismissRef.current = undefined
    }

    setPreviewCandles([])
    setPreviewSummary('')
    setPreviewError('')
    setIsPreviewLoading(false)
  }, [])

  const runAiPreview = async () => {
    if (selectedTimeframe !== '4H' || !isMainChartMode) {
      return
    }

    clearPreview()
    setIsPreviewLoading(true)

    try {
      await new Promise((resolve) => window.setTimeout(resolve, 240))
      const scenario = buildAiPreviewScenario({
        snapshot,
        timeframe: selectedTimeframe,
        indicators,
        patterns,
        news
      })

      if (!scenario.candles.length) {
        throw new Error('Önizleme için yeterli veri bulunamadı.')
      }

      setPreviewCandles(scenario.candles)
      setPreviewSummary(scenario.summary)
      previewDismissRef.current = window.setTimeout(() => {
        setPreviewCandles([])
        setPreviewSummary('')
      }, 5000)
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'AI önizleme hazırlanamadı.')
    } finally {
      setIsPreviewLoading(false)
    }
  }

  const toggleFullscreen = async () => {
    const shell = chartShellRef.current

    if (!shell) {
      return
    }

    try {
      if (document.fullscreenElement === shell) {
        await document.exitFullscreen()
      } else {
        await shell.requestFullscreen()
      }
    } catch (error) {
      console.error('AVY chart fullscreen toggle failed', error)
    }
  }

  useEffect(() => {
    if (selectedTimeframe !== '4H' || !isMainChartMode) {
      clearPreview()
      setIsShareOpen(false)
    }
  }, [clearPreview, isMainChartMode, selectedTimeframe])

  const selectedDrawing = drawings.find((drawing) => drawing.id === selectedDrawingId)

  const updateSelectedDrawing = (updater: (drawing: ChartDrawing) => ChartDrawing) => {
    if (!selectedDrawing) {
      return
    }

    replaceDrawings(drawings.map((drawing) => (drawing.id === selectedDrawing.id ? updater(drawing) : drawing)))
  }

  const publishAnalysis = async () => {
    const normalizedTitle = buildShareTitle(snapshot.profile.symbol, shareTitle)
    const normalizedBody = buildShareBody(
      snapshot.profile.symbol,
      selectedTimeframe,
      drawings,
      patterns,
      shareBody
    )

    setIsPublishing(true)
    setShareStatus('')

    try {
      let snapshotDataUrl: string | undefined

      if (stageRef.current) {
        try {
          snapshotDataUrl = await captureChartSnapshot(stageRef.current, overlayRef.current)
        } catch {
          snapshotDataUrl = undefined
        }
      }

      if (shareTarget === 'profile') {
        if (!canPublishAnalysis) {
          setShareStatus('Profilinde paylaşmak için sosyal hesabın açık olmalı.')
          return
        }

        await onPublishAnalysis({
          title: normalizedTitle,
          body: normalizedBody,
          snapshotDataUrl
        })

        setShareStatus('İnceleme profilinde paylaşıldı.')
        setIsShareOpen(true)
      } else {
        if (!shareFriendId) {
          setShareStatus('DM paylaşımı için bir arkadaş seç.')
          return
        }

        await onShareAnalysisToFriend({
          friendId: shareFriendId,
          title: normalizedTitle,
          body: normalizedBody,
          snapshotDataUrl
        })

        setShareStatus('İnceleme arkadaşına gönderildi.')
        setIsShareOpen(true)
      }

      setShareBody('')
    } catch (error) {
      setShareStatus(error instanceof Error ? error.message : 'Analiz paylaşılamadı.')
    } finally {
      setIsPublishing(false)
    }
  }

  const sharePreviewTitle = buildShareTitle(snapshot.profile.symbol, shareTitle)
  const sharePreviewBody = buildShareBody(
    snapshot.profile.symbol,
    selectedTimeframe,
    drawings,
    patterns,
    shareBody
  )
  const hasShareContent = drawings.length > 0 || patterns.length > 0

  const openSharePanel = () => {
    setShareStatus('')
    setIsShareOpen(true)
    window.requestAnimationFrame(() => {
      sharePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }

  const getDraftHint = (): string => {
    if (activeTool === 'cursor') {
      return 'Çizimleri seçebilir, sürükleyebilir, yeniden boyutlandırabilir ve klavyeden sil tuşuyla kaldırabilirsin.'
    }

    if (activeTool === 'horizontal_line' || activeTool === 'vertical_line' || activeTool === 'text_note' || activeTool === 'price_label') {
      return 'Grafikte tek tıklama ile objeyi bırakabilirsin.'
    }

    if (activeTool === 'brush') {
      return 'Grafikte basılı tutup sürükleyerek serbest çizim yap.'
    }

    return 'Grafik üzerinde tıklayıp sürükleyerek çizimi oluştur.'
  }

  return (
    <Panel
      title="Grafik"
      className="panel--chart-terminal"
      subtitle={`${snapshot.profile.symbol} fiyat grafiği`}
      action={
        <div className="chart-toolbar chart-toolbar--terminal">
          <div className="chart-toolbar__cluster">
            <div ref={timeframeMenuRef}>
              <CompactToolbarSelect
                label="Zaman dilimi"
                value={selectedTimeframe}
                options={timeframeMenuOptions}
                isOpen={isTimeframeMenuOpen}
                onToggle={() => {
                  setIsTimeframeMenuOpen((value) => !value)
                  setIsChartViewMenuOpen(false)
                }}
                onSelect={(timeframe) => {
                  onTimeframeChange(timeframe)
                  setIsTimeframeMenuOpen(false)
                }}
              />
            </div>
            <div ref={chartViewMenuRef}>
              <CompactToolbarSelect
                label="Grafik türü"
                value={chartViewMode}
                options={chartViewMenuOptions}
                isOpen={isChartViewMenuOpen}
                onToggle={() => {
                  setIsChartViewMenuOpen((value) => !value)
                  setIsTimeframeMenuOpen(false)
                }}
                onSelect={(mode) => {
                  setChartViewMode(mode)
                  setShareStatus('')
                  setIsChartViewMenuOpen(false)
                  if (mode !== 'main') {
                    setIsShareOpen(false)
                  }
                }}
              />
            </div>
          </div>
          <div className="chart-toolbar__cluster chart-toolbar__cluster--actions">
            {selectedTimeframe === '4H' && isMainChartMode ? (
              <button
                type="button"
                className={previewCandles.length ? 'chart-toolbar-pill chart-toolbar-pill--active' : 'chart-toolbar-pill'}
                onClick={() => {
                  if (previewCandles.length) {
                    clearPreview()
                    return
                  }

                  void runAiPreview()
                }}
                title="AI önizleme"
              >
                {isPreviewLoading ? 'Önizleme hazırlanıyor' : previewCandles.length ? 'Önizlemeyi kapat' : 'Önizleme'}
              </button>
            ) : null}
            <button
              type="button"
              className={isChartFullscreen ? 'chart-toolbar-icon chart-toolbar-icon--active' : 'chart-toolbar-icon'}
              onClick={() => void toggleFullscreen()}
              title={isChartFullscreen ? 'Tam ekrandan çık' : 'Tam ekran'}
            >
              {isChartFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
            <button type="button" className="chart-toolbar-icon" onClick={() => shiftViewport('left')} title="Grafikte geri kay">
              <StepBack size={15} />
            </button>
            <button type="button" className="chart-toolbar-icon" onClick={() => shiftViewport('right')} title="Grafikte ileri kay">
              <StepForward size={15} />
            </button>
            <button type="button" className="chart-toolbar-icon" onClick={() => zoomViewport('in')} title="Yakınlaş">
              <ZoomIn size={15} />
            </button>
            <button type="button" className="chart-toolbar-icon" onClick={() => zoomViewport('out')} title="Uzaklaş">
              <ZoomOut size={15} />
            </button>
            <button
              type="button"
              className={canUndo ? 'chart-toolbar-icon' : 'chart-toolbar-icon chart-toolbar-icon--disabled'}
              disabled={!canUndo}
              onClick={undoDrawings}
              title="Geri al"
            >
              <Undo2 size={15} />
            </button>
            <button
              type="button"
              className={canRedo ? 'chart-toolbar-icon' : 'chart-toolbar-icon chart-toolbar-icon--disabled'}
              disabled={!canRedo}
              onClick={redoDrawings}
              title="Yinele"
            >
              <Redo2 size={15} />
            </button>
            <button
              type="button"
              className={isShareOpen ? 'chart-toolbar-icon chart-toolbar-icon--active' : 'chart-toolbar-icon'}
              disabled={!isMainChartMode}
              onClick={() => {
                if (isShareOpen) {
                  setIsShareOpen(false)
                  return
                }

                openSharePanel()
              }}
              title="Paylaş"
            >
              <Share2 size={15} />
            </button>
          </div>
        </div>
      }
    >
      <div className="chart-panel chart-panel--advanced">
        <div
          ref={chartShellRef}
          tabIndex={0}
          className={[
            'chart-layout-shell',
            isChartFullscreen ? 'chart-layout-shell--fullscreen' : '',
            isChartFocused ? 'chart-layout-shell--focused' : ''
          ]
            .filter(Boolean)
            .join(' ')}
          onFocusCapture={handleChartFocus}
          onBlurCapture={handleChartBlur}
        >
        <div className="chart-layout">
          <aside
            ref={toolRailRef}
            className={
              isMainChartMode
                ? 'chart-tool-rail chart-tool-rail--grouped'
                : 'chart-tool-rail chart-tool-rail--grouped chart-tool-rail--disabled'
            }
          >
            {groupedToolConfig.map((group) => {
              const primaryTool = group.tools[0]
              const isActiveGroup = activeToolGroupId === group.id
              const isExpanded = expandedToolGroupId === group.id
              
              return (
                <div
                  key={group.id}
                  className={isExpanded ? 'chart-tool-group chart-tool-group--expanded' : 'chart-tool-group'}
                >
                  <button
                    type="button"
                    className={
                      isActiveGroup
                        ? 'chart-tool-button chart-tool-button--active chart-tool-button--glyph'
                        : 'chart-tool-button chart-tool-button--glyph'
                    }
                    disabled={!isMainChartMode}
                    onClick={() => {
                      cancelDrawing()
                      setShareStatus('')

                      if (group.tools.length === 1) {
                        setExpandedToolGroupId(null)
                        setActiveTool(primaryTool.id)
                        return
                      }

                      setActiveTool(primaryTool.id)
                      setExpandedToolGroupId((value) => (value === group.id ? null : group.id))
                    }}
                    title={group.label}
                    aria-label={group.label}
                  >
                    <ToolGlyph kind={group.glyph} />
                  </button>

                  {group.tools.length > 1 && isExpanded ? (
                    <div className="chart-tool-popover">
                      {group.tools.map((tool) => (
                        <button
                          key={tool.id}
                          type="button"
                          className={
                            activeTool === tool.id
                              ? 'chart-tool-popover__item chart-tool-popover__item--active'
                              : 'chart-tool-popover__item'
                          }
                          onClick={() => {
                            cancelDrawing()
                            setShareStatus('')
                            setActiveTool(tool.id)
                            setExpandedToolGroupId(null)
                          }}
                          title={tool.label}
                        >
                          <ToolGlyph kind={tool.glyph} />
                          <span>{tool.label}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}

            <div className="chart-tool-rail__spacer" />

            <div className="chart-tool-rail__title">Düzen</div>
            <button
              type="button"
              className="chart-tool-button"
              disabled={!isMainChartMode}
              onClick={undoDrawings}
            >
              <span>↶</span>
              <small>Son çizim</small>
            </button>
            <button
              type="button"
              className="chart-tool-button"
              disabled={!isMainChartMode}
              onClick={() => onClearDrawings(viewId)}
            >
              <span>✕</span>
              <small>Tümünü sil</small>
            </button>
          </aside>

          <div className="chart-stage" ref={stageRef}>
            <div ref={containerRef} className="chart-surface" />
            <div
              className={
                !isMainChartMode
                  ? 'chart-hit-layer chart-hit-layer--disabled'
                  : activeTool === 'cursor'
                    ? 'chart-hit-layer'
                    : 'chart-hit-layer chart-hit-layer--interactive'
              }
              style={isMainChartMode ? { right: `${PRICE_SCALE_GUTTER}px` } : undefined}
              onPointerDown={isMainChartMode ? beginDrawing : undefined}
              onPointerMove={isMainChartMode ? updateDrawing : undefined}
              onPointerUp={isMainChartMode ? finishDrawing : undefined}
              onPointerCancel={isMainChartMode ? cancelDrawing : undefined}
            />
            <div className="chart-price-scale-rail" aria-hidden="true" />
            {hasOverlayContent ? (
              <ChartOverlay
                overlayRef={overlayRef}
                refreshHandlerRef={overlayRefreshHandlerRef}
                stageSize={stageSize}
                renderedDrawings={renderedDrawings}
                draftDrawingId={draftDrawing?.id}
                renderDrawing={renderDrawing}
              />
            ) : null}
          </div>
        </div>
        </div>

        <div className="chart-meta-toolbar">
          {isMainChartMode ? (
          <div className="filter-chip-row">
            <button
              type="button"
              className={showUserLayer ? 'chip chip--active' : 'chip'}
              onClick={() => setShowUserLayer((value) => !value)}
            >
              Kullanıcı çizimleri
            </button>
            <button
              type="button"
              className={showAiLayer ? 'chip chip--active' : 'chip'}
              onClick={() => setShowAiLayer((value) => !value)}
            >
              AI işaretleri
            </button>
          </div>
          ) : null}
          <p className="chart-hint">
            {isMainChartMode
              ? getDraftHint()
              : `${activeMetricMode.description}. Bu görünüm hızlı izleme içindir; çizim araçları Main sekmesinde kalır.`}
          </p>
        </div>

        {previewError ? <div className="chart-preview-banner chart-preview-banner--error">{previewError}</div> : null}
        {previewSummary ? (
          <div className="chart-preview-banner">
            <strong>AI Önizleme</strong>
            <p>{previewSummary}</p>
          </div>
        ) : null}

        {isMainChartMode && selectedDrawing ? (
          <div className="chart-share-sheet chart-inspector">
            <div className="chart-share-sheet__card">
              <div className="list-card__header">
                <div>
                  <strong>Seçili çizim</strong>
                  <p>{chartTools.find((tool) => tool.id === selectedDrawing.type)?.label ?? selectedDrawing.type}</p>
                </div>
                <div className="chart-toolbar__group">
                  <button
                    type="button"
                    className="tab-button"
                    onClick={() => {
                      const duplicated = shiftDrawing(
                        { ...cloneDrawing(selectedDrawing), id: createId('drawing') },
                        snapshot.candles,
                        2,
                        snapshot.quote.price * 0.0025
                      )
                      replaceDrawings([...drawings, duplicated])
                      setSelectedDrawingId(duplicated.id)
                    }}
                  >
                    Kopyala
                  </button>
                  <button
                    type="button"
                    className="tab-button"
                    onClick={() => {
                      replaceDrawings(drawings.filter((drawing) => drawing.id !== selectedDrawing.id))
                      setSelectedDrawingId('')
                    }}
                  >
                    Sil
                  </button>
                </div>
              </div>

              <div className="chart-inspector__grid">
                <label className="field-stack">
                  <span>Renk</span>
                  <input
                    type="color"
                    value={selectedDrawing.color}
                    onChange={(event) =>
                      updateSelectedDrawing((drawing) => ({
                        ...drawing,
                        color: event.target.value
                      }))
                    }
                  />
                </label>

                <label className="field-stack">
                  <span>Dolgu</span>
                  <input
                    type="color"
                    value={selectedDrawing.fillColor ?? '#f6c445'}
                    onChange={(event) =>
                      updateSelectedDrawing((drawing) => ({
                        ...drawing,
                        fillColor: event.target.value
                      }))
                    }
                  />
                </label>

                <label className="field-stack">
                  <span>Kalınlık</span>
                  <input
                    type="range"
                    min={1}
                    max={6}
                    step={0.5}
                    value={normalizeStyle(selectedDrawing).strokeWidth}
                    onChange={(event) =>
                      updateSelectedDrawing((drawing) => ({
                        ...drawing,
                        style: {
                          ...drawing.style,
                          strokeWidth: Number(event.target.value)
                        }
                      }))
                    }
                  />
                </label>

                <label className="field-stack">
                  <span>Şeffaflık</span>
                  <input
                    type="range"
                    min={0.05}
                    max={0.4}
                    step={0.01}
                    value={normalizeStyle(selectedDrawing).fillOpacity}
                    onChange={(event) =>
                      updateSelectedDrawing((drawing) => ({
                        ...drawing,
                        style: {
                          ...drawing.style,
                          fillOpacity: Number(event.target.value)
                        }
                      }))
                    }
                  />
                </label>
              </div>

              <label className="field-stack">
                <span>Etiket</span>
                <input
                  value={selectedDrawing.label ?? ''}
                  onChange={(event) =>
                    updateSelectedDrawing((drawing) => ({
                      ...drawing,
                      label: event.target.value
                    }))
                  }
                />
              </label>

              {selectedDrawing.type === 'text_note' || selectedDrawing.type === 'support_resistance_zone' ? (
                <label className="field-stack">
                  <span>Not</span>
                  <textarea
                    rows={3}
                    value={selectedDrawing.note ?? ''}
                    onChange={(event) =>
                      updateSelectedDrawing((drawing) => ({
                        ...drawing,
                        note: event.target.value
                      }))
                    }
                  />
                </label>
              ) : null}
            </div>
          </div>
        ) : null}

        <div ref={sharePanelRef} className="chart-share-sheet">
          <div className="chart-share-sheet__summary">
            <div>
              <strong>Grafik paylaşım merkezi</strong>
              <p>
                {hasShareContent
                  ? `${drawings.length} kullanıcı çizimi ve ${patterns.length} AI işareti ile paylaşım hazırlayabilirsin.`
                  : 'Önce grafikte çizim yap ya da seçili formasyonları işaretlet, sonra paylaş.'}
              </p>
            </div>
            {!isShareOpen ? (
              <button type="button" className="primary-button" onClick={openSharePanel}>
                Paylaşım panelini aç
              </button>
            ) : null}
          </div>

          {isShareOpen ? (
            <div>
              <div className="chart-share-sheet__card">
                <div className="list-card__header">
                  <div>
                    <strong>Çizimi paylaş</strong>
                    <p>
                      {drawings.length
                        ? `${drawings.length} çizim ile ${snapshot.profile.symbol} paylaşımı`
                        : `${snapshot.profile.symbol} için analiz paylaşımı`}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      setShareStatus('')
                      setIsShareOpen(false)
                    }}
                  >
                    Kapat
                  </button>
                </div>

                <div className="filter-chip-row">
                  <button
                    type="button"
                    className={shareTarget === 'profile' ? 'chip chip--active' : 'chip'}
                    onClick={() => setShareTarget('profile')}
                  >
                    Profilimde paylaş
                  </button>
                  <button
                    type="button"
                    className={shareTarget === 'direct' ? 'chip chip--active' : 'chip'}
                    onClick={() => setShareTarget('direct')}
                  >
                    Arkadaşa gönder
                  </button>
                </div>

                {shareTarget === 'direct' ? (
                  shareableFriends.length ? (
                    <label className="field-stack">
                      <span>Arkadaş seç</span>
                      <select value={shareFriendId} onChange={(event) => setShareFriendId(event.target.value)}>
                        <option value="">Arkadaş seç</option>
                        {shareableFriends.map((friend) => (
                          <option key={friend.id} value={friend.id}>
                            {friend.displayName} (@{friend.username})
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <p className="hero-card__helper">DM paylaşımı için önce bir arkadaş ekle.</p>
                  )
                ) : null}

                <label className="field-stack">
                  <span>Paylaşım başlığı</span>
                  <input value={shareTitle} onChange={(event) => setShareTitle(event.target.value)} />
                </label>

                <label className="field-stack">
                  <span>Analiz notu</span>
                  <textarea
                    rows={4}
                    value={shareBody}
                    onChange={(event) => setShareBody(event.target.value)}
                    placeholder="Boş bırakırsan AVY grafikteki çizimlerden otomatik özet hazırlar."
                  />
                </label>

                <div className="chart-share-preview">
                  <strong>{sharePreviewTitle}</strong>
                  <p>{sharePreviewBody}</p>
                </div>

                <div className="inline-form">
                  <button
                    type="button"
                    className="primary-button"
                    disabled={isPublishing}
                    onClick={() => void publishAnalysis()}
                  >
                    {shareTarget === 'profile' ? 'Profilde yayınla' : 'DM olarak gönder'}
                  </button>
                  {shareStatus ? <span className="hero-card__helper">{shareStatus}</span> : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="chart-footer">
          <div className="chart-footer__item">
            <span>EMA 20</span>
            <strong>{formatCurrency(indicators.ema20, snapshot.profile.currency)}</strong>
          </div>
          <div className="chart-footer__item">
            <span>SMA 50</span>
            <strong>{formatCurrency(indicators.sma50, snapshot.profile.currency)}</strong>
          </div>
          <div className="chart-footer__item">
            <span>Destek / direnç</span>
            <strong>
              {formatCurrency(indicators.support, snapshot.profile.currency)} /{' '}
              {formatCurrency(indicators.resistance, snapshot.profile.currency)}
            </strong>
          </div>
          <div className="chart-footer__item">
            <span>Gün içi bant</span>
            <strong>
              {formatCurrency(chartMinPrice, snapshot.profile.currency)} /{' '}
              {formatCurrency(chartMaxPrice, snapshot.profile.currency)}
            </strong>
          </div>
        </div>
      </div>
    </Panel>
  )
}

export const ChartPanel = memo(ChartPanelComponent, areChartPanelPropsEqual)
