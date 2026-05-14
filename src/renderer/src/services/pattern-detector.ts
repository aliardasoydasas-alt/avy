import type { CandlePoint } from '@shared/types/market'
import type { PatternDirection, PatternSignal, PatternType } from '@shared/types/patterns'
import { PATTERN_LABELS } from '@renderer/utils/constants'
import { clamp } from '@renderer/utils/format'
import { createId } from '@renderer/utils/id'

type PivotKind = 'high' | 'low'

interface PivotPoint {
  index: number
  price: number
  kind: PivotKind
}

interface DetectorContext {
  candles: CandlePoint[]
  pivots: PivotPoint[]
  highPivots: PivotPoint[]
  lowPivots: PivotPoint[]
  lastClose: number
  offset: number
}

const MAX_LOOKBACK = 72
const PIVOT_SPAN = 2
const MIN_PIVOT_GAP = 3
const MAX_SIGNAL_COUNT = 4
const OVERLAP_THRESHOLD = 0.66
const PATTERN_MIN_CONFIDENCE: Record<PatternType, number> = {
  inverse_head_shoulders: 0.82,
  head_shoulders: 0.82,
  cup_handle: 0.8,
  bull_flag: 0.75,
  bear_flag: 0.75,
  double_top: 0.99,
  ascending_triangle: 0.8,
  descending_triangle: 0.8,
  rising_wedge: 0.82,
  falling_wedge: 0.82
}

const PATTERN_DESCRIPTIONS: Record<PatternType, string> = {
  inverse_head_shoulders:
    'Net bir ters omuz-baş-omuz yapısı, boyun çizgisi üstü teyitte yükseliş yönlü dönüş sinyali verebilir.',
  head_shoulders:
    'Omuz-baş-omuz yapısı, boyun çizgisi altında zayıflama ve dağılım riskini öne çıkarır.',
  cup_handle:
    'Yuvarlak dipten sonra gelen sığ kulp, temiz kırılımda orta vadeli devam formasyonu olarak okunabilir.',
  bull_flag:
    'Güçlü yukarı hareket sonrası sığ ve kontrollü soluklanma, trendin devamına işaret edebilir.',
  bear_flag:
    'Sert düşüş sonrası sınırlı toparlanma bandı, aşağı yönlü devam ihtimalini artırabilir.',
  double_top:
    'Benzer seviyede iki tepe ve aradaki boyun çizgisi, zayıflayan momentuma işaret eden klasik dönüş yapısıdır.',
  ascending_triangle:
    'Yatay direnç altında yükselen dipler, baskının yukarı kırılım için biriktiğini gösterebilir.',
  descending_triangle:
    'Yatay destek üzerinde alçalan tepeler, aşağı yönlü kırılım riskinin arttığını gösterebilir.',
  rising_wedge:
    'Yükselen ama sıkışan yapı, trendin yorulduğu ve aşağı kırılım riskinin arttığı bölgeyi anlatır.',
  falling_wedge:
    'Aşağı eğimli ama daralan yapı, satış baskısının zayıfladığı ve yukarı tepki ihtimalinin güçlendiği bölgedir.'
}

const STRICT_PATTERN_TYPES = new Set<PatternType>([
  'inverse_head_shoulders',
  'head_shoulders',
  'bull_flag',
  'bear_flag',
  'rising_wedge',
  'falling_wedge'
])

const average = (...values: number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1)

const relativeDifference = (left: number, right: number): number => {
  const base = Math.max(Math.abs(left), Math.abs(right), 1e-9)
  return Math.abs(left - right) / base
}

const similarityScore = (left: number, right: number): number =>
  clamp(1 - relativeDifference(left, right), 0, 1)

const slopePerBar = (points: PivotPoint[]): number => {
  if (points.length < 2) {
    return 0
  }

  const meanX = average(...points.map((point) => point.index))
  const meanY = average(...points.map((point) => point.price))
  let numerator = 0
  let denominator = 0

  points.forEach((point) => {
    numerator += (point.index - meanX) * (point.price - meanY)
    denominator += (point.index - meanX) ** 2
  })

  return denominator ? numerator / denominator : 0
}

const windowCandles = (candles: CandlePoint[]): CandlePoint[] =>
  candles.length > MAX_LOOKBACK ? candles.slice(-MAX_LOOKBACK) : candles

