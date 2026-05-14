import { useMemo, useState } from 'react'
import { BellDot } from 'lucide-react'
import { AssetBadge } from '@renderer/components/asset-badge'
import { Panel } from '@renderer/components/panel'
import { StateCard } from '@renderer/components/state-card'
import { formatRelativeTime } from '@renderer/utils/format'
import type { NotificationItem, NotificationScope } from '@shared/types/alerts'
import type { MarketOverviewItem } from '@shared/types/market'

type NotificationFilter = 'all' | NotificationScope

interface NotificationCenterProps {
  notifications: NotificationItem[]
  assetLookup?: Map<string, MarketOverviewItem>
  onRead: (notificationId: string) => void
  onReadAll: () => void
  compact?: boolean
}

const FILTER_OPTIONS: Array<{ id: NotificationFilter; label: string }> = [
  { id: 'all', label: 'Tum bildirimler' },
  { id: 'alert', label: 'Alarm' },
  { id: 'pattern', label: 'Formasyon' },
  { id: 'ai', label: 'AI analiz' },
  { id: 'live', label: 'Canlı bildirim' },
  { id: 'news', label: 'Haber' },
  { id: 'system', label: 'Sistem' }
]

export const NotificationCenter = ({
  notifications,
  assetLookup,
  onRead,
  onReadAll,
  compact = false
}: NotificationCenterProps) => {
  const [filter, setFilter] = useState<NotificationFilter>('all')

  const filteredNotifications = useMemo(
    () =>
      filter === 'all'
        ? notifications
        : notifications.filter((notification) => notification.scope === filter),
    [filter, notifications]
  )

  return (
    <Panel
      title="Bildirim merkezi"
      subtitle="Alarm, AI, formasyon, haber ve sistem olaylari"
      className={compact ? 'notification-panel notification-panel--compact' : 'notification-panel'}
      action={
        <button type="button" className="text-button" onClick={onReadAll}>
          Tumunu okundu yap
        </button>
      }
    >
      <div className="filter-chip-row">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={filter === option.id ? 'chip chip--active' : 'chip'}
            onClick={() => setFilter(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {filteredNotifications.length ? (
        <div className="list-stack">
          {filteredNotifications.map((notification) => {
            const asset = notification.assetId ? assetLookup?.get(notification.assetId) : undefined
            const symbol = notification.assetSymbol ?? asset?.profile.symbol
            const assetClass = notification.assetClass ?? asset?.profile.class

            return (
              <button
                key={notification.id}
                type="button"
                className={notification.read ? 'notification-row' : 'notification-row notification-row--unread'}
                onClick={() => onRead(notification.id)}
              >
                <div className="notification-row__icon">
                  {symbol ? <AssetBadge symbol={symbol} assetClass={assetClass} size="sm" /> : <BellDot size={16} />}
                </div>
                <div className="notification-row__copy">
                  <strong>{notification.title}</strong>
                  <p>{notification.message}</p>
                  <small>{notification.scope === 'pattern' ? 'Formasyon' : notification.scope === 'alert' ? 'Alarm' : notification.scope === 'ai' ? 'AI analiz' : notification.scope === 'live' ? 'Canlı bildirim' : notification.scope === 'news' ? 'Haber' : notification.scope === 'social' ? 'Sosyal' : 'Sistem'}</small>
                </div>
                <span>{formatRelativeTime(notification.timestamp)}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <StateCard title="Su an temiz" description="Secili filtre icin yeni bir bildirim bulunmuyor." />
      )}
    </Panel>
  )
}
