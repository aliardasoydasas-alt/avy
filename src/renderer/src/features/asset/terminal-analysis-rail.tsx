import { memo, useState, type ReactNode } from 'react'
import {
  BellRing,
  ChevronDown,
  ChevronRight,
  Gauge,
  Newspaper,
  Siren,
  TrendingUp
} from 'lucide-react'
import { StatusPill } from '@renderer/components/status-pill'
import { formatCurrency, formatPercent, formatVolume } from '@renderer/utils/format'
import type { AlertRule } from '@shared/types/alerts'
import type { IndicatorSnapshot } from '@shared/types/analysis'
import type { AssetQuote, AssetSnapshot } from '@shared/types/market'
import type { AiInsight } from '@renderer/services/ai-insight-engine'
import type { AssetIntelligenceReport } from '@renderer/services/asset-intelligence-engine'

interface TerminalAnalysisRailProps {
  snapshot: AssetSnapshot
  liveQuote?: AssetQuote
  indicators: IndicatorSnapshot
  insight: AiInsight | null
  intelligence: AssetIntelligenceReport | null
  newsCount: number
  alerts: AlertRule[]
  onCreateResistanceAlert: () => void
  onCreateSupportAlert: () => void
  onCreateMomentumAlert: () => void
  onCreatePullbackAlert: () => void
}

interface RailSectionProps {
  title: string
  subtitle?: string
  defaultOpen?: boolean
  children: ReactNode
}

const RailSection = ({ title, subtitle, defaultOpen = true, children }: RailSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <section className={isOpen ? 'terminal-fold terminal-fold--open' : 'terminal-fold'}>
      <button
        type="button"
        className="terminal-fold__header"
        onClick={() => setIsOpen((value) => !value)}
      >
        <div>
          <strong>{title}</strong>
          {subtitle ? <span>{subtitle}</span> : null}
        </div>
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {isOpen ? <div className="terminal-fold__body">{children}</div> : null}
    </section>
  )
}

const getRecommendationLabel = (indicators: IndicatorSnapshot): string => {
  if (indicators.recommendation === 'buy') {
    return 'Al görünümü baskın'
  }

  if (indicators.recommendation === 'sell') {
    return 'Sat görünümü baskın'
  }

  return indicators.rsi >= 50 || indicators.macd.histogram >= 0
    ? 'Alış hafif daha baskın'
    : 'Satış hafif daha baskın'
}

const getRecommendationTone = (
  indicators: IndicatorSnapshot
): 'positive' | 'negative' | 'neutral' =>
  indicators.recommendation === 'sell'
    ? 'negative'
    : indicators.recommendation === 'buy'
      ? 'positive'
      : indicators.rsi >= 50 || indicators.macd.histogram >= 0
        ? 'positive'
        : 'negative'