const buildPivots = (candles: CandlePoint[], span = PIVOT_SPAN): PivotPoint[] => {
  const pivots: PivotPoint[] = []

  for (let index = span; index < candles.length - span; index += 1) {
    const current = candles[index]
    let isHigh = true
    let isLow = true

    for (let offset = 1; offset <= span; offset += 1) {
      const left = candles[index - offset]
      const right = candles[index + offset]

      if (!left || !right) {
        continue
      }

      if (current.high < left.high || current.high < right.high) {
        isHigh = false
      }

      if (current.low > left.low || current.low > right.low) {
        isLow = false
      }
    }

    if (isHigh) {
      pivots.push({
        index,
        price: current.high,
        kind: 'high'
      })
    }

    if (isLow) {
      pivots.push({
        index,
        price: current.low,
        kind: 'low'
      })
    }
  }

  const merged = pivots
    .sort((left, right) => left.index - right.index)
    .reduce<PivotPoint[]>((accumulator, pivot) => {
      const previous = accumulator[accumulator.length - 1]

      if (
        previous &&
        previous.kind === pivot.kind &&
        pivot.index - previous.index <= MIN_PIVOT_GAP
      ) {
        const keepCurrent =
          pivot.kind === 'high' ? pivot.price >= previous.price : pivot.price <= previous.price

        if (keepCurrent) {
          accumulator[accumulator.length - 1] = pivot
        }

        return accumulator
      }

      accumulator.push(pivot)
      return accumulator
    }, [])

  return merged
}

const pivotsBetween = (
  pivots: PivotPoint[],
  kind: PivotKind,
  startIndex: number,
  endIndex: number
): PivotPoint[] =>
  pivots.filter(
    (pivot) =>
      pivot.kind === kind && pivot.index > startIndex && pivot.index < endIndex
  )

const lowestPivotBetween = (
  pivots: PivotPoint[],
  startIndex: number,
  endIndex: number
): PivotPoint | null => {
  const candidates = pivotsBetween(pivots, 'low', startIndex, endIndex)
  if (!candidates.length) {
    return null
  }

  return candidates.reduce((lowest, candidate) =>
    candidate.price < lowest.price ? candidate : lowest
  )
}

const highestPivotBetween = (
  pivots: PivotPoint[],
  startIndex: number,
  endIndex: number
): PivotPoint | null => {
  const candidates = pivotsBetween(pivots, 'high', startIndex, endIndex)
  if (!candidates.length) {
    return null
  }

  return candidates.reduce((highest, candidate) =>
    candidate.price > highest.price ? candidate : highest
  )
}

const getLastPatternIndex = (confirmed: boolean, endIndex: number, lastIndex: number): number =>
  confirmed ? lastIndex : endIndex

const toGlobalIndex = (context: DetectorContext, index: number): number => context.offset + index

const createSignal = (
  type: PatternType,
  direction: PatternDirection,
  status: PatternSignal['status'],
  confidence: number,
  startIndex: number,
  endIndex: number,
  breakoutLevel?: number
): PatternSignal => ({
  id: createId('pattern'),
  type,
  label: PATTERN_LABELS[type],
  description: PATTERN_DESCRIPTIONS[type],
  confidence,
  direction,
  status,
  startIndex,
  endIndex,
  breakoutLevel
})

