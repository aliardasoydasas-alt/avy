import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchUserAppState,
  formatSocialBackendError,
  subscribeToUserAppState,
  upsertUserAppState
} from '@renderer/services/social-backend'
import { useAiHubStore } from '@renderer/store/use-ai-hub-store'
import { useAssetChatStore } from '@renderer/store/use-asset-chat-store'
import { usePortfolioStore } from '@renderer/store/use-portfolio-store'
import { useSettingsStore } from '@renderer/store/use-settings-store'
import { useSocialProfileStore } from '@renderer/store/use-social-profile-store'
import { useTerminalStore } from '@renderer/store/use-terminal-store'
import type { CloudAppStatePayload, CloudSyncState } from '@shared/types/cloud-sync'
import type { SupabaseClient } from '@supabase/supabase-js'

const SAVE_DEBOUNCE_MS = 900

interface UseCloudAccountSyncOptions {
  client: SupabaseClient | null
  sessionUserId: string | null
  enabled: boolean
}

const EMPTY_PAYLOAD: CloudAppStatePayload = {
  version: 1,
  holdings: [],
  portfolioSnapshots: [],
  watchlists: [],
  favorites: [],
  recentAssetIds: [],
  alerts: [],
  chartDrawings: {},
  patternNotificationSettings: {
    inverse_head_shoulders: false,
    head_shoulders: false,
    cup_handle: false,
    bull_flag: false,
    bear_flag: false,
    ascending_triangle: false,
    descending_triangle: false,
    rising_wedge: false,
    falling_wedge: false
  },
  indicatorToggles: {
    rsi: true,
    macd: true,
    movingAverages: true,
    bollinger: true,
    volume: true,
    supportResistance: true
  },
  aiConversations: {},
  aiHistory: [],
  settings: {
    notifications: {
      alerts: true,
      patterns: true,
      ai: true,
      news: true,
      system: true,
      social: true,
      desktop: true,
      live: true
    },
    sound: {
      enabled: true,
      volume: 34,
      ui: true,
      messages: true,
      notifications: true
    },
    portfolioVisibility: 'friends',
    themeMode: 'dark',
    liveNotifications: {
      enabled: true,
      mobileEnabled: false,
      ntfyTopic: '',
      deviceLabel: 'Telefonum'
    }
  },
  tradeJournal: [],
  showcase: {
    wallpaperId: 'aurora-desk',
    backgroundPresetId: 'golden-orbit'
  },
  cachedNotifications: []
}

const isOnline = (): boolean =>
  typeof navigator === 'undefined' ? true : navigator.onLine

const normalizePayload = (payload?: Partial<CloudAppStatePayload> | null): CloudAppStatePayload => ({
  ...EMPTY_PAYLOAD,
  ...payload,
  chartDrawings: payload?.chartDrawings ?? EMPTY_PAYLOAD.chartDrawings,
  aiConversations: payload?.aiConversations ?? EMPTY_PAYLOAD.aiConversations,
  settings: {
    ...EMPTY_PAYLOAD.settings,
    ...(payload?.settings ?? {}),
    notifications: {
      ...EMPTY_PAYLOAD.settings.notifications,
      ...(payload?.settings?.notifications ?? {})
    },
    sound: {
      ...EMPTY_PAYLOAD.settings.sound,
      ...(payload?.settings?.sound ?? {})
    },
    liveNotifications: {
      ...EMPTY_PAYLOAD.settings.liveNotifications,
      ...(payload?.settings?.liveNotifications ?? {})
    }
  },
  showcase: {
    ...EMPTY_PAYLOAD.showcase,
    ...(payload?.showcase ?? {})
  },
  patternNotificationSettings: {
    ...EMPTY_PAYLOAD.patternNotificationSettings,
    ...(payload?.patternNotificationSettings ?? {})
  },
  indicatorToggles: {
    ...EMPTY_PAYLOAD.indicatorToggles,
    ...(payload?.indicatorToggles ?? {})
  },
  cachedNotifications: (payload?.cachedNotifications ?? []).slice(0, 60),
  aiHistory: (payload?.aiHistory ?? []).slice(0, 60),
  portfolioSnapshots: (payload?.portfolioSnapshots ?? []).slice(-365)
})

const isPayloadMeaningful = (payload: CloudAppStatePayload): boolean =>
  Boolean(
    payload.holdings.length ||
      payload.portfolioSnapshots.length ||
      payload.watchlists.length ||
      payload.favorites.length ||
      payload.recentAssetIds.length ||
      payload.alerts.length ||
      Object.keys(payload.chartDrawings).length ||
      Object.keys(payload.aiConversations).length ||
      payload.aiHistory.length ||
      payload.tradeJournal.length
  )

