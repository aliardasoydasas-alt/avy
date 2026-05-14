import type { AlertRule, AlertTrigger } from '@shared/types/alerts'
import type { AssetQuote, AssetSnapshot } from '@shared/types/market'
import type { PatternSignal } from '@shared/types/patterns'
import { PATTERN_LABELS } from '@renderer/utils/constants'
import { createId } from '@renderer/utils/id'
import { formatCurrency } from '@renderer/utils/format'

interface AlertEvaluationContext {
  snapshot: AssetSnapshot
  patterns: PatternSignal[]
  previousQuote?: AssetQuote
}

const isCoolingDown = (rule: AlertRule, now: Date): boolean => {
  if (!rule.lastTriggeredAt) {
    return false
  }

  const elapsedMinutes = (now.getTime() - new Date(rule.lastTriggeredAt).getTime()) / 60000
  return elapsedMinutes < rule.cooldownMinutes
}

const buildTrigger = (
  rule: AlertRule,
  title: string,
  message: string,
  severity: AlertTrigger['severity']
): AlertTrigger => ({
  id: createId('trigger'),
  alertId: rule.id,
  assetId: rule.assetId,
  firedAt: new Date().toISOString(),
  title,
  message,
  severity
})

export const evaluateAlerts = (
  alerts: AlertRule[],
  context: AlertEvaluationContext
): AlertTrigger[] => {
  const now = new Date()
  const { snapshot, patterns, previousQuote } = context
  const { price, changePercent } = snapshot.quote
  const currency = snapshot.profile.currency

  return alerts.flatMap((rule) => {
    if (!rule.enabled || isCoolingDown(rule, now)) {
      return []
    }

    switch (rule.type) {
      case 'price_above':
        if (rule.threshold !== undefined && price >= rule.threshold) {
          return [
            buildTrigger(
              rule,
              `${snapshot.profile.symbol} hedefi yukari kirdi`,
              `${snapshot.profile.symbol}, ${formatCurrency(rule.threshold, currency)} seviyesinin uzerine cikti.`,
              'success'
            )
          ]
        }
        return []

      case 'price_below':
        if (rule.threshold !== undefined && price <= rule.threshold) {
          return [
            buildTrigger(
              rule,
              `${snapshot.profile.symbol} seviye altina sarkti`,
              `${snapshot.profile.symbol}, ${formatCurrency(rule.threshold, currency)} seviyesinin altina indi.`,
              'warning'
            )
          ]
        }
        return []

      case 'percent_up':
        if (rule.threshold !== undefined && changePercent >= rule.threshold) {
          return [
            buildTrigger(
              rule,
              `${snapshot.profile.symbol} guclu yukseliyor`,
              `${snapshot.profile.symbol}, aktif pencerede %${changePercent.toFixed(2)} yukseliste.`,
              'success'
            )
          ]
        }
        return []

      case 'percent_down':
        if (rule.threshold !== undefined && changePercent <= -Math.abs(rule.threshold)) {
          return [
            buildTrigger(
              rule,
              `${snapshot.profile.symbol} satis baskisi altinda`,
              `${snapshot.profile.symbol}, aktif pencerede %${Math.abs(changePercent).toFixed(2)} dususte.`,
              'warning'
            )
          ]
        }
        return []

      case 'reversal':
        if (
          previousQuote &&
          rule.referencePrice !== undefined &&
          ((previousQuote.price > rule.referencePrice && price <= rule.referencePrice * 1.002) ||
            (previousQuote.price < rule.referencePrice && price >= rule.referencePrice * 0.998))
        ) {
          return [
            buildTrigger(
              rule,
              `${snapshot.profile.symbol} donus seviyesini tekrar test etti`,
              `${snapshot.profile.symbol}, ${formatCurrency(rule.referencePrice, currency)} seviyesini gectikten sonra tekrar bu bolgeye dokundu.`,
              'info'
            )
          ]
        }
        return []

      case 'pattern': {
        const activePattern = patterns.find(
          (pattern) =>
            pattern.type === rule.patternType &&
            pattern.status === 'confirmed'
        )

        if (activePattern) {
          return [
            buildTrigger(
              rule,
              `${snapshot.profile.symbol} formasyon uyarisi`,
              `${PATTERN_LABELS[activePattern.type]} formasyonu %${Math.round(activePattern.confidence * 100)} guvenle dogrulandi.`,
              'info'
            )
          ]
        }

        return []
      }

      default:
        return []
    }
  })
}