const detectHeadShouldersFamily = (
  context: DetectorContext,
  inverted = false
): PatternSignal[] => {
  const pivots = inverted ? context.lowPivots : context.highPivots
  const signals: PatternSignal[] = []

  for (let index = 0; index <= pivots.length - 3; index += 1) {
    const left = pivots[index]
    const head = pivots[index + 1]
    const right = pivots[index + 2]

    if (
      head.index - left.index < 4 ||
      right.index - head.index < 4 ||
      right.index - left.index > 38
    ) {
      continue
    }

    const middleLeft = inverted
      ? highestPivotBetween(context.pivots, left.index, head.index)
      : lowestPivotBetween(context.pivots, left.index, head.index)
    const middleRight = inverted
      ? highestPivotBetween(context.pivots, head.index, right.index)
      : lowestPivotBetween(context.pivots, head.index, right.index)

    if (!middleLeft || !middleRight) {
      continue
    }

    const shouldersAverage = average(left.price, right.price)
    const shoulderSimilarity = similarityScore(left.price, right.price)
    const neckline = average(middleLeft.price, middleRight.price)
    const necklineSimilarity = similarityScore(middleLeft.price, middleRight.price)
    const timeSymmetry =
      1 -
      Math.abs((head.index - left.index) - (right.index - head.index)) /
        Math.max(right.index - left.index, 1)

    const headProminence = inverted
      ? (shouldersAverage - head.price) / shouldersAverage
      : (head.price - shouldersAverage) / shouldersAverage

    if (
      shoulderSimilarity < 0.955 ||
      necklineSimilarity < 0.93 ||
      timeSymmetry < 0.64 ||
      headProminence < 0.045
    ) {
      continue
    }

    const confirmed = inverted
      ? context.lastClose > neckline * 1.002
      : context.lastClose < neckline * 0.998
    const confidence = clamp(
      0.48 +
        shoulderSimilarity * 0.18 +
        necklineSimilarity * 0.12 +
        timeSymmetry * 0.1 +
        headProminence * 2.2 +
        (confirmed ? 0.08 : 0),
      0.62,
      0.97
    )

    signals.push(
      createSignal(
        inverted ? 'inverse_head_shoulders' : 'head_shoulders',
        inverted ? 'bullish' : 'bearish',
        confirmed ? 'confirmed' : 'forming',
        confidence,
        toGlobalIndex(context, left.index),
        toGlobalIndex(context, getLastPatternIndex(confirmed, right.index, context.candles.length - 1)),
        neckline
      )
    )
  }

  return signals
}

const detectDoubleTop = (context: DetectorContext): PatternSignal[] => {
  const pivots = context.highPivots
  const signals: PatternSignal[] = []

  for (let index = 0; index <= pivots.length - 2; index += 1) {
    const first = pivots[index]
    const second = pivots[index + 1]

    if (second.index - first.index < 5 || second.index - first.index > 30) {
      continue
    }

    const middle = lowestPivotBetween(context.pivots, first.index, second.index)

    if (!middle) {
      continue
    }

    const similarity = similarityScore(first.price, second.price)
    const reversalDepth =
      (average(first.price, second.price) - middle.price) / average(first.price, second.price)

    if (similarity < 0.965 || reversalDepth < 0.025) {
      continue
    }

    const breakoutLevel = middle.price
    const confirmed = context.lastClose < breakoutLevel * 0.998
    const confidence = clamp(
      0.52 + similarity * 0.16 + reversalDepth * 2.25 + (confirmed ? 0.08 : 0),
      0.56,
      0.96
    )

    signals.push(
      createSignal(
        'double_top',
        'bearish',
        confirmed ? 'confirmed' : 'forming',
        confidence,
        toGlobalIndex(context, first.index),
        toGlobalIndex(context, getLastPatternIndex(confirmed, second.index, context.candles.length - 1)),
        breakoutLevel
      )
    )
  }

  return signals
}

const detectCupHandle = (context: DetectorContext): PatternSignal[] => {
  const candles = context.candles.slice(-40)

  if (candles.length < 24) {
    return []
  }

  const leftWindow = candles.slice(0, Math.min(12, candles.length / 3))
  const leftRimIndex = leftWindow.reduce(
    (best, candle, index, list) => (candle.high > list[best].high ? index : best),
    0
  )
  const troughSlice = candles.slice(leftRimIndex + 4, candles.length - 8)

  if (!troughSlice.length) {
    return []
  }

  const troughOffset = troughSlice.reduce(
    (best, candle, index, list) => (candle.low < list[best].low ? index : best),
    0
  )
  const troughIndex = leftRimIndex + 4 + troughOffset
  const rightSlice = candles.slice(troughIndex + 4, candles.length - 4)

  if (!rightSlice.length) {
    return []
  }

  const rightRimOffset = rightSlice.reduce(
    (best, candle, index, list) => (candle.high > list[best].high ? index : best),
    0
  )
  const rightRimIndex = troughIndex + 4 + rightRimOffset
  const handleSlice = candles.slice(rightRimIndex, candles.length)

  if (handleSlice.length < 3) {
    return []
  }

  const leftRim = candles[leftRimIndex].high
  const trough = candles[troughIndex].low
  const rightRim = candles[rightRimIndex].high
  const handleLow = Math.min(...handleSlice.map((candle) => candle.low))
  const rimSimilarity = similarityScore(leftRim, rightRim)
  const depth = (Math.min(leftRim, rightRim) - trough) / Math.min(leftRim, rightRim)
  const handlePullback = (rightRim - handleLow) / rightRim
  const confirmed = context.lastClose > Math.max(leftRim, rightRim) * 1.002

  if (
    troughIndex - leftRimIndex < 5 ||
    rightRimIndex - troughIndex < 5 ||
    rimSimilarity < 0.94 ||
    depth < 0.07 ||
    depth > 0.4 ||
    handlePullback < 0.015 ||
    handlePullback > 0.18
  ) {
    return []
  }

  const confidence = clamp(
    0.5 + rimSimilarity * 0.18 + depth * 0.9 + (1 - handlePullback) * 0.12 + (confirmed ? 0.08 : 0),
    0.58,
    0.95
  )

  return [
    createSignal(
        'cup_handle',
        'bullish',
        confirmed ? 'confirmed' : 'forming',
        confidence,
        toGlobalIndex(context, leftRimIndex),
        toGlobalIndex(context, getLastPatternIndex(confirmed, candles.length - 1, context.candles.length - 1)),
        Math.max(leftRim, rightRim)
      )
    ]
}

