import type { Timeframe } from '@shared/types/market'
import type { PatternType } from '@shared/types/patterns'

export const TIMEFRAME_OPTIONS: Timeframe[] = ['1s', '1m', '5m', '15m', '1H', '4H', '1D', '1W', '1M']

export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  '1s': '1 Saniye',
  '1m': '1 Dakika',
  '5m': '5 Dakika',
  '15m': '15 Dakika',
  '1H': '1 Saat',
  '4H': '4 Saat',
  '1D': '1 Gün',
  '1W': '1 Hafta',
  '1M': '1 Ay'
}

export const SUPPORTED_PATTERN_TYPES: PatternType[] = [
  'inverse_head_shoulders',
  'head_shoulders',
  'cup_handle',
  'bull_flag',
  'bear_flag',
  'ascending_triangle',
  'descending_triangle',
  'rising_wedge',
  'falling_wedge'
]

export const PATTERN_LABELS: Record<PatternType, string> = {
  inverse_head_shoulders: 'TOBO',
  head_shoulders: 'OBO',
  cup_handle: 'Fincan Kulp',
  bull_flag: 'Boga Flamasi',
  bear_flag: 'Ayi Flamasi',
  double_top: 'Cift Tepe',
  ascending_triangle: 'Yukselen Ucgen',
  descending_triangle: 'Alcalan Ucgen',
  rising_wedge: 'Yukselen Takoz',
  falling_wedge: 'Dusen Takoz'
}
