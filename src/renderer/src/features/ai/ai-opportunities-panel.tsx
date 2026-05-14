import { Activity, CandlestickChart, Radar, Waves } from 'lucide-react'
import { AssetBadge } from '@renderer/components/asset-badge'
import { Panel } from '@renderer/components/panel'
import { StateCard } from '@renderer/components/state-card'
import { StatusPill } from '@renderer/components/status-pill'
import { formatCurrency, formatPercent } from '@renderer/utils/format'
import type { AiOpportunityItem } from '@shared/types/ai-hub'

interface AiOpportunitiesPanelProps {
  items: AiOpportunityItem[]
  isLoading: boolean
  onSelectAsset: (assetId: string) => void
}

const iconByKind = {
  breakout: Radar,
  oversold: Waves,
  volume: Activity,
  pattern: CandlestickChart
} as const

export const AiOpportunitiesPanel = ({
  items,
  isLoading,
  onSelectAsset
}: AiOpportunitiesPanelProps) => (
  <Panel title="AI Analiz Fırsatları" subtitle="Kırılım, hacim ve formasyon radarları">
    {isLoading && !items.length ? (
      <StateCard
        title="AI fırsat taraması yapılıyor"
        description="Breakout, aşırı satım, hacim artışı ve formasyon sinyalleri toplanıyor."
      />
    ) : items.length ? (
      <div className="ai-opportunity-list">
        {items.map((item) => {
          const Icon = iconByKind[item.kind]

          return (
            <button
              key={item.id}
              type="button"
              className="ai-opportunity-card"
              onClick={() => onSelectAsset(item.assetId)}
            >
              <div className="ai-opportunity-card__header">
                <div className="ai-opportunity-card__asset">
                  <AssetBadge symbol={item.assetSymbol} assetClass={item.assetClass} size="sm" />
                  <div>
                    <strong>{item.title}</strong>
                    <p>
                      {item.assetName} ({item.assetSymbol})
                    </p>
                  </div>
                </div>
                <StatusPill label={`${item.confidence}%`} tone={item.tone} />
              </div>

              <div className="ai-opportunity-card__metrics">
                <span className="ai-opportunity-card__metric">
                  <Icon size={14} />
                  {item.metricLabel}: {item.metricValue}
                </span>
                <span>{formatCurrency(item.price, item.currency)}</span>
                <span className={item.changePercent >= 0 ? 'positive-text' : 'negative-text'}>
                  {formatPercent(item.changePercent)}
                </span>
              </div>

              <p>{item.summary}</p>
            </button>
          )
        })}
      </div>
    ) : (
      <StateCard
        title="AI fırsatı bulunamadı"
        description="Şu an güçlü bir breakout, RSI veya hacim sinyali öne çıkmıyor."
      />
    )}
  </Panel>
)