const detectFlagFamily = (
  context: DetectorContext,
  bearish = false
): PatternSignal[] => {
  const candles = context.candles.slice(-26)
  const offset = context.candles.length - candles.length

  if (candles.length < 18) {
    return []
  }

  let bestSignal: PatternSignal | null = null

  for (let poleEndIndex = 5; poleEndIndex <= 9; poleEndIndex += 1) {
    const pole = candles.slice(0, poleEndIndex + 1)
    const consolidation = candles.slice(poleEndIndex + 1, candles.length - 2)

    if (consolidation.length < 6) {
      continue
    }

    const poleStart = bearish ? pole[0].high : pole[0].low
    const poleEnd = bearish
      ? Math.min(...pole.map((candle) => candle.low))
      : Math.max(...pole.map((candle) => candle.high))
    const poleMove = bearish
      ? (poleStart - poleEnd) / poleStart
      : (poleEnd - poleStart) / poleStart
    const consolidationCloses = consolidation.map((candle) => candle.close)
    const consolidationSlope =
      consolidationCloses.length > 1
        ? (consolidationCloses[consolidationCloses.length - 1] - consolidationCloses[0]) /
          consolidationCloses.length
        : 0
    const consolidationHigh = Math.max(...consolidation.map((candle) => candle.high))
    const consolidationLow = Math.min(...consolidation.map((candle) => candle.low))
    const poleVolumeAverage =
      pole.reduce((sum, candle) => sum + candle.volume, 0) / Math.max(pole.length, 1)
    const consolidationVolumeAverage =
      consolidation.reduce((sum, candle) => sum + candle.volume, 0) / Math.max(consolidation.length, 1)
    const retrace = bearish
      ? (consolidationHigh - poleEnd) / Math.max(poleStart - poleEnd, 1e-9)
      : (poleEnd - consolidationLow) / Math.max(poleEnd - poleStart, 1e-9)
    const slopeGate = bearish
      ? consolidationSlope > -0.28 && consolidationSlope < 0.12
      : consolidationSlope < 0.28 && consolidationSlope > -0.12
    const driftGate = bearish
      ? consolidationLow > poleEnd * 0.99
      : consolidationHigh < poleEnd * 1.01
    const volumeGate =
      consolidationVolumeAverage <= poleVolumeAverage * 1.12 || consolidationVolumeAverage === 0
    const confirmed = bearish
      ? context.lastClose < consolidationLow * 0.998
      : context.lastClose > consolidationHigh * 1.002

    if (poleMove < 0.075 || retrace > 0.3 || !slopeGate || !driftGate || !volumeGate) {
      continue
    }

    const confidence = clamp(
      0.5 + poleMove * 2.4 + (1 - retrace) * 0.16 + (confirmed ? 0.08 : 0),
      0.62,
      0.96
    )

    const signal = createSignal(
      bearish ? 'bear_flag' : 'bull_flag',
      bearish ? 'bearish' : 'bullish',
      confirmed ? 'confirmed' : 'forming',
      confidence,
      toGlobalIndex(context, offset),
      toGlobalIndex(
        context,
        getLastPatternIndex(confirmed, offset + candles.length - 1, context.candles.length - 1)
      ),
      bearish ? consolidationLow : consolidationHigh
    )

    if (!bestSignal || signal.confidence > bestSignal.confidence) {
      bestSignal = signal
    }
  }

  return bestSignal ? [bestSignal] : []
}

