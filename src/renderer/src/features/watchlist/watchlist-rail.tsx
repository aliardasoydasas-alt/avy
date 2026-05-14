import { useState } from 'react'
import { Clock3, FolderPlus, Star } from 'lucide-react'
import type { MarketOverviewItem, WatchlistDefinition } from '@shared/types/market'
import { Panel } from '@renderer/components/panel'
import { StateCard } from '@renderer/components/state-card'
import { getMarketStatusLabel } from '@renderer/utils/market-hours'
import { formatCurrency, formatPercent } from '@renderer/utils/format'

interface WatchlistRailProps {
  watchlists: WatchlistDefinition[]
  activeWatchlistId: string
  selectedAssetId: string
  watchlistItems: MarketOverviewItem[]
  favoriteItems: MarketOverviewItem[]
  recentItems: MarketOverviewItem[]
  favorites: string[]
  onSelectWatchlist: (watchlistId: string) => void
  onCreateWatchlist: (name: string) => void
  onSelectAsset: (assetId: string) => void
  onToggleFavorite: (assetId: string) => void
}

export const WatchlistRail = ({
  watchlists,
  activeWatchlistId,
  selectedAssetId,
  watchlistItems,
  favoriteItems,
  recentItems,
  favorites,
  onSelectWatchlist,
  onCreateWatchlist,
  onSelectAsset,
  onToggleFavorite
}: WatchlistRailProps) => {
  const [draftWatchlistName, setDraftWatchlistName] = useState('')
  const renderMarketChange = (item: MarketOverviewItem): string =>
    getMarketStatusLabel(item.profile) ?? formatPercent(item.quote.changePercent)

  return (
    <div className="sidebar-stack">
      <Panel
        title="Calisma alani"
        subtitle="Izleme listeleri"
        action={
          <div className="inline-form">
            <input
              value={draftWatchlistName}
              onChange={(event) => setDraftWatchlistName(event.target.value)}
              placeholder="Yeni liste"
            />
            <button
              type="button"
              className="icon-button"
              onClick={() => {
                if (!draftWatchlistName.trim()) {
                  return
                }

                onCreateWatchlist(draftWatchlistName.trim())
                setDraftWatchlistName('')
              }}
              aria-label="Izleme listesi olustur"
            >
              <FolderPlus size={14} />
            </button>
          </div>
        }
      >
        <div className="tab-row">
          {watchlists.map((watchlist) => (
            <button
              key={watchlist.id}
              type="button"
              className={watchlist.id === activeWatchlistId ? 'tab-button tab-button--active' : 'tab-button'}
              onClick={() => onSelectWatchlist(watchlist.id)}
            >
              {watchlist.name}
            </button>
          ))}
        </div>

        {watchlistItems.length ? (
          <div className="asset-list">
            {watchlistItems.map((item) => (
              <div
                key={item.assetId}
                className={item.assetId === selectedAssetId ? 'watchlist-item watchlist-item--active' : 'watchlist-item'}
              >
                <button type="button" className="watchlist-item__main" onClick={() => onSelectAsset(item.assetId)}>
                  <div>
                    <strong>{item.profile.symbol}</strong>
                    <p>{item.profile.name}</p>
                  </div>
                  <div className="watchlist-item__price">
                    <strong>{formatCurrency(item.quote.price, item.profile.currency)}</strong>
                    <span
                      className={
                        getMarketStatusLabel(item.profile)
                          ? ''
                          : item.quote.changePercent >= 0
                            ? 'positive-text'
                            : 'negative-text'
                      }
                    >
                      {renderMarketChange(item)}
                    </span>
                  </div>
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => onToggleFavorite(item.assetId)}
                  aria-label="Favori varlik"
                >
                  <Star size={14} fill={favorites.includes(item.assetId) ? 'currentColor' : 'none'} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <StateCard title="Liste bos" description="Bu izleme listesine henuz varlik eklenmedi." />
        )}
      </Panel>

      <Panel title="Favoriler" subtitle="Sabitlenen varliklar">
        {favoriteItems.length ? (
          <div className="mini-list">
            {favoriteItems.map((item) => (
              <button key={item.assetId} type="button" className="mini-list__row" onClick={() => onSelectAsset(item.assetId)}>
                <span>{item.profile.symbol}</span>
                <span>{formatCurrency(item.quote.price, item.profile.currency)}</span>
              </button>
            ))}
          </div>
        ) : (
          <StateCard title="Favori yok" description="Hizli erisim icin varliklari favorilere ekleyebilirsin." />
        )}
      </Panel>

      <Panel title="Son goruntulenenler" subtitle="En son acilan varliklar">
        {recentItems.length ? (
          <div className="mini-list">
            {recentItems.map((item) => (
              <button key={item.assetId} type="button" className="mini-list__row" onClick={() => onSelectAsset(item.assetId)}>
                <div className="mini-list__label">
                  <Clock3 size={14} />
                  <span>{item.profile.symbol}</span>
                </div>
                <span>{renderMarketChange(item)}</span>
              </button>
            ))}
          </div>
        ) : (
          <StateCard title="Kayit yok" description="Acilan varliklar burada listelenecek." />
        )}
      </Panel>
    </div>
  )
}
