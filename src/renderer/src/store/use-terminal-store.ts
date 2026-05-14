import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { useSettingsStore } from '@renderer/store/use-settings-store'
import type { AlertRule, AlertTrigger, NotificationItem } from '@shared/types/alerts'
import type { IndicatorToggleState } from '@shared/types/analysis'
import type { ChartDrawing } from '@shared/types/chart'
import type { CloudAppStatePayload } from '@shared/types/cloud-sync'
import type { Timeframe, WatchlistDefinition } from '@shared/types/market'
import type { PatternType } from '@shared/types/patterns'
import type { ProfileSection } from '@shared/types/user'
import { createId } from '@renderer/utils/id'

const legacyAssetIdMap: Record<string, string> = {
  'btc-usd': 'binance:BTCUSDT',
  'eth-usd': 'binance:ETHUSDT',
  nvda: 'midas-us:NVDA',
  aapl: 'midas-us:AAPL',
  spx: 'midas-us:SPY',
  gold: 'midas-bist:ALTINS1'
}

const remapLegacyAssetId = (assetId: string): string => legacyAssetIdMap[assetId] ?? assetId

const DEFAULT_CUSTOM_WATCHLIST_NAME = 'Izleme Listem'
const createDefaultCustomWatchlist = (assetIds: string[] = []) => ({
  id: createId('watchlist'),
  name: DEFAULT_CUSTOM_WATCHLIST_NAME,
  assetIds
})

const initialWatchlists: WatchlistDefinition[] = [
  {
    id: 'watchlist-crypto',
    name: 'Kripto Canli',
    assetIds: ['binance:BTCUSDT', 'binance:ETHUSDT', 'binance:SOLUSDT', 'binance:BNBUSDT']
  },
  {
    id: 'watchlist-midas-us',
    name: 'Midas ABD',
    assetIds: ['midas-us:NVDA', 'midas-us:AAPL', 'midas-us:TSLA', 'midas-us:MSFT']
  },
  {
    id: 'watchlist-bist',
    name: 'Midas BIST',
    assetIds: ['midas-bist:THYAO', 'midas-bist:ASELS', 'midas-bist:BIMAS', 'midas-bist:TUPRS']
  }
]

const initialAlerts: AlertRule[] = [
  {
    id: 'alert-btc-breakout',
    assetId: 'binance:BTCUSDT',
    label: 'BTC ivme alarmi',
    type: 'percent_up',
    threshold: 3,
    enabled: true,
    createdAt: new Date().toISOString(),
    cooldownMinutes: 30
  }
]

const initialIndicatorToggles: IndicatorToggleState = {
  rsi: true,
  macd: true,
  movingAverages: true,
  bollinger: true,
  volume: true,
  supportResistance: true
}

const initialPatternSettings: Record<PatternType, boolean> = {
  inverse_head_shoulders: false,
  head_shoulders: false,
  cup_handle: false,
  bull_flag: false,
  bear_flag: false,
  ascending_triangle: false,
  descending_triangle: false,
  rising_wedge: false,
  falling_wedge: false
}

const sanitizePatternSettings = (value?: Record<string, boolean>): Record<PatternType, boolean> => ({
  ...initialPatternSettings,
  inverse_head_shoulders: Boolean(value?.inverse_head_shoulders),
  head_shoulders: Boolean(value?.head_shoulders),
  cup_handle: Boolean(value?.cup_handle),
  bull_flag: Boolean(value?.bull_flag),
  bear_flag: Boolean(value?.bear_flag),
  ascending_triangle: Boolean(value?.ascending_triangle),
  descending_triangle: Boolean(value?.descending_triangle),
  rising_wedge: Boolean(value?.rising_wedge),
  falling_wedge: Boolean(value?.falling_wedge)
})

interface NewAlertInput {
  assetId: string
  label: string
  type: AlertRule['type']
  threshold?: number
  referencePrice?: number
  patternType?: PatternType
}

type AppScreen = 'home' | 'ai' | 'highlights' | 'investors' | 'asset' | 'profile' | 'social'

