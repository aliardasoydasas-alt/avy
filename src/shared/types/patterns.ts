export type PatternType =
  | 'inverse_head_shoulders'
  | 'head_shoulders'
  | 'cup_handle'
  | 'bull_flag'
  | 'bear_flag'
  | 'double_top'
  | 'ascending_triangle'
  | 'descending_triangle'
  | 'rising_wedge'
  | 'falling_wedge'

export type PatternDirection = 'bullish' | 'bearish' | 'neutral'
export type PatternStatus = 'forming' | 'confirmed'

export interface PatternSignal {
  id: string
  type: PatternType
  label: string
  description: string
  confidence: number
  direction: PatternDirection
  status: PatternStatus
  startIndex: number
  endIndex: number
  breakoutLevel?: number
}
