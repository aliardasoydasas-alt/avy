import { useEffect, useRef } from 'react'
import { playAudioFeedback } from '@renderer/services/audio-feedback-service'
import { sendLiveMobileNotification } from '@renderer/services/live-notification-service'
import { sendDesktopNotification } from '@renderer/services/notification-service'
import type { PortfolioSummary } from '@renderer/services/portfolio-service'
import { useTerminalStore } from '@renderer/store/use-terminal-store'
import { formatCurrency, formatPercent } from '@renderer/utils/format'
import type { LiveNotificationSettings } from '@shared/types/user'

interface UseLivePortfolioNotificationsOptions {
  summary: PortfolioSummary
  settings: LiveNotificationSettings
  enabled: boolean
}

interface VolumeBaseline {
  average: number
  samples: number
}

const buildDayKey = (): string => new Date().toISOString().slice(0, 10)

export const useLivePortfolioNotifications = ({
  summary,
  settings,
  enabled
}: UseLivePortfolioNotificationsOptions): void => {
  const volumeBaselineRef = useRef<Record<string, VolumeBaseline>>({})

  useEffect(() => {
    if (!enabled || !settings.enabled || !summary.holdings.length) {
      return
    }

    const state = useTerminalStore.getState()
    const todayKey = buildDayKey()

    const notify = async (
      title: string,
      message: string,
      dedupeKey: string,
      assetMeta?: { assetId?: string; assetSymbol?: string; assetName?: string; assetClass?: 'crypto' | 'stock' | 'index' | 'commodity' }
    ) => {
      const pushed = state.pushNotification({
        title,
        message,
        timestamp: new Date().toISOString(),
        scope: 'live',
        dedupeKey,
        assetId: assetMeta?.assetId,
        assetSymbol: assetMeta?.assetSymbol,
        assetName: assetMeta?.assetName,
        assetClass: assetMeta?.assetClass
      })

      if (!pushed) {
        return
      }

      void playAudioFeedback('notification')
      void sendDesktopNotification(title, message)
      void sendLiveMobileNotification({
        title,
        body: message,
        settings,
        priority: 'high',
        tags: ['chart_with_upwards_trend', 'moneybag']
      }).catch((error) => {
        console.error('AVY live mobile notification failed', error)
      })
    }

    if (settings.portfolioGoalTry && settings.portfolioGoalTry > 0) {
      const absDailyPercent = Math.floor(Math.abs(summary.totalDailyChangePercent))

      if (absDailyPercent >= 3) {
        const remainingToGoal = Math.max(settings.portfolioGoalTry - summary.totalValueTry, 0)

        for (let threshold = 3; threshold <= absDailyPercent; threshold += 1) {
          if (summary.totalDailyChangePercent > 0) {
            void notify(
              'Hedefine daha da yaklaştın',
              `Bugün hedefine %${threshold} yükseliş ile daha da yaklaştın. Hedefine ${formatCurrency(remainingToGoal, 'TRY', 0)} kaldı.`,
              `live:goal:up:${todayKey}:${threshold}`
            )
          } else {
            void notify(
              'Hedeften uzaklaşma uyarısı',
              `Bugün hedefinden maalesef %${threshold} uzaklaştın. Hedefine ${formatCurrency(remainingToGoal, 'TRY', 0)} kaldı.`,
              `live:goal:down:${todayKey}:${threshold}`
            )
          }
        }
      }
    }

    summary.holdings.forEach((item) => {
      if (item.holding.assetType === 'cash') {
        return
      }

      const baseline = volumeBaselineRef.current[item.holding.assetId] ?? {
        average: item.asset?.quote.volume ?? item.totalValueTry,
        samples: 0
      }
      const currentVolume = item.asset?.quote.volume ?? 0
      const nextAverage =
        baseline.samples === 0 ? currentVolume : baseline.average * 0.78 + currentVolume * 0.22

      volumeBaselineRef.current[item.holding.assetId] = {
        average: nextAverage,
        samples: baseline.samples + 1
      }

      const assetMeta = {
        assetId: item.holding.assetId,
        assetSymbol: item.holding.assetSymbol,
        assetName: item.holding.assetName,
        assetClass: item.holding.assetClass === 'cash' ? undefined : item.holding.assetClass
      }

      if (baseline.samples >= 4 && currentVolume > nextAverage * 1.35 && item.dailyChangePercent >= 2.2) {
        void notify(
          `${item.holding.assetSymbol} hacimli yükseliyor`,
          `Varlıkların ${item.holding.assetSymbol} bugün hacimli artıyor. Dikkatte kal! Şu anki günlük değişim ${formatPercent(item.dailyChangePercent)} seviyesinde.`,
          `live:volume:${todayKey}:${item.holding.assetId}:${Math.floor(item.dailyChangePercent)}`,
          assetMeta
        )
      }

      if (item.dailyChangePercent >= 5) {
        void notify(
          `${item.holding.assetSymbol} güçlü yükseldi`,
          `Varlıklarından ${item.holding.assetSymbol} bugün ${formatPercent(item.dailyChangePercent)} yükseldi. Tebrikler!`,
          `live:gain:${todayKey}:${item.holding.assetId}:${Math.floor(item.dailyChangePercent)}`,
          assetMeta
        )
      }

      if (item.dailyChangePercent <= -4) {
        void notify(
          `${item.holding.assetSymbol} zayıflıyor`,
          `Varlıklarından ${item.holding.assetSymbol} bugün ${formatPercent(Math.abs(item.dailyChangePercent))} azaldı. Dikkat et!`,
          `live:drop:${todayKey}:${item.holding.assetId}:${Math.floor(Math.abs(item.dailyChangePercent))}`,
          assetMeta
        )
      }
    })
  }, [enabled, settings, summary])
}
