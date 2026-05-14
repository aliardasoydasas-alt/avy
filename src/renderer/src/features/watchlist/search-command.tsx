import { LoaderCircle, Plus, Search, Star } from 'lucide-react'
import type { MarketOverviewItem } from '@shared/types/market'
import { formatCurrency } from '@renderer/utils/format'

interface SearchCommandProps {
  term: string
  onTermChange: (value: string) => void
  results: MarketOverviewItem[]
  isLoading: boolean
  favorites: string[]
  onSelectAsset: (assetId: string) => void
  onToggleFavorite: (assetId: string) => void
  onAddToWatchlist: (assetId: string) => void
}

export const SearchCommand = ({
  term,
  onTermChange,
  results,
  isLoading,
  favorites,
  onSelectAsset,
  onToggleFavorite,
  onAddToWatchlist
}: SearchCommandProps) => (
  <div className="search-command">
    <label className="search-input">
      <Search size={16} />
      <input
        value={term}
        onChange={(event) => onTermChange(event.target.value)}
        placeholder="Kripto ve hisse ara..."
      />
      {isLoading ? <LoaderCircle size={16} className="spin" /> : null}
    </label>

    {term ? (
      <div className="search-results">
        {results.length ? (
          results.slice(0, 10).map((item) => (
            <div key={item.assetId} className="asset-row">
              <button
                type="button"
                className="asset-row__content"
                onClick={() => onSelectAsset(item.assetId)}
              >
                <div>
                  <strong>{item.profile.symbol}</strong>
                  <p>{item.profile.name}</p>
                </div>
                <span>{formatCurrency(item.quote.price, item.profile.currency)}</span>
              </button>
              <div className="asset-row__actions">
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => onAddToWatchlist(item.assetId)}
                  aria-label="Izleme listesine ekle"
                >
                  <Plus size={14} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => onToggleFavorite(item.assetId)}
                  aria-label="Favori durumunu degistir"
                >
                  <Star size={14} fill={favorites.includes(item.assetId) ? 'currentColor' : 'none'} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="search-results__empty">Bu kaynaklarda eslesen varlik bulunamadi.</div>
        )}
      </div>
    ) : null}
  </div>
)
