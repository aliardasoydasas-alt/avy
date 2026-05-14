import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { AssetSnapshot, MarketOverviewItem, Timeframe, AssetQuote } from '@shared/types/market'
import { evaluateAlerts } from '@renderer/services/alert-engine'
import { evaluateAiAlerts } from '@renderer/services/ai-alert-engine'
import { playAudioFeedback } from '@renderer/services/audio-feedback-service'
import { getCriticalHomeNews, getExternalHomePulse } from '@renderer/services/home-data-service'
import { sendDesktopNotification } from '@renderer/services/notification-service'
import { detectAllPatterns } from '@renderer/services/pattern-detector'
import { marketProvider } from '@renderer/services/providers/provider-registry'
import { useAiHubStore } from '@renderer/store/use-ai-hub-store'
import { useSettingsStore } from '@renderer/store/use-settings-store'
import { useTerminalStore } from '@renderer/store/use-terminal-store'
import { PATTERN_LABELS } from '@renderer/utils/constants'

export const useMarketOverviewQuery = () =>
  useQuery({
    queryKey: ['market-overview'],
    queryFn: () => marketProvider.getOverview(),
    staleTime: 1000 * 18,
    refetchInterval: 1000 * 25,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    retry: 1
  })

export const useAssetSearchQuery = (term: string) =>
  useQuery({
    queryKey: ['asset-search', term],
    queryFn: () => marketProvider.searchAssets(term),
    enabled: term.trim().length > 0
  })

export const useAssetDetailQuery = (
  assetId: string,
  timeframe: Timeframe,
  enabled = true
) =>
  useQuery({
    queryKey: ['asset-detail', assetId, timeframe],
    queryFn: () => marketProvider.getAssetDetail(assetId, timeframe),
    enabled: enabled && Boolean(assetId)
  })

export const useAssetNewsQuery = (assetId: string, enabled = true) =>
  useQuery({
    queryKey: ['asset-news', assetId],
    queryFn: () => marketProvider.getNews(assetId),
    enabled: enabled && Boolean(assetId)
  })

export const useHomeCriticalNewsQuery = (enabled = true) =>
  useQuery({
    queryKey: ['home-critical-news', 'raw-v3'],
    queryFn: getCriticalHomeNews,
    enabled,
    staleTime: 1000 * 60 * 10,
    refetchInterval: 1000 * 60 * 10,
    retry: 1
  })

export const useHomeExternalPulseQuery = (enabled = true) =>
  useQuery({
    queryKey: ['home-external-pulse'],
    queryFn: getExternalHomePulse,
    enabled,
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 60,
    retry: 1
  })