const detectTriangleFamily = (
  context: DetectorContext,
  descending = false
): PatternSignal[] => {
  const startBoundary = Math.max(0, context.candles.length - 36)
  const recentHighs = context.highPivots.filter((pivot) => pivot.index >= startBoundary)
  const recentLows = context.lowPivots.filter((pivot) => pivot.index >= startBoundary)

  if (recentHighs.length < 3 || recentLows.length < 2) {
    const fallback = detectTriangleFallback(context, descending)
    return fallback ? [fallback] : []
  }

  if (descending) {
    const lows = recentLows.slice(-3)
    const highs = recentHighs.filter(
      (pivot) => pivot.index >= lows[0].index && pivot.index <= lows[lows.length - 1].index
    )

    if (highs.length < 2) {
      return []
    }

    const support = average(...lows.map((pivot) => pivot.price))
    const supportSimilarity = lows
      .map((pivot) => similarityScore(pivot.price, support))
      .reduce((sum, value) => sum + value, 0) / lows.length
    const highSlope = slopePerBar(highs) / average(...highs.map((pivot) => pivot.price))

    if (supportSimilarity < 0.96 || highSlope > -0.0012) {
      const fallback = detectTriangleFallback(context, true)
      return fallback ? [fallback] : []
    }

    const confirmed = context.lastClose < support * 0.998
    const confidence = clamp(
      0.5 + supportSimilarity * 0.16 + Math.abs(highSlope) * 14 + (confirmed ? 0.08 : 0),
      0.58,
      0.96
    )

    return [
      createSignal(
        'descending_triangle',
        'bearish',
        confirmed ? 'confirmed' : 'forming',
        confidence,
        toGlobalIndex(context, Math.min(highs[0].index, lows[0].index)),
        toGlobalIndex(
          context,
          getLastPatternIndex(
            confirmed,
            Math.max(highs[highs.length - 1].index, lows[lows.length - 1].index),
            context.candles.length - 1
          )
        ),
        support
      )
    ]
  }

  const highs = recentHighs.slice(-3)
  const lows = recentLows.filter(
    (pivot) => pivot.index >= highs[0].index && pivot.index <= highs[highs.length - 1].index
  )

  if (lows.length < 2) {
    return []
  }

  const resistance = average(...highs.map((pivot) => pivot.price))
  const resistanceSimilarity = highs
    .map((pivot) => similarityScore(pivot.price, resistance))
    .reduce((sum, value) => sum + value, 0) / highs.length
  const lowSlope = slopePerBar(lows) / average(...lows.map((pivot) => pivot.price))

  if (resistanceSimilarity < 0.96 || lowSlope < 0.0012) {
    const fallback = detectTriangleFallback(context, false)
    return fallback ? [fallback] : []
  }

  const confirmed = context.lastClose > resistance * 1.002
  const confidence = clamp(
    0.5 + resistanceSimilarity * 0.16 + lowSlope * 14 + (confirmed ? 0.08 : 0),
    0.58,
    0.96
  )

  return [
    createSignal(
      'ascending_triangle',
      'bullish',
      confirmed ? 'confirmed' : 'forming',
      confidence,
      toGlobalIndex(context, Math.min(highs[0].index, lows[0].index)),
      toGlobalIndex(
        context,
        getLastPatternIndex(
          confirmed,
          Math.max(highs[highs.length - 1].index, lows[lows.length - 1].index),
          context.candles.length - 1
        )
      ),
      resistance
    )
  ]
}

