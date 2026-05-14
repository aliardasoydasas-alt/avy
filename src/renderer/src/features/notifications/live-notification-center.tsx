import { useMemo, useState } from 'react'
import { BellRing, Copy, Send, Smartphone, Target } from 'lucide-react'
import { Panel } from '@renderer/components/panel'
import { StateCard } from '@renderer/components/state-card'
import {
  buildNtfySubscribeLink,
  normalizeNtfyTopic
} from '@renderer/services/live-notification-service'
import { formatCurrency, formatRelativeTime } from '@renderer/utils/format'
import type { NotificationItem } from '@shared/types/alerts'
import type { LiveNotificationSettings } from '@shared/types/user'

interface LiveNotificationCenterProps {
  settings: LiveNotificationSettings
  portfolioValueTry: number
  liveNotifications: NotificationItem[]
  onSettingChange: <Key extends keyof LiveNotificationSettings>(
    key: Key,
    value: LiveNotificationSettings[Key]
  ) => void
  onSendTest: () => Promise<void>
}

export const LiveNotificationCenter = ({
  settings,
  portfolioValueTry,
  liveNotifications,
  onSettingChange,
  onSendTest
}: LiveNotificationCenterProps) => {
  const [statusMessage, setStatusMessage] = useState('')
  const normalizedTopic = useMemo(() => normalizeNtfyTopic(settings.ntfyTopic), [settings.ntfyTopic])
  const remainingToGoal = Math.max((settings.portfolioGoalTry ?? 0) - portfolioValueTry, 0)

  const copyTopicLink = async () => {
    if (!normalizedTopic || !navigator.clipboard) {
      setStatusMessage('Önce telefon kanalı için bir konu adı gir.')
      return
    }

    await navigator.clipboard.writeText(buildNtfySubscribeLink(normalizedTopic, settings.deviceLabel))
    setStatusMessage('Telefon abonelik bağlantısı kopyalandı.')
  }

  return (
    <Panel
      title="Canlı bildirim"
      subtitle="Portföy hedefi ve telefon push ayarları"
      className="notification-panel notification-panel--compact"
      action={
        <button
          type="button"
          className={settings.enabled ? 'chip chip--active' : 'chip'}
          onClick={() => onSettingChange('enabled', !settings.enabled)}
        >
          {settings.enabled ? 'Aktif' : 'Kapalı'}
        </button>
      }
    >
      <div className="list-stack">
        <article className="list-card">
          <div className="mini-list__label">
            <Target size={16} />
            <strong>Portföy hedefi</strong>
          </div>
          <label className="field-stack">
            <span>Hedef tutar (TL)</span>
            <input
              value={settings.portfolioGoalTry ? String(settings.portfolioGoalTry) : ''}
              onChange={(event) => {
                const value = event.target.value.trim()
                onSettingChange('portfolioGoalTry', value ? Number(value.replace(',', '.')) : undefined)
              }}
              inputMode="decimal"
              placeholder="100000"
            />
          </label>
          <p className="hero-card__helper">
            Mevcut portföy: {formatCurrency(portfolioValueTry, 'TRY', 0)}.
            {settings.portfolioGoalTry
              ? ` Hedefe kalan mesafe ${formatCurrency(remainingToGoal, 'TRY', 0)}.`
              : ' Hedef girdiğinde günlük yakınlaşma ve uzaklaşma bildirimleri başlar.'}
          </p>
        </article>

        <article className="list-card">
          <div className="mini-list__label">
            <Smartphone size={16} />
            <strong>Telefon kanalı</strong>
          </div>

          <label className="setting-row">
            <div>
              <strong>Telefon push aktif</strong>
              <p>Desktop bildirime ek olarak telefonuna da bildirim gönder.</p>
            </div>
            <input
              type="checkbox"
              checked={settings.mobileEnabled}
              onChange={(event) => onSettingChange('mobileEnabled', event.target.checked)}
            />
          </label>

          <label className="field-stack">
            <span>Telefon etiketi</span>
            <input
              value={settings.deviceLabel}
              onChange={(event) => onSettingChange('deviceLabel', event.target.value)}
              placeholder="iPhone 15 / Android"
            />
          </label>

          <label className="field-stack">
            <span>Canlı bildirim konusu</span>
            <input
              value={settings.ntfyTopic}
              onChange={(event) => onSettingChange('ntfyTopic', normalizeNtfyTopic(event.target.value))}
              placeholder="avy-telefon-kanalim"
            />
          </label>

          <p className="hero-card__helper">
            Telefonda ntfy uygulamasında bu konuya abone olduğunda AVY telefonuna push gönderebilir.
          </p>

          <div className="inline-form">
            <button type="button" className="secondary-button" onClick={() => void copyTopicLink()}>
              <Copy size={16} />
              Abonelik linkini kopyala
            </button>
            <button type="button" className="primary-button" onClick={() => void onSendTest()}>
              <Send size={16} />
              Test gönder
            </button>
          </div>
        </article>

        {statusMessage ? <p className="hero-card__helper">{statusMessage}</p> : null}

        {liveNotifications.length ? (
          <div className="list-stack">
            {liveNotifications.slice(0, 6).map((notification) => (
              <article key={notification.id} className="notification-row notification-row--unread">
                <div className="notification-row__icon">
                  <BellRing size={16} />
                </div>
                <div className="notification-row__copy">
                  <strong>{notification.title}</strong>
                  <p>{notification.message}</p>
                </div>
                <span>{formatRelativeTime(notification.timestamp)}</span>
              </article>
            ))}
          </div>
        ) : (
          <StateCard
            title="Canlı bildirim bekleniyor"
            description="Portföy hedefi ve kayda değer varlık hareketleri oluştuğunda burada görünecek."
          />
        )}
      </div>
    </Panel>
  )
}
