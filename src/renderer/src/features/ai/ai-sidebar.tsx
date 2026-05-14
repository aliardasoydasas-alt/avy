import { Brain, Radar, Siren, Wallet } from 'lucide-react'
import { Panel } from '@renderer/components/panel'
import { StatusPill } from '@renderer/components/status-pill'
import type {
  AiMacroSummary,
  AiOpportunityItem,
  AiPortfolioReview,
  AiWatchlistItem
} from '@shared/types/ai-hub'

interface AiSidebarProps {
  watchlist: AiWatchlistItem[]
  opportunities: AiOpportunityItem[]
  portfolioReview: AiPortfolioReview
  macroSummary: AiMacroSummary
}

export const AiSidebar = ({
  watchlist,
  opportunities,
  portfolioReview,
  macroSummary
}: AiSidebarProps) => (
  <div className="ai-sidebar">
    <Panel title="AI Merkezi" subtitle="Hızlı özet">
      <div className="ai-sidebar-kpis">
        <div className="ai-kpi-card">
          <div className="mini-list__label">
            <Brain size={15} />
            <span>İzlenecek varlık</span>
          </div>
          <strong>{watchlist.length}</strong>
        </div>
        <div className="ai-kpi-card">
          <div className="mini-list__label">
            <Radar size={15} />
            <span>Analiz fırsatı</span>
          </div>
          <strong>{opportunities.length}</strong>
        </div>
        <div className="ai-kpi-card">
          <div className="mini-list__label">
            <Wallet size={15} />
            <span>Portföy tonu</span>
          </div>
          <StatusPill label={portfolioReview.title} tone={portfolioReview.tone} />
        </div>
        <div className="ai-kpi-card">
          <div className="mini-list__label">
            <Siren size={15} />
            <span>Makro</span>
          </div>
          <StatusPill label={macroSummary.title} tone={macroSummary.tone} />
        </div>
      </div>
    </Panel>

    {watchlist[0] ? (
      <Panel title="AI Odağı" subtitle={watchlist[0].assetSymbol}>
        <div className="list-card">
          <div className="list-card__header">
            <strong>{watchlist[0].assetName}</strong>
            <StatusPill label={watchlist[0].badge} tone={watchlist[0].tone} />
          </div>
          <p>{watchlist[0].summary}</p>
        </div>
      </Panel>
    ) : null}
  </div>
)