const detectTriangleFallback = (
  context: DetectorContext,
  descending: boolean
): PatternSignal | null => {
  const recent = context.candles.slice(-14)
  const localOffset = context.candles.length - recent.length

  if (recent.length < 12) {
    return null
  }

  const slices = [
    recent.slice(0, 4),
    recent.slice(4, 8),
    recent.slice(8, 12)
  ]

  if (descending) {
    const supportZone = recent.slice(0, -2)
    const support = Math.min(...supportZone.map((candle) => candle.low))
    const supportTouches = recent.filter(
      (candle) => relativeDifference(candle.low, support) < 0.012
    ).length
    const segmentHighs = slices.map((slice) => Math.max(...slice.map((candle) => candle.high)))

    if (
      supportTouches < 3 ||
      !(segmentHighs[0] > segmentHighs[1] && segmentHighs[1] > segmentHighs[2])
    ) {
      return null
    }

    const confirmed = context.lastClose < support * 0.998
    const confidence = clamp(0.58 + supportTouches * 0.03 + (confirmed ? 0.08 : 0), 0.58, 0.9)

    return createSignal(
      'descending_triangle',
      'bearish',
      confirmed ? 'confirmed' : 'forming',
      confidence,
      toGlobalIndex(context, localOffset),
      toGlobalIndex(
        context,
        getLastPatternIndex(confirmed, localOffset + recent.length - 1, context.candles.length - 1)
      ),
      support
    )
  }

  const resistanceZone = recent.slice(0, -2)
  const resistance = Math.max(...resistanceZone.map((candle) => candle.high))
  const resistanceTouches = recent.filter(
    (candle) => relativeDifference(candle.high, resistance) < 0.012
  ).length
  const segmentLows = slices.map((slice) => Math.min(...slice.map((candle) => candle.low)))

  if (
    resistanceTouches < 3 ||
    !(segmentLows[0] < segmentLows[1] && segmentLows[1] < segmentLows[2])
  ) {
    return null
  }

  const confirmed = context.lastClose > resistance * 1.002
  const confidence = clamp(0.58 + resistanceTouches * 0.03 + (confirmed ? 0.08 : 0), 0.58, 0.9)

  return createSignal(
    'ascending_triangle',
    'bullish',
    confirmed ? 'confirmed' : 'forming',
    confidence,
    toGlobalIndex(context, localOffset),
    toGlobalIndex(
      context,
      getLastPatternIndex(confirmed, localOffset + recent.length - 1, context.candles.length - 1)
    ),
    resistance
  )
}

const detectWedgeFamily = (
  context: DetectorContext,
  falling = false
): PatternSignal[] => {
  const startBoundary = Math.max(0, context.candles.length - 34)
  const highs = context.highPivots.filter((pivot) => pivot.index >= startBoundary)
  const lows = context.lowPivots.filter((pivot) => pivot.index >= startBoundary)

  if (highs.length < 3 || lows.length < 3) {
    return []
  }

  const normalizedHighSlope = slopePerBar(highs) / average(...highs.map((pivot) => pivot.price))
  const normalizedLowSlope = slopePerBar(lows) / average(...lows.map((pivot) => pivot.price))
  const widthStart = highs[0].price - lows[0].price
  const widthEnd = highs[highs.length - 1].price - lows[lows.length - 1].price
  const widthCompression = widthEnd / Math.max(widthStart, 1e-9)

  if (widthCompression > 0.78 || widthStart <= 0 || widthEnd <= 0) {
    return []
  }

  if (falling) {
    if (
      normalizedHighSlope >= -0.0012 ||
      normalizedLowSlope >= -0.0004 ||
      Math.abs(normalizedHighSlope) <= Math.abs(normalizedLowSlope)
    ) {
      return []
    }

    const breakoutLevel = highs[highs.length - 1].price
    const confirmed = context.lastClose > breakoutLevel * 1.002
    const confidence = clamp(
      0.5 +
        Math.abs(normalizedHighSlope) * 18 +
        Math.abs(normalizedLowSlope) * 10 +
        (1 - widthCompression) * 0.16 +
        (confirmed ? 0.08 : 0),
      0.58,
      0.95
    )

    return [
      createSignal(
        'falling_wedge',
        'bullish',
        confirmed ? 'confirmed' : 'forming',
        confidence,
        toGlobalIndex(context, Math.min(highs[0].index, lows[0].index)),
        toGlobalIndex(
          context,
          getLastPatternIndex(
            confirmed,
            Math.max(highs[highs.length - 1].index, lows[lows.length - 1].index),
            context.candles.length - 1
          )
        ),
        breakoutLevel
      )
    ]
  }

  if (
    normalizedHighSlope <= 0.0004 ||
    normalizedLowSlope <= 0.0012 ||
    normalizedLowSlope <= normalizedHighSlope
  ) {
    return []
  }

  const breakoutLevel = lows[lows.length - 1].price
  const confirmed = context.lastClose < breakoutLevel * 0.998
  const confidence = clamp(
    0.5 +
      normalizedLowSlope * 18 +
      normalizedHighSlope * 10 +
      (1 - widthCompression) * 0.16 +
      (confirmed ? 0.08 : 0),
    0.58,
    0.95
  )

  return [
    createSignal(
      'rising_wedge',
      'bearish',
      confirmed ? 'confirmed' : 'forming',
      confidence,
      toGlobalIndex(context, Math.min(highs[0].index, lows[0].index)),
      toGlobalIndex(
        context,
        getLastPatternIndex(
          confirmed,
          Math.max(highs[highs.length - 1].index, lows[lows.length - 1].index),
          context.candles.length - 1
        )
      ),
      breakoutLevel
    )
  ]
}