const TerminalAnalysisRailComponent = ({
  snapshot,
  liveQuote,
  indicators,
  insight,
  intelligence,
  newsCount,
  alerts,
  onCreateResistanceAlert,
  onCreateSupportAlert,
  onCreateMomentumAlert,
  onCreatePullbackAlert
}: TerminalAnalysisRailProps) => {
  const recommendationLabel = getRecommendationLabel(indicators)
  const recommendationTone = getRecommendationTone(indicators)
  const quote = liveQuote ?? snapshot.quote

  return (
    <div className="terminal-analysis-stack">
      <RailSection title="Durum" subtitle={snapshot.profile.symbol}>
        <div className="terminal-mini-card terminal-mini-card--dense">
          <div className="list-card__header">
            <div>
              <strong>{snapshot.profile.symbol}</strong>
              <p>{snapshot.overview}</p>
            </div>
            <StatusPill label={recommendationLabel} tone={recommendationTone} />
          </div>
          <div className="terminal-mini-grid terminal-mini-grid--dense">
            <div className="terminal-mini-metric">
              <span>Son fiyat</span>
              <strong>{formatCurrency(quote.price, snapshot.profile.currency)}</strong>
            </div>
            <div className="terminal-mini-metric">
              <span>Gunluk degisim</span>
              <strong className={quote.changePercent >= 0 ? 'positive-text' : 'negative-text'}>
                {formatPercent(quote.changePercent)}
              </strong>
            </div>
            <div className="terminal-mini-metric">
              <span>Hacim</span>
              <strong>{formatVolume(quote.volume)}</strong>
            </div>
            <div className="terminal-mini-metric">
              <span>Volatilite</span>
              <strong>{formatPercent(snapshot.metrics.volatility)}</strong>
            </div>
          </div>
        </div>
      </RailSection>

      <RailSection title="AI Yorumu" subtitle={insight?.title ?? 'Kisa teknik okuma'} defaultOpen={Boolean(insight)}>
        {insight ? (
          <div className="terminal-mini-card terminal-mini-card--dense">
            <div className="list-card__header">
              <strong>Analiz netligi</strong>
              <StatusPill label={`%${Math.round(insight.confidence)} güven`} tone={insight.tone} />
            </div>
            <p>{insight.summary}</p>
            {insight.rationale[0] ? (
              <div className="terminal-insight-note">
                <BellRing size={14} />
                <span>{insight.rationale[0]}</span>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="terminal-fold__empty">Bu varlik icin AI yorumu su an hazir degil.</p>
        )}
      </RailSection>

      <RailSection title="Indikatorler" subtitle="Kisa teknik ozet">
        <div className="terminal-metric-list">
          <div className="terminal-metric-list__row">
            <div className="mini-list__label">
              <Gauge size={14} />
              <span>RSI</span>
            </div>
            <strong>{indicators.rsi.toFixed(1)}</strong>
          </div>
          <div className="terminal-metric-list__row">
            <div className="mini-list__label">
              <TrendingUp size={14} />
              <span>MACD histogram</span>
            </div>
            <strong>{indicators.macd.histogram.toFixed(3)}</strong>
          </div>
          <div className="terminal-metric-list__row">
            <span>Destek</span>
            <strong>{formatCurrency(indicators.support, snapshot.profile.currency)}</strong>
          </div>
          <div className="terminal-metric-list__row">
            <span>Direnc</span>
            <strong>{formatCurrency(indicators.resistance, snapshot.profile.currency)}</strong>
          </div>
        </div>
      </RailSection>

      <RailSection title="Haber Etkisi" subtitle={`${newsCount} haber`}>
        {intelligence ? (
          <div className="terminal-mini-card terminal-mini-card--dense">
            <div className="list-card__header">
              <div className="mini-list__label">
                <Newspaper size={14} />
                <strong>{newsCount} haber</strong>
              </div>
              <StatusPill
                label={
                  intelligence.newsImpact.tone === 'positive'
                    ? 'Pozitif etki'
                    : intelligence.newsImpact.tone === 'negative'
                      ? 'Negatif etki'
                      : 'Sinirli etki'
                }
                tone={intelligence.newsImpact.tone}
              />
            </div>
            <p>{intelligence.newsImpact.summary}</p>
          </div>
        ) : (
          <p className="terminal-fold__empty">Haber etkisi ozetlenemedi.</p>
        )}
      </RailSection>

      <RailSection title="Alarm Kisayollari" subtitle={`${alerts.length} aktif alarm`} defaultOpen={false}>
        <div className="terminal-action-grid terminal-action-grid--dense">
          <button type="button" className="chip chip--active chip--compact" onClick={onCreateResistanceAlert}>
            Direnc asilirsa
          </button>
          <button type="button" className="chip chip--active chip--compact" onClick={onCreateSupportAlert}>
            Destek kirilirsa
          </button>
          <button type="button" className="chip chip--active chip--compact" onClick={onCreateMomentumAlert}>
            %3 yukselis
          </button>
          <button type="button" className="chip chip--active chip--compact" onClick={onCreatePullbackAlert}>
            %3 dusus
          </button>
        </div>
      </RailSection>

      <RailSection title="Hacim ve Momentum" subtitle="Radar">
        {intelligence ? (
          <>
            <div className="terminal-metric-list">
              {intelligence.radar.slice(0, 5).map((item) => (
                <div key={item.label} className="terminal-metric-list__row">
                  <span>{item.label}</span>
                  <strong
                    className={
                      item.tone === 'positive'
                        ? 'positive-text'
                        : item.tone === 'negative'
                          ? 'negative-text'
                          : ''
                    }
                  >
                    {item.value}
                  </strong>
                </div>
              ))}
            </div>
            {intelligence.whyMoving[0] ? (
              <div className="terminal-insight-note">
                <Siren size={14} />
                <span>{intelligence.whyMoving[0]}</span>
              </div>
            ) : null}
          </>
        ) : (
          <p className="terminal-fold__empty">Hacim ve momentum ozeti su an hazir degil.</p>
        )}
      </RailSection>
    </div>
  )
}

export const TerminalAnalysisRail = memo(TerminalAnalysisRailComponent)