export const useCloudAccountSync = ({
  client,
  sessionUserId,
  enabled
}: UseCloudAccountSyncOptions): CloudSyncState => {
  const holdings = usePortfolioStore((state) => state.holdings)
  const portfolioSnapshots = usePortfolioStore((state) => state.snapshots)
  const hydratePortfolio = usePortfolioStore((state) => state.hydratePortfolio)

  const watchlists = useTerminalStore((state) => state.watchlists)
  const favorites = useTerminalStore((state) => state.favorites)
  const recentAssetIds = useTerminalStore((state) => state.recentAssetIds)
  const alerts = useTerminalStore((state) => state.alerts)
  const chartDrawings = useTerminalStore((state) => state.chartDrawings)
  const patternNotificationSettings = useTerminalStore((state) => state.patternNotificationSettings)
  const indicatorToggles = useTerminalStore((state) => state.indicatorToggles)
  const cachedNotifications = useTerminalStore((state) => state.notifications)
  const hydrateTerminalState = useTerminalStore((state) => state.hydrateTerminalState)

  const settings = useSettingsStore((state) => state.settings)
  const hydrateSettings = useSettingsStore((state) => state.hydrateSettings)

  const aiConversations = useAssetChatStore((state) => state.conversations)
  const hydrateConversations = useAssetChatStore((state) => state.hydrateConversations)

  const tradeJournal = useSocialProfileStore((state) => state.tradeJournal)
  const showcase = useSocialProfileStore((state) => state.showcase)
  const hydrateSocialProfileState = useSocialProfileStore((state) => state.hydrateSocialProfileState)

  const aiHistory = useAiHubStore((state) => state.history)
  const hydrateHistory = useAiHubStore((state) => state.hydrateHistory)

  const [syncState, setSyncState] = useState<CloudSyncState>({
    status: enabled && sessionUserId ? 'loading' : 'idle',
    isHydrated: false
  })

  const hydratedRef = useRef(false)
  const applyingRemoteRef = useRef(false)
  const lastSerializedRef = useRef('')
  const saveTimerRef = useRef<number>()
  const currentPayloadRef = useRef<CloudAppStatePayload>(EMPTY_PAYLOAD)

  const currentPayload = useMemo<CloudAppStatePayload>(
    () =>
      normalizePayload({
        version: 1,
        holdings,
        portfolioSnapshots,
        watchlists,
        favorites,
        recentAssetIds,
        alerts,
        chartDrawings,
        patternNotificationSettings,
        indicatorToggles,
        aiConversations,
        aiHistory,
        settings,
        tradeJournal,
        showcase,
        cachedNotifications
      }),
    [
      aiConversations,
      aiHistory,
      alerts,
      cachedNotifications,
      chartDrawings,
      favorites,
      holdings,
      indicatorToggles,
      patternNotificationSettings,
      portfolioSnapshots,
      recentAssetIds,
      settings,
      showcase,
      tradeJournal,
      watchlists
    ]
  )

  useEffect(() => {
    currentPayloadRef.current = currentPayload
  }, [currentPayload])

  useEffect(() => {
    if (!enabled || !client || !sessionUserId) {
      hydratedRef.current = false
      lastSerializedRef.current = ''
      setSyncState({
        status: enabled ? 'loading' : 'idle',
        isHydrated: false
      })
      return
    }

    let cancelled = false

    const applyPayload = (payload: CloudAppStatePayload) => {
      applyingRemoteRef.current = true
      hydratePortfolio({
        holdings: payload.holdings,
        snapshots: payload.portfolioSnapshots
      })
      hydrateTerminalState({
        watchlists: payload.watchlists,
        favorites: payload.favorites,
        recentAssetIds: payload.recentAssetIds,
        alerts: payload.alerts,
        chartDrawings: payload.chartDrawings,
        patternNotificationSettings: payload.patternNotificationSettings,
        indicatorToggles: payload.indicatorToggles,
        cachedNotifications: payload.cachedNotifications
      })
      hydrateSettings(payload.settings)
      hydrateConversations(payload.aiConversations)
      hydrateSocialProfileState({
        tradeJournal: payload.tradeJournal,
        showcase: payload.showcase
      })
      hydrateHistory(payload.aiHistory)
      applyingRemoteRef.current = false
    }

    const bootstrap = async () => {
      setSyncState({
        status: isOnline() ? 'loading' : 'offline',
        isHydrated: false
      })

      try {
        const remoteState = await fetchUserAppState(client, sessionUserId)

        if (cancelled) {
          return
        }

        const normalizedRemote = normalizePayload(remoteState.payload)

        if (remoteState.payload && isPayloadMeaningful(normalizedRemote)) {
          applyPayload(normalizedRemote)
          lastSerializedRef.current = JSON.stringify(normalizedRemote)
        } else {
          const localPayload = normalizePayload(currentPayloadRef.current)

          if (isPayloadMeaningful(localPayload)) {
            await upsertUserAppState(client, sessionUserId, localPayload)
            lastSerializedRef.current = JSON.stringify(localPayload)
          } else {
            lastSerializedRef.current = JSON.stringify(normalizedRemote)
          }
        }

        hydratedRef.current = true
        setSyncState({
          status: 'synced',
          isHydrated: true,
          lastSyncedAt: remoteState.updatedAt ?? new Date().toISOString()
        })
      } catch (error) {
        if (cancelled) {
          return
        }

        setSyncState({
          status: isOnline() ? 'error' : 'offline',
          isHydrated: false,
          errorMessage: formatSocialBackendError(error)
        })
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [
    client,
    enabled,
    hydrateConversations,
    hydrateHistory,
    hydratePortfolio,
    hydrateSettings,
    hydrateSocialProfileState,
    hydrateTerminalState,
    sessionUserId
  ])

  useEffect(() => {
    if (!enabled || !client || !sessionUserId || !hydratedRef.current) {
      return
    }

    return subscribeToUserAppState(client, sessionUserId, (payload) => {
      const normalizedPayload = normalizePayload(payload)
      const serialized = JSON.stringify(normalizedPayload)

      if (serialized === lastSerializedRef.current) {
        return
      }

      applyingRemoteRef.current = true
      hydratePortfolio({
        holdings: normalizedPayload.holdings,
        snapshots: normalizedPayload.portfolioSnapshots
      })
      hydrateTerminalState({
        watchlists: normalizedPayload.watchlists,
        favorites: normalizedPayload.favorites,
        recentAssetIds: normalizedPayload.recentAssetIds,
        alerts: normalizedPayload.alerts,
        chartDrawings: normalizedPayload.chartDrawings,
        patternNotificationSettings: normalizedPayload.patternNotificationSettings,
        indicatorToggles: normalizedPayload.indicatorToggles,
        cachedNotifications: normalizedPayload.cachedNotifications
      })
      hydrateSettings(normalizedPayload.settings)
      hydrateConversations(normalizedPayload.aiConversations)
      hydrateSocialProfileState({
        tradeJournal: normalizedPayload.tradeJournal,
        showcase: normalizedPayload.showcase
      })
      hydrateHistory(normalizedPayload.aiHistory)
      applyingRemoteRef.current = false
      lastSerializedRef.current = serialized
      setSyncState({
        status: 'synced',
        isHydrated: true,
        lastSyncedAt: new Date().toISOString()
      })
    })
  }, [
    client,
    enabled,
    hydrateConversations,
    hydrateHistory,
    hydratePortfolio,
    hydrateSettings,
    hydrateSocialProfileState,
    hydrateTerminalState,
    sessionUserId
  ])

  useEffect(() => {
    if (!enabled || !client || !sessionUserId || !hydratedRef.current || applyingRemoteRef.current) {
      return
    }

    const serialized = JSON.stringify(currentPayload)

    if (serialized === lastSerializedRef.current) {
      return
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
    }

    setSyncState((current) => ({
      ...current,
      status: isOnline() ? 'saving' : 'offline',
      isHydrated: hydratedRef.current,
      errorMessage: undefined
    }))

    saveTimerRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          await upsertUserAppState(client, sessionUserId, currentPayload)
          lastSerializedRef.current = serialized
          setSyncState({
            status: 'synced',
            isHydrated: true,
            lastSyncedAt: new Date().toISOString()
          })
        } catch (error) {
          setSyncState({
            status: isOnline() ? 'error' : 'offline',
            isHydrated: hydratedRef.current,
            lastSyncedAt: undefined,
            errorMessage: formatSocialBackendError(error)
          })
        }
      })()
    }, SAVE_DEBOUNCE_MS)

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current)
      }
    }
  }, [client, currentPayload, enabled, sessionUserId])

  useEffect(() => {
    const handleOnline = () =>
      setSyncState((current) => ({
        ...current,
        status: current.status === 'offline' ? 'synced' : current.status
      }))
    const handleOffline = () =>
      setSyncState((current) => ({
        ...current,
        status: 'offline'
      }))

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return syncState
}
