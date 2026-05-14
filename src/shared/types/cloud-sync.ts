import type { AiNotificationHistoryItem } from './ai-hub'
import type { AlertRule, NotificationItem } from './alerts'
import type { IndicatorToggleState } from './analysis'
import type { ChartDrawing } from './chart'
import type { Holding, PortfolioSnapshot } from './portfolio'
import type { ProfileShowcaseSettings, TradeJournalEntry } from './social'
import type { WatchlistDefinition } from './market'
import type { PatternType } from './patterns'
import type { UserSettings } from './user'

export interface CloudAppStatePayload {
  version: 1
  holdings: Holding[]
  portfolioSnapshots: PortfolioSnapshot[]
  watchlists: WatchlistDefinition[]
  favorites: string[]
  recentAssetIds: string[]
  alerts: AlertRule[]
  chartDrawings: Record<string, ChartDrawing[]>
  patternNotificationSettings: Record<PatternType, boolean>
  indicatorToggles: IndicatorToggleState
  aiConversations: Record<
    string,
    Array<{
      id: string
      role: 'user' | 'assistant'
      text: string
      createdAt: string
    }>
  >
  aiHistory: AiNotificationHistoryItem[]
  settings: UserSettings
  tradeJournal: TradeJournalEntry[]
  showcase: ProfileShowcaseSettings
  cachedNotifications: NotificationItem[]
}

export type CloudSyncStatus = 'idle' | 'loading' | 'saving' | 'synced' | 'offline' | 'error'

export interface CloudSyncState {
  status: CloudSyncStatus
  isHydrated: boolean
  lastSyncedAt?: string
  errorMessage?: string
}