export const useRealtimeMarketStream = (
  assetIds: string[],
  selectedAssetId: string,
  selectedTimeframe: Timeframe
): void => {
  const queryClient = useQueryClient()
  const previousQuotesRef = useRef<Record<string, AssetQuote>>({})
  const snapshotRefreshRef = useRef<Record<string, number>>({})
  const signalEvaluationRef = useRef<Record<string, number>>({})
  const assetKey = assetIds.join('|')

  const patchSnapshotQuote = (snapshot: AssetSnapshot, quote: AssetQuote): AssetSnapshot => {
    const candles = [...snapshot.candles]
    const lastCandle = candles[candles.length - 1]

    if (lastCandle) {
      candles[candles.length - 1] = {
        ...lastCandle,
        close: quote.price,
        high: Math.max(lastCandle.high, quote.price),
        low: Math.min(lastCandle.low, quote.price)
      }
    }

    return {
      ...snapshot,
      quote,
      candles,
      metrics: {
        ...snapshot.metrics,
        volatility:
          quote.price > 0 ? Number((((quote.high24h - quote.low24h) / quote.price) * 100).toFixed(2)) : snapshot.metrics.volatility,
        sentimentScore: Math.round(Math.max(10, Math.min(90, 50 + quote.changePercent * 3)))
      }
    }
  }

  useEffect(() => {
    const streamAssetIds = assetKey ? assetKey.split('|') : []

    if (streamAssetIds.length === 0) {
      return
    }

    const pendingOverviewQuotes = new Map<string, AssetQuote>()
    let overviewFlushTimer: number | null = null
    let selectedTickFrame: number | null = null
    let latestSelectedTick: AssetTick | null = null

    const flushOverviewQuotes = () => {
      overviewFlushTimer = null

      if (!pendingOverviewQuotes.size) {
        return
      }

      const updates = new Map(pendingOverviewQuotes)
      pendingOverviewQuotes.clear()

      queryClient.setQueryData<MarketOverviewItem[] | undefined>(['market-overview'], (current) => {
        if (!current?.length) {
          return current
        }

        let changed = false
        const next = current.map((item) => {
          const nextQuote = updates.get(item.assetId)
          if (!nextQuote) {
            return item
          }

          changed = true
          return {
            ...item,
            quote: nextQuote
          }
        })

        return changed ? next : current
      })
    }

    const scheduleOverviewFlush = () => {
      if (overviewFlushTimer !== null) {
        return
      }

      overviewFlushTimer = window.setTimeout(flushOverviewQuotes, 1000)
    }

    const flushSelectedTick = () => {
      selectedTickFrame = null

      if (!latestSelectedTick || latestSelectedTick.assetId !== selectedAssetId) {
        return
      }

      window.dispatchEvent(
        new CustomEvent('avy:selected-asset-live-tick', {
          detail: {
            assetId: selectedAssetId,
            timeframe: selectedTimeframe,
            quote: latestSelectedTick.quote
          }
        })
      )
    }

    const scheduleSelectedTickFlush = () => {
      if (selectedTickFrame !== null) {
        return
      }

      selectedTickFrame = window.requestAnimationFrame(flushSelectedTick)
    }

    const unsubscribe = marketProvider.subscribe(streamAssetIds, (tick) => {
      pendingOverviewQuotes.set(tick.assetId, tick.quote)
      scheduleOverviewFlush()

      if (tick.assetId === selectedAssetId) {
        latestSelectedTick = tick
        scheduleSelectedTickFlush()

        const selectedRefreshKey = `${selectedAssetId}:${selectedTimeframe}`
        const lastSelectedRefresh = snapshotRefreshRef.current[selectedRefreshKey] ?? 0

        if (Date.now() - lastSelectedRefresh > 45_000) {
          snapshotRefreshRef.current[selectedRefreshKey] = Date.now()
          void marketProvider.getAssetDetail(selectedAssetId, selectedTimeframe).then((snapshot) => {
            queryClient.setQueryData(['asset-detail', selectedAssetId, selectedTimeframe], snapshot)
          })
        }
      }

      const previousQuote = previousQuotesRef.current[tick.assetId]
      previousQuotesRef.current[tick.assetId] = tick.quote

      const processSnapshot = (snapshot: AssetSnapshot) => {
        const state = useTerminalStore.getState()
        const notificationSettings = useSettingsStore.getState().settings.notifications
        const relevantAlerts = state.alerts.filter(
          (alert) => alert.assetId === tick.assetId && alert.enabled
        )
        const hasPatternNotifications = Object.values(state.patternNotificationSettings).some(Boolean)
        const trackedAssetIds = new Set(
          [
            ...state.favorites,
            ...state.watchlists.flatMap((watchlist) => watchlist.assetIds),
            ...state.alerts.map((alert) => alert.assetId)
          ].filter(Boolean)
        )
        const isTrackedAsset = trackedAssetIds.has(tick.assetId)
        const shouldEvaluateSignals =
          tick.assetId === selectedAssetId ||
          relevantAlerts.length > 0 ||
          (hasPatternNotifications && isTrackedAsset) ||
          (notificationSettings.ai && isTrackedAsset)

        if (!shouldEvaluateSignals) {
          return
        }

        const evaluationKey = `${tick.assetId}:${selectedTimeframe}`
        const minInterval = tick.assetId === selectedAssetId ? 2_400 : 7_000
        const lastEvaluation = signalEvaluationRef.current[evaluationKey] ?? 0

        if (Date.now() - lastEvaluation < minInterval) {
          return
        }

        signalEvaluationRef.current[evaluationKey] = Date.now()
        const patterns = detectAllPatterns(snapshot.candles)
        const triggers = evaluateAlerts(relevantAlerts, {
          snapshot,
          patterns,
          previousQuote
        })

        triggers.forEach((trigger) => {
          state.recordAlertTrigger(trigger)
          state.syncAlertLastTriggered(trigger.alertId, trigger.firedAt)

          const pushed = state.pushNotification({
            title: trigger.title,
            message: trigger.message,
            timestamp: trigger.firedAt,
            scope: 'alert',
            assetId: trigger.assetId,
            assetSymbol: snapshot.profile.symbol,
            assetName: snapshot.profile.name,
            assetClass: snapshot.profile.class,
            dedupeKey: `alert:${trigger.alertId}`
          })

          if (pushed) {
            void playAudioFeedback('notification')
            void sendDesktopNotification(trigger.title, trigger.message)
          }
        })

        patterns
          .filter(
            (pattern) =>
              pattern.status === 'confirmed' &&
              state.patternNotificationSettings[pattern.type]
          )
          .forEach((pattern) => {
            const message = `${snapshot.profile.symbol}: ${PATTERN_LABELS[pattern.type]} formasyonu %${Math.round(pattern.confidence * 100)} guvenle dogrulandi.`
            const pushed = state.pushNotification({
              title: `${snapshot.profile.symbol} formasyon sinyali`,
              message,
              timestamp: new Date().toISOString(),
              scope: 'pattern',
              assetId: snapshot.profile.id,
              assetSymbol: snapshot.profile.symbol,
              assetName: snapshot.profile.name,
              assetClass: snapshot.profile.class,
              dedupeKey: `pattern:${snapshot.profile.id}:${pattern.type}`
            })

            if (pushed) {
              void playAudioFeedback('notification')
              void sendDesktopNotification(`${snapshot.profile.symbol} formasyon sinyali`, message)
            }
          })

        const aiSignals = evaluateAiAlerts({
          snapshot,
          previousQuote,
          patterns
        })

        aiSignals.forEach((signal) => {
          const pushed = state.pushNotification({
            title: signal.title,
            message: signal.message,
            timestamp: signal.createdAt,
            scope: 'ai',
            assetId: signal.assetId,
            assetSymbol: signal.assetSymbol,
            assetName: signal.assetName,
            assetClass: signal.assetClass,
            dedupeKey: signal.dedupeKey
          })

          if (pushed) {
            useAiHubStore.getState().recordHistory([
              {
                createdAt: signal.createdAt,
                title: signal.title,
                message: signal.message,
                tone: signal.tone,
                kind: signal.kind,
                assetId: signal.assetId,
                assetSymbol: signal.assetSymbol,
                dedupeKey: signal.dedupeKey
              }
            ])
            void playAudioFeedback('notification')
            void sendDesktopNotification(signal.title, signal.message)
          }
        })
      }

      const cachedPatternSnapshot = queryClient.getQueryData<AssetSnapshot>(['asset-detail', tick.assetId, '1H'])
      if (cachedPatternSnapshot) {
        processSnapshot(patchSnapshotQuote(cachedPatternSnapshot, tick.quote))
      }

      const patternRefreshKey = `${tick.assetId}:1H`
      const lastPatternRefresh = snapshotRefreshRef.current[patternRefreshKey] ?? 0

      if (Date.now() - lastPatternRefresh <= 120_000) {
        return
      }

      snapshotRefreshRef.current[patternRefreshKey] = Date.now()

      void marketProvider.getAssetDetail(tick.assetId, '1H').then((snapshot) => {
        queryClient.setQueryData(['asset-detail', tick.assetId, '1H'], snapshot)
        processSnapshot(snapshot)
      })
    })

    return () => {
      unsubscribe()

      if (overviewFlushTimer !== null) {
        window.clearTimeout(overviewFlushTimer)
      }

      if (selectedTickFrame !== null) {
        window.cancelAnimationFrame(selectedTickFrame)
      }
    }
  }, [assetKey, queryClient, selectedAssetId, selectedTimeframe])
}