interface TerminalStore {
  activeScreen: AppScreen
  profileSection: ProfileSection
  selectedAssetId: string
  selectedTimeframe: Timeframe
  activeWatchlistId: string
  searchTerm: string
  watchlists: WatchlistDefinition[]
  favorites: string[]
  recentAssetIds: string[]
  alerts: AlertRule[]
  alertHistory: AlertTrigger[]
  notifications: NotificationItem[]
  chartDrawings: Record<string, ChartDrawing[]>
  patternNotificationSettings: Record<PatternType, boolean>
  indicatorToggles: IndicatorToggleState
  setActiveScreen: (screen: AppScreen) => void
  setProfileSection: (section: ProfileSection) => void
  openProfileSection: (section: ProfileSection) => void
  setSelectedAsset: (assetId: string) => void
  setSelectedTimeframe: (timeframe: Timeframe) => void
  setActiveWatchlist: (watchlistId: string) => void
  setSearchTerm: (term: string) => void
  createWatchlist: (name: string) => void
  renameWatchlist: (watchlistId: string, name: string) => void
  deleteWatchlist: (watchlistId: string) => void
  addAssetToWatchlist: (assetId: string, watchlistId?: string) => boolean
  removeAssetFromWatchlist: (assetId: string, watchlistId?: string) => void
  reorderWatchlistAsset: (watchlistId: string, fromIndex: number, toIndex: number) => void
  toggleFavorite: (assetId: string) => void
  addAlert: (input: NewAlertInput) => void
  toggleAlert: (alertId: string) => void
  syncAlertLastTriggered: (alertId: string, firedAt: string) => void
  recordAlertTrigger: (trigger: AlertTrigger) => void
  pushNotification: (notification: Omit<NotificationItem, 'id' | 'read'>) => boolean
  markNotificationRead: (notificationId: string) => void
  markAllNotificationsRead: () => void
  setChartDrawings: (viewId: string, drawings: ChartDrawing[]) => void
  addChartDrawing: (viewId: string, drawing: ChartDrawing) => void
  removeLastChartDrawing: (viewId: string) => void
  clearChartDrawings: (viewId: string) => void
  setPatternNotification: (pattern: PatternType, enabled: boolean) => void
  setIndicatorToggle: (key: keyof IndicatorToggleState, enabled: boolean) => void
  hydrateTerminalState: (input: Pick<
    CloudAppStatePayload,
    | 'watchlists'
    | 'favorites'
    | 'recentAssetIds'
    | 'alerts'
    | 'chartDrawings'
    | 'patternNotificationSettings'
    | 'indicatorToggles'
    | 'cachedNotifications'
  >) => void
}

