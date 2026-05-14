import { useEffect, useState } from 'react'
import type { AlertRule, AlertTrigger } from '@shared/types/alerts'
import type { AssetSnapshot } from '@shared/types/market'
import type { PatternType } from '@shared/types/patterns'
import { Panel } from '@renderer/components/panel'
import { StateCard } from '@renderer/components/state-card'
import { PATTERN_LABELS, SUPPORTED_PATTERN_TYPES } from '@renderer/utils/constants'
import {
  formatCurrency,
  formatEditableNumber,
  formatPercent,
  formatRelativeTime
} from '@renderer/utils/format'

interface AlertsPanelProps {
  snapshot: AssetSnapshot
  alerts: AlertRule[]
  alertHistory: AlertTrigger[]
  onCreateAlert: (input: {
    assetId: string
    label: string
    type: AlertRule['type']
    threshold?: number
    referencePrice?: number
    patternType?: PatternType
  }) => void
  onToggleAlert: (alertId: string) => void
}

const buildAlertSummary = (alert: AlertRule, snapshot: AssetSnapshot): string => {
  switch (alert.type) {
    case 'pattern':
      return `${PATTERN_LABELS[alert.patternType ?? 'bull_flag']} formasyonu olusunca bildir.`
    case 'reversal':
      return `${formatCurrency(alert.referencePrice ?? snapshot.quote.price, snapshot.profile.currency)} seviyesi kirilip tekrar test edilince bildir.`
    case 'percent_up':
      return `Fiyat ${formatPercent(alert.threshold ?? 0)} veya daha fazla yukselince bildir.`
    case 'percent_down':
      return `Fiyat ${formatPercent(-Math.abs(alert.threshold ?? 0))} veya daha fazla dusunce bildir.`
    case 'price_above':
      return `${formatCurrency(alert.threshold ?? snapshot.quote.price, snapshot.profile.currency)} uzerine cikinca bildir.`
    case 'price_below':
      return `${formatCurrency(alert.threshold ?? snapshot.quote.price, snapshot.profile.currency)} altina inince bildir.`
    default:
      return alert.label
  }
}

export const AlertsPanel = ({
  snapshot,
  alerts,
  alertHistory,
  onCreateAlert,
  onToggleAlert
}: AlertsPanelProps) => {
  const [type, setType] = useState<AlertRule['type']>('price_above')
  const [label, setLabel] = useState(`${snapshot.profile.symbol} alarmi`)
  const [value, setValue] = useState(formatEditableNumber(snapshot.quote.price))
  const [patternType, setPatternType] = useState<PatternType>('bull_flag')

  const numericValue = Number(value)

  useEffect(() => {
    setLabel(`${snapshot.profile.symbol} alarmi`)
    setValue(formatEditableNumber(snapshot.quote.price))
  }, [snapshot.profile.symbol, snapshot.quote.price])

  return (
    <Panel title="Alarmlar" subtitle="Kurallar ve tetiklenme gecmisi">
      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault()

          if (type !== 'pattern' && Number.isNaN(numericValue)) {
            return
          }

          onCreateAlert({
            assetId: snapshot.profile.id,
            label: label.trim() || `${snapshot.profile.symbol} alarmi`,
            type,
            threshold:
              type === 'price_above' || type === 'price_below' || type === 'percent_up' || type === 'percent_down'
                ? numericValue
                : undefined,
            referencePrice: type === 'reversal' ? numericValue : undefined,
            patternType: type === 'pattern' ? patternType : undefined
          })
        }}
      >
        <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Alarm etiketi" />
        <select value={type} onChange={(event) => setType(event.target.value as AlertRule['type'])}>
          <option value="price_above">Fiyat ustune cikinca</option>
          <option value="price_below">Fiyat altina inince</option>
          <option value="percent_up">% yukselince</option>
          <option value="percent_down">% dusunce</option>
          <option value="reversal">Kirip geri donunce</option>
          <option value="pattern">Formasyon olusunca</option>
        </select>

        {type === 'pattern' ? (
          <select value={patternType} onChange={(event) => setPatternType(event.target.value as PatternType)}>
            {SUPPORTED_PATTERN_TYPES.map((item) => (
              <option key={item} value={item}>
                {PATTERN_LABELS[item]}
              </option>
            ))}
          </select>
        ) : (
          <input value={value} onChange={(event) => setValue(event.target.value)} placeholder="Esik deger" />
        )}

        <button type="submit" className="primary-button">
          Alarm olustur
        </button>
      </form>

      <div className="list-stack">
        {alerts.length ? (
          alerts.map((alert) => (
            <article key={alert.id} className="list-card">
              <div className="list-card__header">
                <strong>{alert.label}</strong>
                <button type="button" className={alert.enabled ? 'chip chip--active' : 'chip'} onClick={() => onToggleAlert(alert.id)}>
                  {alert.enabled ? 'Aktif' : 'Duraklatildi'}
                </button>
              </div>
              <p>{buildAlertSummary(alert, snapshot)}</p>
            </article>
          ))
        ) : (
          <StateCard title="Aktif alarm yok" description="Secili varlik icin fiyat, yuzde veya formasyon alarmi kurabilirsin." />
        )}
      </div>

      <div className="history-section">
        <p className="eyebrow">Tetiklenme gecmisi</p>
        {alertHistory.length ? (
          <div className="list-stack">
            {alertHistory.map((trigger) => (
              <article key={trigger.id} className="history-row">
                <div>
                  <strong>{trigger.title}</strong>
                  <p>{trigger.message}</p>
                </div>
                <span>{formatRelativeTime(trigger.firedAt)}</span>
              </article>
            ))}
          </div>
        ) : (
          <StateCard title="Henuz tetiklenme yok" description="Calisan alarmlar burada son zaman bilgisiyle listelenecek." />
        )}
      </div>
    </Panel>
  )
}