const overlapRatio = (left: PatternSignal, right: PatternSignal): number => {
  const overlapStart = Math.max(left.startIndex, right.startIndex)
  const overlapEnd = Math.min(left.endIndex, right.endIndex)

  if (overlapEnd < overlapStart) {
    return 0
  }

  const overlap = overlapEnd - overlapStart + 1
  const leftLength = left.endIndex - left.startIndex + 1
  const rightLength = right.endIndex - right.startIndex + 1

  return overlap / Math.max(Math.min(leftLength, rightLength), 1)
}

const dedupeSignals = (signals: PatternSignal[]): PatternSignal[] => {
  const sorted = [...signals].sort((left, right) => right.confidence - left.confidence)
  const kept: PatternSignal[] = []

  sorted.forEach((signal) => {
    const clashes = kept.some((candidate) => {
      const overlapping = overlapRatio(signal, candidate) >= OVERLAP_THRESHOLD
      const breakoutAligned =
        signal.breakoutLevel && candidate.breakoutLevel
          ? relativeDifference(signal.breakoutLevel, candidate.breakoutLevel) < 0.03
          : false

      return overlapping && (candidate.type === signal.type || breakoutAligned)
    })

    if (!clashes) {
      kept.push(signal)
    }
  })

  return kept.slice(0, MAX_SIGNAL_COUNT)
}

const isReliableSignal = (signal: PatternSignal, lastClose: number): boolean => {
  const minConfidence = PATTERN_MIN_CONFIDENCE[signal.type]

  if (signal.confidence < minConfidence) {
    return false
  }

  if (!signal.breakoutLevel) {
    return signal.status === 'confirmed'
  }

  const breakoutDistance = relativeDifference(lastClose, signal.breakoutLevel)

  if (signal.status === 'confirmed') {
    return breakoutDistance <= (STRICT_PATTERN_TYPES.has(signal.type) ? 0.025 : 0.035)
  }

  if (STRICT_PATTERN_TYPES.has(signal.type)) {
    return breakoutDistance <= 0.012 && signal.confidence >= minConfidence + 0.03
  }

  return breakoutDistance <= 0.025
}

const createContext = (candles: CandlePoint[]): DetectorContext => {
  const recentCandles = windowCandles(candles)
  const pivots = buildPivots(recentCandles)

  return {
    candles: recentCandles,
    pivots,
    highPivots: pivots.filter((pivot) => pivot.kind === 'high'),
    lowPivots: pivots.filter((pivot) => pivot.kind === 'low'),
    lastClose: recentCandles[recentCandles.length - 1]?.close ?? 0,
    offset: candles.length - recentCandles.length
  }
}

export const detectAllPatterns = (
  candles: CandlePoint[],
  enabledTypes?: PatternType[]
): PatternSignal[] => {
  if (!enabledTypes?.length || candles.length < 18) {
    return []
  }

  const enabledSet = new Set(enabledTypes)
  const include = (type: PatternType): boolean => enabledSet.has(type)

  const context = createContext(candles)
  const signals = [
    ...(include('inverse_head_shoulders') ? detectHeadShouldersFamily(context, true) : []),
    ...(include('head_shoulders') ? detectHeadShouldersFamily(context, false) : []),
    ...(include('double_top') ? [] : []),
    ...(include('cup_handle') ? detectCupHandle(context) : []),
    ...(include('bull_flag') ? detectFlagFamily(context, false) : []),
    ...(include('bear_flag') ? detectFlagFamily(context, true) : []),
    ...(include('ascending_triangle') ? detectTriangleFamily(context, false) : []),
    ...(include('descending_triangle') ? detectTriangleFamily(context, true) : []),
    ...(include('rising_wedge') ? detectWedgeFamily(context, false) : []),
    ...(include('falling_wedge') ? detectWedgeFamily(context, true) : [])
  ]

  return dedupeSignals(signals.filter((signal) => isReliableSignal(signal, context.lastClose)))
}
