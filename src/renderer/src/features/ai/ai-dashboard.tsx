import { AiMacroPanel } from '@renderer/features/ai/ai-macro-panel'
import { AiNotificationHistoryPanel } from '@renderer/features/ai/ai-notification-history-panel'
import { AiOpportunitiesPanel } from '@renderer/features/ai/ai-opportunities-panel'
import { AiPortfolioPanel } from '@renderer/features/ai/ai-portfolio-panel'
import { AiWatchlistPanel } from '@renderer/features/ai/ai-watchlist-panel'
import type { PortfolioSummary } from '@renderer/services/portfolio-service'
import type {
  AiMacroSummary,
  AiNotificationHistoryItem,
  AiOpportunityItem,
  AiPortfolioReview,
  AiWatchlistItem
} from '@shared/types/ai-hub'

interface AiDashboardProps {
  watchlist: AiWatchlistItem[]
  opportunities: AiOpportunityItem[]
  portfolioReview: AiPortfolioReview
  portfolioSummary: PortfolioSummary
  macroSummary: AiMacroSummary
  history: AiNotificationHistoryItem[]
  isLoading: boolean
  hasError: boolean
  onSelectAsset: (assetId: string) => void
}

export const AiDashboard = ({
  watchlist,
  opportunities,
  portfolioReview,
  portfolioSummary,
  macroSummary,
  history,
  isLoading,
  hasError,
  onSelectAsset
}: AiDashboardProps) => (
  <div className="ai-dashboard">
    <div className="ai-dashboard-grid">
      <AiWatchlistPanel items={watchlist} isLoading={isLoading} onSelectAsset={onSelectAsset} />
      <AiOpportunitiesPanel items={opportunities} isLoading={isLoading} onSelectAsset={onSelectAsset} />
    </div>

    <div className="ai-dashboard-grid ai-dashboard-grid--balanced">
      <AiPortfolioPanel review={portfolioReview} portfolioSummary={portfolioSummary} />
      <AiMacroPanel summary={macroSummary} />
    </div>

    <AiNotificationHistoryPanel history={history} />

    {hasError && !watchlist.length && !opportunities.length ? (
      <div className="list-card">
        <strong>AI veri katmanında gecikme yaşanıyor</strong>
        <p>Detay verilerinden bir kısmı alınamadı. Birkaç saniye sonra panel kendini yenileyecek.</p>
      </div>
    ) : null}
  </div>
)
