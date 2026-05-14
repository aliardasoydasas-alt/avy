import { memo } from 'react'
import { Bell, Star } from 'lucide-react'
import { StatusPill } from '@renderer/components/status-pill'
import { formatCurrency, formatPercent, formatVolume } from '@renderer/utils/format'
import { getMarketStatusLabel } from '@renderer/utils/market-hours'
import type { AssetQuote, AssetSnapshot } from '@shared/types/market'

interface TerminalAssetBarProps {
  snapshot: AssetSnapshot
  liveQuote?: AssetQuote
  isFavorite: boolean
  unreadNotifications: number
  aiTitle?: string
  onToggleFavorite: (assetId: string) => void
}

const TerminalAssetBarComponent = ({
  snapshot,
  liveQuote,
  isFavorite,
  unreadNotifications,
  aiTitle,
  onToggleFavorite
}: TerminalAssetBarProps) => {
  const marketStatusLabel = getMarketStatusLabel(snapshot.profile)
  const quote = liveQuote ?? snapshot.quote

  return (
    <section className="terminal-asset-bar">
      <div className="terminal-asset-bar__identity">
        <div className="terminal-asset-badge terminal-asset-badge--large">
          {snapshot.profile.symbol.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="terminal-asset-bar__title">
            <strong>{snapshot.profile.symbol}</strong>
            <span>{snapshot.profile.name}</span>
            {aiTitle ? <StatusPill label={aiTitle} tone="info" /> : null}
            {marketStatusLabel ? <StatusPill label={marketStatusLabel} tone="neutral" /> : null}
          </div>
          <div className="terminal-asset-bar__meta">
            <span>{snapshot.profile.exchange}</span>
            <span>{snapshot.profile.class === 'crypto' ? 'Kripto' : 'Hisse'}</span>
            <span>Hacim {formatVolume(quote.volume)}</span>
          </div>
        </div>
      </div>

      <div className="terminal-asset-bar__stats">
        <div className="terminal-asset-bar__price">
          <strong>{formatCurrency(quote.price, snapshot.profile.currency)}</strong>
          <span className={quote.changePercent >= 0 ? 'positive-text' : 'negative-text'}>
            {formatPercent(quote.changePercent)}
          </span>
        </div>

        <button
          type="button"
          className="terminal-asset-bar__icon"
          onClick={() => onToggleFavorite(snapshot.profile.id)}
          title="Favoriye ekle"
        >
          <Star size={16} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>

        <div className="terminal-asset-bar__icon terminal-asset-bar__icon--badge" title="Bildirimler">
          <Bell size={16} />
          <span>{unreadNotifications}</span>
        </div>
      </div>
    </section>
  )
}

export const TerminalAssetBar = memo(TerminalAssetBarComponent)
