import { Star } from 'lucide-react'
import { AssetBadge } from '@renderer/components/asset-badge'
import { Panel } from '@renderer/components/panel'
import { StateCard } from '@renderer/components/state-card'
import { StatusPill } from '@renderer/components/status-pill'
import { formatCurrency, formatPercent } from '@renderer/utils/format'
import type { AiWatchlistItem } from '@shared/types/ai-hub'

interface AiWatchlistPanelProps {
  items: AiWatchlistItem[]
  isLoading: boolean
  onSelectAsset: (assetId: string) => void
}

export const AiWatchlistPanel = ({
  items,
  isLoading,
  onSelectAsset
}: AiWatchlistPanelProps) => (
  <Panel title="AI Watchlist" subtitle="Bugün izlenmesi gereken varlıklar">
    {isLoading && !items.length ? (
      <StateCard
        title="AI watchlist hazırlanıyor"
        description="Bugün izlenmesi gereken varlıklar güncel fiyat ve teknik verilerle sıralanıyor."
      />
    ) : items.length ? (
      <div className="ai-watchlist-grid">
        {items.slice(0, 6).map((item) => (
          <button
            key={item.assetId}
            type="button"
            className="ai-watchlist-card"
            onClick={() => onSelectAsset(item.assetId)}
          >
            <div className="ai-watchlist-card__header">
              <div className="ai-watchlist-card__asset">
                <AssetBadge symbol={item.assetSymbol} assetClass={item.assetClass} />
                <div>
                  <strong>{item.assetSymbol}</strong>
                  <p>{item.assetName}</p>
                </div>
              </div>

              <div className="ai-watchlist-card__meta">
                <StatusPill label={item.badge} tone={item.tone} />
                <span className="eyebrow">%{item.confidence} güven</span>
              </div>
            </div>

            <div className="ai-watchlist-card__price">
              <strong>{formatCurrency(item.price, item.currency)}</strong>
              <span className={item.changePercent >= 0 ? 'positive-text' : 'negative-text'}>
                {formatPercent(item.changePercent)}
              </span>
            </div>

            <p>{item.summary}</p>

            <div className="ai-chip-row">
              {item.reasons.slice(0, 3).map((reason) => (
                <span key={reason} className="ai-chip">
                  <Star size={12} />
                  {reason}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    ) : (
      <StateCard
        title="İzleme listesi bekleniyor"
        description="Favoriler ve hareketli varlıklar oluştuğunda AI watchlist burada görünecek."
      />
    )}
  </Panel>
)