export const useTerminalStore = create<TerminalStore>()(
  persist(
    (set, get) => ({
      activeScreen: 'home',
      profileSection: 'overview',
      selectedAssetId: 'binance:BTCUSDT',
      selectedTimeframe: '1H',
      activeWatchlistId: initialWatchlists[0].id,
      searchTerm: '',
      watchlists: initialWatchlists,
      favorites: ['binance:BTCUSDT', 'midas-us:NVDA'],
      recentAssetIds: ['midas-us:NVDA', 'midas-bist:ASELS'],
      alerts: initialAlerts,
      alertHistory: [],
      notifications: [
        {
          id: createId('notification'),
          title: 'Canli piyasa modu aktif',
          message: 'AVY, Binance canli akislari ve Midas resmi piyasa sayfalarina baglandi.',
          timestamp: new Date().toISOString(),
          scope: 'system',
          read: false,
          dedupeKey: 'system:live-mode'
        }
      ],
      chartDrawings: {},
      patternNotificationSettings: initialPatternSettings,
      indicatorToggles: initialIndicatorToggles,

      setActiveScreen: (screen) => set({ activeScreen: screen }),
      setProfileSection: (profileSection) => set({ profileSection }),
      openProfileSection: (profileSection) => set({ activeScreen: 'profile', profileSection }),

      setSelectedAsset: (assetId) =>
        set((state) => ({
          activeScreen: 'asset',
          selectedAssetId: assetId,
          recentAssetIds: [assetId, ...state.recentAssetIds.filter((item) => item !== assetId)].slice(0, 6)
        })),

      setSelectedTimeframe: (timeframe) => set({ selectedTimeframe: timeframe }),
      setActiveWatchlist: (watchlistId) => set({ activeWatchlistId: watchlistId }),
      setSearchTerm: (term) => set({ searchTerm: term }),

      createWatchlist: (name) =>
        set((state) => {
          const nextWatchlist = {
            id: createId('watchlist'),
            name,
            assetIds: []
          }

          return {
            watchlists: [...state.watchlists, nextWatchlist],
            activeWatchlistId: nextWatchlist.id
          }
        }),

      renameWatchlist: (watchlistId, name) =>
        set((state) => ({
          watchlists: state.watchlists.map((watchlist) =>
            watchlist.id === watchlistId && name.trim()
              ? {
                  ...watchlist,
                  name: name.trim()
                }
              : watchlist
          )
        })),

      deleteWatchlist: (watchlistId) =>
        set((state) => {
          const nextWatchlists = state.watchlists.filter((watchlist) => watchlist.id !== watchlistId)

          const nextActiveWatchlistId =
            state.activeWatchlistId === watchlistId
              ? nextWatchlists[0]?.id ?? ''
              : state.activeWatchlistId

          return {
            watchlists: nextWatchlists,
            activeWatchlistId: nextActiveWatchlistId
          }
        }),

      addAssetToWatchlist: (assetId, watchlistId) => {
        let added = false

        set((state) => {
          const targetWatchlistId = watchlistId ?? state.activeWatchlistId
          const targetWatchlist = state.watchlists.find((watchlist) => watchlist.id === targetWatchlistId)

          if (!targetWatchlist) {
            const nextWatchlist = createDefaultCustomWatchlist([assetId])
            added = true

            return {
              watchlists: [...state.watchlists, nextWatchlist],
              activeWatchlistId: nextWatchlist.id
            }
          }

          return {
            watchlists: state.watchlists.map((watchlist) => {
              if (targetWatchlistId !== watchlist.id) {
                return watchlist
              }

              if (watchlist.assetIds.includes(assetId)) {
                return watchlist
              }

              added = true

              return {
                ...watchlist,
                assetIds: [...watchlist.assetIds, assetId]
              }
            })
          }
        })

        return added
      },

      removeAssetFromWatchlist: (assetId, watchlistId) =>
        set((state) => ({
          watchlists: state.watchlists.map((watchlist) =>
            watchlist.id === (watchlistId ?? state.activeWatchlistId)
              ? {
                  ...watchlist,
                  assetIds: watchlist.assetIds.filter((item) => item !== assetId)
                }
              : watchlist
          )
        })),

      reorderWatchlistAsset: (watchlistId, fromIndex, toIndex) =>
        set((state) => ({
          watchlists: state.watchlists.map((watchlist) => {
            if (watchlist.id !== watchlistId) {
              return watchlist
            }

            if (
              fromIndex < 0 ||
              toIndex < 0 ||
              fromIndex >= watchlist.assetIds.length ||
              toIndex >= watchlist.assetIds.length ||
              fromIndex === toIndex
            ) {
              return watchlist
            }

            const nextAssetIds = [...watchlist.assetIds]
            const [moved] = nextAssetIds.splice(fromIndex, 1)

            if (!moved) {
              return watchlist
            }

            nextAssetIds.splice(toIndex, 0, moved)

            return {
              ...watchlist,
              assetIds: nextAssetIds
            }
          })
        })),

      toggleFavorite: (assetId) =>
        set((state) => ({
          favorites: state.favorites.includes(assetId)
            ? state.favorites.filter((item) => item !== assetId)
            : [assetId, ...state.favorites]
        })),

      addAlert: (input) =>
        set((state) => ({
          alerts: [
            {
              id: createId('alert'),
              assetId: input.assetId,
              label: input.label,
              type: input.type,
              threshold: input.threshold,
              referencePrice: input.referencePrice,
              patternType: input.patternType,
              enabled: true,
              createdAt: new Date().toISOString(),
              cooldownMinutes: 30
            },
            ...state.alerts
          ]
        })),

      toggleAlert: (alertId) =>
        set((state) => ({
          alerts: state.alerts.map((alert) =>
            alert.id === alertId
              ? {
                  ...alert,
                  enabled: !alert.enabled
                }
              : alert
          )
        })),

      syncAlertLastTriggered: (alertId, firedAt) =>
        set((state) => ({
          alerts: state.alerts.map((alert) =>
            alert.id === alertId
              ? {
                  ...alert,
                  lastTriggeredAt: firedAt
                }
              : alert
          )
        })),

      recordAlertTrigger: (trigger) =>
        set((state) => ({
          alertHistory: [trigger, ...state.alertHistory].slice(0, 24)
        })),

      pushNotification: (notification) => {
        const notificationPreferences = useSettingsStore.getState().settings.notifications

        if (
          (notification.scope === 'alert' && !notificationPreferences.alerts) ||
          (notification.scope === 'pattern' && !notificationPreferences.patterns) ||
          (notification.scope === 'ai' && !notificationPreferences.ai) ||
          (notification.scope === 'live' && !notificationPreferences.live) ||
          (notification.scope === 'news' && !notificationPreferences.news) ||
          (notification.scope === 'system' && !notificationPreferences.system) ||
          (notification.scope === 'social' && !notificationPreferences.social)
        ) {
          return false
        }

        const duplicate = get().notifications.find((item) => {
          if (!notification.dedupeKey || item.dedupeKey !== notification.dedupeKey) {
            return false
          }

          const dedupeWindowMinutes = notification.dedupeKey.startsWith('live:') ? 60 * 24 : 30
          const ageMinutes =
            (Date.now() - new Date(item.timestamp).getTime()) / 60000

          return ageMinutes < dedupeWindowMinutes
        })

        if (duplicate) {
          return false
        }

        set((state) => ({
          notifications: [
            {
              ...notification,
              id: createId('notification'),
              read: false
            },
            ...state.notifications
          ].slice(0, 50)
        }))

        return true
      },

      markNotificationRead: (notificationId) =>
        set((state) => ({
          notifications: state.notifications.map((notification) =>
            notification.id === notificationId
              ? {
                  ...notification,
                  read: true
                }
              : notification
          )
        })),

      markAllNotificationsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((notification) => ({
            ...notification,
            read: true
          }))
        })),

      setChartDrawings: (viewId, drawings) =>
        set((state) => ({
          chartDrawings: {
            ...state.chartDrawings,
            [viewId]: drawings
          }
        })),

      addChartDrawing: (viewId, drawing) =>
        set((state) => ({
          chartDrawings: {
            ...state.chartDrawings,
            [viewId]: [...(state.chartDrawings[viewId] ?? []), drawing]
          }
        })),

      removeLastChartDrawing: (viewId) =>
        set((state) => ({
          chartDrawings: {
            ...state.chartDrawings,
            [viewId]: (state.chartDrawings[viewId] ?? []).slice(0, -1)
          }
        })),

      clearChartDrawings: (viewId) =>
        set((state) => ({
          chartDrawings: {
            ...state.chartDrawings,
            [viewId]: []
          }
        })),

      setPatternNotification: (pattern, enabled) =>
        set((state) => ({
          patternNotificationSettings: {
            ...state.patternNotificationSettings,
            [pattern]: enabled
          }
        })),

      setIndicatorToggle: (key, enabled) =>
        set((state) => ({
          indicatorToggles: {
            ...state.indicatorToggles,
            [key]: enabled
          }
        })),

      hydrateTerminalState: (input) =>
        set((state) => {
          const nextWatchlists =
            input.watchlists?.length
              ? input.watchlists.map((watchlist) => ({
                  ...watchlist,
                  assetIds: watchlist.assetIds.map(remapLegacyAssetId)
                }))
              : state.watchlists

          const fallbackActiveWatchlistId = nextWatchlists[0]?.id ?? state.activeWatchlistId

          return {
            watchlists: nextWatchlists,
            activeWatchlistId:
              nextWatchlists.some((watchlist) => watchlist.id === state.activeWatchlistId)
                ? state.activeWatchlistId
                : fallbackActiveWatchlistId ?? '',
            favorites: (input.favorites ?? state.favorites).map(remapLegacyAssetId),
            recentAssetIds: (input.recentAssetIds ?? state.recentAssetIds).map(remapLegacyAssetId),
            alerts: (input.alerts ?? state.alerts).map((alert) => ({
              ...alert,
              assetId: remapLegacyAssetId(alert.assetId)
            })),
            chartDrawings: input.chartDrawings ?? state.chartDrawings,
            patternNotificationSettings: sanitizePatternSettings(
              input.patternNotificationSettings ?? state.patternNotificationSettings
            ),
            indicatorToggles: {
              ...initialIndicatorToggles,
              ...(input.indicatorToggles ?? state.indicatorToggles)
            },
            notifications: input.cachedNotifications?.length
              ? input.cachedNotifications
              : state.notifications
          }
        })
    }),
    {
      name: 'ay-terminal-store',
      version: 13,
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState) => {
        const state = persistedState as Partial<TerminalStore> | undefined

        if (!state) {
          return state
        }

        return {
          ...state,
          activeScreen: 'home',
          profileSection:
            state.profileSection === 'account'
              ? 'settings'
              : state.profileSection ?? 'overview',
          selectedAssetId: remapLegacyAssetId(state.selectedAssetId ?? 'binance:BTCUSDT'),
          favorites: (state.favorites ?? []).map(remapLegacyAssetId),
          recentAssetIds: (state.recentAssetIds ?? []).map(remapLegacyAssetId),
          watchlists: (state.watchlists ?? initialWatchlists).map((watchlist) => ({
            ...watchlist,
            name:
              watchlist.id === 'watchlist-crypto'
                ? 'Kripto Canli'
                : watchlist.id === 'watchlist-midas-us'
                  ? 'Midas ABD'
                  : watchlist.id === 'watchlist-bist'
                    ? 'Midas BIST'
                    : watchlist.name,
            assetIds: watchlist.assetIds.map(remapLegacyAssetId)
          })),
          activeWatchlistId: state.activeWatchlistId ?? '',
          alerts: (state.alerts ?? initialAlerts).map((alert) => ({
            ...alert,
            assetId: remapLegacyAssetId(alert.assetId)
          })).filter((alert) => alert.id !== 'alert-nvda-pattern'),
          patternNotificationSettings: sanitizePatternSettings(
            state.patternNotificationSettings as Record<string, boolean> | undefined
          ),
          chartDrawings: state.chartDrawings ?? {},
          notifications: (state.notifications ?? []).map((notification) =>
            notification.dedupeKey === 'system:live-mode'
              ? {
                  ...notification,
                  title: 'Canli piyasa modu aktif',
                  message: 'AVY, Binance canli akislari ve Midas resmi piyasa sayfalarina baglandi.'
                }
              : notification
          )
        }
      }
    }
  )
)
