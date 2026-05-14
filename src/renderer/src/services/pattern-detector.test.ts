import type { CandlePoint } from '@shared/types/market'
import { detectAllPatterns } from './pattern-detector'

const buildCandles = (closes: number[], volumes?: number[]): CandlePoint[] =>
  closes.map((close, index) => {
    const previous = closes[Math.max(index - 1, 0)]
    const open = index === 0 ? close : previous

    return {
      time: new Date(Date.UTC(2024, 0, 1, index)).toISOString(),
      open,
      high: Math.max(open, close) + 1,
      low: Math.min(open, close) - 1,
      close,
      volume: volumes?.[index] ?? 1000 + index * 25
    }
  })

describe('pattern-detector', () => {
  it('does not over-detect a loose bull flag lookalike', () => {
    const candles = buildCandles([
      100,
      106,
      113,
      121,
      129,
      136,
      142,
      140.8,
      139.7,
      138.9,
      138.2,
      137.8,
      138.1,
      138.6,
      139.2,
      140.1,
      141.4,
      143.6,
      146.2,
      149.1
    ], [
      1800,
      1950,
      2120,
      2310,
      2480,
      2660,
      2810,
      1520,
      1440,
      1360,
      1300,
      1260,
      1285,
      1335,
      1410,
      1560,
      1820,
      2140,
      2490,
      2860
    ])

    const signals = detectAllPatterns(candles, ['bull_flag'])

    expect(signals.some((signal) => signal.type === 'bull_flag')).toBe(false)
  })

  it('does not surface double top because it is intentionally disabled', () => {
    const candles = buildCandles([
      100,
      104,
      108,
      111,
      114,
      112,
      109,
      105,
      107,
      110,
      113,
      114.2,
      112.5,
      109,
      105,
      101,
      98,
      96
    ])

    const signals = detectAllPatterns(candles, ['double_top'])

    expect(signals.some((signal) => signal.type === 'double_top')).toBe(false)
  })
})
