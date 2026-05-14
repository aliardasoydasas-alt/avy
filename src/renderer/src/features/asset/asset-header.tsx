import { useEffect, useState } from 'react'
import { Bell, ListPlus, Star } from 'lucide-react'
import type { AssetSnapshot, WatchlistDefinition } from '@shared/types/market'
import { AyLogo } from '@renderer/components/ay-logo'
import { StatusPill } from '@renderer/components/status-pill'
import { getMarketStatusLabel } from '@renderer/utils/market-hours'
import {
  formatCompactNumber,
  formatCurrency,
  formatPercent,
  formatVolume
} from '@renderer/utils/format'

interface AssetHeaderProps {
  snapshot: AssetSnapshot
  isFavorite: boolean
  onToggleFavorite: (assetId: string) => void
  unreadNotifications: number
  watchlists: WatchlistDefinition[]
  activeWatchlistId: string
  onAddToWatchlist: (assetId: string, watchlistId: string) => boolean
  aiTitle?: string
  aiSummary?: string
}

export const AssetHeader = ({
  snapshot,
  isFavorite,
  onToggleFavorite,
  unreadNotifications,
  watchlists,
  activeWatchlistId,
  onAddToWatchlist,
  aiTitle,
  aiSummary
}: AssetHeaderProps) => {
  const { profile, quote, overview, metrics } = snapshot
  const [selectedWatchlistId, setSelectedWatchlistId] = useState(activeWatchlistId)
  const [watchlistMessage, setWatchlistMessage] = useState('')
  const marketStatusLabel = getMarketStatusLabel(profile)
  const classLabel =
    profile.class === 'crypto'
      ? 'Kripto'
      : profile.class === 'stock'
        ? 'Hisse'
        : profile.class === 'index'
          ? 'Endeks'
          : profile.class === 'commodity'
            ? 'Emtia'
            : profile.class
  const latencyLabel =
    quote.latency === 'realtime'
      ? 'Canli'
      : quote.latency === 'delayed'
        ? 'Gecikmeli'
        : quote.latency === 'derived'
          ? 'Turetilmis'
          : null

  useEffect(() => {
    setSelectedWatchlistId(activeWatchlistId)
    setWatchlistMessage('')
  }, [activeWatchlistId, profile.id])

  return (
    <section className="hero-card">
      <div className="hero-card__main">
        <div>
          <p className="eyebrow">
            {classLabel} | {profile.exchange}
          </p>
          <div className="hero-card__title">
            <h2>
              {profile.name} <span>{profile.symbol}</span>
            </h2>
            <StatusPill
              label={marketStatusLabel ?? `Momentum ${formatPercent(quote.changePercent)}`}
              tone={marketStatusLabel ? 'neutral' : quote.changePercent >= 0 ? 'positive' : 'negative'}
            />
            {latencyLabel ? <StatusPill label={latencyLabel} tone="info" /> : null}
            {snapshot.syntheticHistory ? <StatusPill label="Grafik onizleme" tone="neutral" /> : null}
            {aiTitle ? <StatusPill label={aiTitle} tone="info" /> : null}
          </div>
          <p className="hero-card__overview">{overview}</p>
          {aiSummary ? <p className="hero-card__helper">{aiSummary}</p> : null}
        </div>

        <div className="hero-card__actions">
          <AyLogo compact showText={false} />
          <div className="watchlist-picker">
            <select
              value={selectedWatchlistId}
              onChange={(event) => setSelectedWatchlistId(event.target.value)}
            >
              {watchlists.map((watchlist) => (
                <option key={watchlist.id} value={watchlist.id}>
                  {watchlist.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                const added = onAddToWatchlist(profile.id, selectedWatchlistId)
                setWatchlistMessage(added ? 'Listeye eklendi' : 'Bu listede zaten var')
              }}
            >
              <ListPlus size={16} />
              Listeye ekle
            </button>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={() => onToggleFavorite(profile.id)}
          >
            <Star size={16} fill={isFavorite ? 'currentColor' : 'none'} />
            {isFavorite ? 'Favorilerde' : 'Favoriye ekle'}
          </button>

          <div className="notification-badge">
            <Bell size={16} />
            <span>{unreadNotifications}</span>
          </div>
        </div>
      </div>
      {watchlistMessage ? <p className="hero-card__helper">{watchlistMessage}</p> : null}

      <div className="hero-metrics">
        <div className="metric-card metric-card--large">
          <span>Son fiyat</span>
          <strong>{formatCurrency(quote.price, profile.currency)}</strong>
        </div>
        <div className="metric-card">
          <span>24s aralik</span>
          <strong>
            {formatCurrency(quote.low24h, profile.currency)} -{' '}
            {formatCurrency(quote.high24h, profile.currency)}
          </strong>
        </div>
        <div className="metric-card">
          <span>Hacim</span>
          <strong>{formatVolume(quote.volume)}</strong>
        </div>
        <div className="metric-card">
          <span>Duygu skoru</span>
          <strong>{metrics.sentimentScore}/100</strong>
        </div>
        <div className="metric-card">
          <span>Piyasa degeri</span>
          <strong>{metrics.marketCap ? formatCompactNumber(metrics.marketCap) : '-'}</strong>
        </div>
      </div>
    </section>
  )
}
