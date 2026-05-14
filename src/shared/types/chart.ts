export type ChartDrawingType =
  | 'trend_line'
  | 'horizontal_line'
  | 'vertical_line'
  | 'rectangle'
  | 'support_resistance_zone'
  | 'fib_retracement'
  | 'arrow'
  | 'text_note'
  | 'price_label'
  | 'risk_reward'
  | 'brush'
  | 'ruler'
export type ChartDrawingTool = 'cursor' | ChartDrawingType
export type ChartDrawingLayer = 'user' | 'ai'

export interface ChartDrawingAnchor {
  time: string
  price: number
}

export interface ChartDrawingStyle {
  strokeWidth: number
  fillOpacity: number
  textSize: number
}

export interface ChartDrawing {
  id: string
  type: ChartDrawingType
  start: ChartDrawingAnchor
  end: ChartDrawingAnchor
  layer?: ChartDrawingLayer
  color: string
  fillColor?: string
  textColor?: string
  label?: string
  note?: string
  points?: ChartDrawingAnchor[]
  style?: Partial<ChartDrawingStyle>
}
