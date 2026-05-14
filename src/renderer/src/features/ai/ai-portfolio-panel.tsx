import { BriefcaseBusiness, ShieldAlert, Sparkles } from 'lucide-react'
import { Panel } from '@renderer/components/panel'
import { StateCard } from '@renderer/components/state-card'
import { StatusPill } from '@renderer/components/status-pill'
import { PortfolioAllocationChart } from '@renderer/features/profile/portfolio-allocation-chart'
import type { PortfolioSummary } from '@renderer/services/portfolio-service'
import { formatCurrency, formatPercent } from '@renderer/utils/format'
import type { AiPortfolioReview } from '@shared/types/ai-hub'

interface AiPortfolioPanelProps {
  review: AiPortfolioReview
  portfolioSummary: PortfolioSummary
}

export const AiPortfolioPanel = ({ review, portfolioSummary }: AiPortfolioPanelProps) => (
  <Panel title="AI Portföy Yorumu" subtitle="Portföyün için görsel ve detaylı analiz">
    {!review.holdingCount ? (
      <StateCard title={review.title} description={review.summary} />
    ) : (
      <div className="ai-portfolio-card">
        <div className="ai-portfolio-card__header">
          <div>
            <div className="mini-list__label">
              <BriefcaseBusiness size={16} />
              <strong>{review.title}</strong>
            </div>
            <p>{review.summary}</p>
          </div>
          <StatusPill label={`${review.holdingCount} pozisyon`} tone={review.tone} />
        </div>

        <div className="ai-portfolio-card__hero">
          <PortfolioAllocationChart summary={portfolioSummary} />

          <div className="ai-portfolio-card__stats">
            <div className="metric-card">
              <span>Toplam değer</span>
              <strong>{formatCurrency(review.totalValueTry, 'TRY')}</strong>
            </div>
            <div className="metric-card">
              <span>Günlük değişim</span>
              <strong className={review.dailyChangePercent >= 0 ? 'positive-text' : 'negative-text'}>
                {formatPercent(review.dailyChangePercent)}
              </strong>
            </div>
            <div className="metric-card">
              <span>Toplam P/L</span>
              <strong
                className={
                  review.totalProfitLossPercent === undefined
                    ? ''
                    : review.totalProfitLossPercent >= 0
                      ? 'positive-text'
                      : 'negative-text'
                }
              >
                {review.totalProfitLossPercent === undefined
                  ? 'Maliyet bekleniyor'
                  : formatPercent(review.totalProfitLossPercent)}
              </strong>
            </div>
          </div>
        </div>

        <div className="ai-two-column-list">
          <div className="list-card">
            <div className="mini-list__label">
              <Sparkles size={16} />
              <strong>Öne çıkanlar</strong>
            </div>
            <ul className="ai-bullet-list">
              {review.detail.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="list-card">
            <div className="mini-list__label">
              <ShieldAlert size={16} />
              <strong>Dikkat edilmesi gerekenler</strong>
            </div>
            <ul className="ai-bullet-list">
              {review.risks.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    )}
  </Panel>
)
