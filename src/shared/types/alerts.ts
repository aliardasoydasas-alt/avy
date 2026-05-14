import type { AssetClass } from './market'
import type { PatternType } from './patterns'

export type AlertType =
  | 'price_above'
  | 'price_below'
  | 'percent_up'
  | 'percent_down'
  | 'reversal'
  | 'pattern'

export interface AlertRule {
  id: string
  assetId: string
  label: string
  type: AlertType
  threshold?: number
  referencePrice?: number
  patternType?: PatternType
  enabled: boolean
  createdAt: string
  cooldownMinutes: number
  lastTriggeredAt?: string
}

export type NotificationScope = 'alert' | 'pattern' | 'news' | 'system' | 'social' | 'ai' | 'live'

export interface NotificationItem {
  id: string
  title: string
  message: string
  timestamp: string
  scope: NotificationScope
  assetId?: string
  assetSymbol?: string
  assetName?: string
  assetClass?: AssetClass
  read: boolean
  dedupeKey?: string
}

export interface AlertTrigger {
  id: string
  alertId: string
  assetId: string
  firedAt: string
  title: string
  message: string
  severity: 'info' | 'success' | 'warning'
}
