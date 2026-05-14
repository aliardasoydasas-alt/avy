import { Panel } from '@renderer/components/panel'
import { StateCard } from '@renderer/components/state-card'
import { StatusPill } from '@renderer/components/status-pill'
import type { AssetIntelligenceReport } from '@renderer/services/asset-intelligence-engine'
import { formatCompactNumber, formatPercent } from '@renderer/utils/format'

interface AssetIntelligencePanelProps {
  report: AssetIntelligenceReport | null
  onSelectAsset: (assetId: string) => void
}

const toneToLabel = {
  positive: 'Olumlu',
  negative: 'Temkinli',
  neutral: 'Dengeli'
} as const

export const AssetIntelligencePanel = ({
  report,
  onSelectAsset
}: AssetIntelligencePanelProps) => {
  if (!report) {
    return (
      <Panel title="AI varlık özeti" subtitle="Anlık teknik ve haber görünümü">
        <StateCard
          title="AI görünümü hazırlanıyor"
          description="Varlığın teknik, haber ve momentum verileri birleştiriliyor."
        />
      </Panel>
    )
  }

  return (
    <Panel title="AI varlık özeti" subtitle="Grafiğin yanında gerçekten işe yarayan bağlam">
      <div className="list-stack">
        <section className="list-card">
          <div className="list-card__header">
            <strong>Ne oluyor?</strong>
            <StatusPill label={report.confidence.label} tone="info" />
          </div>
          <ul className="detail-list">
            {report.whatsHappening.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="home-quick-grid">
          <article className="list-card">
            <div className="list-card__header">
              <strong>Dikkat edilecek seviyeler</strong>
            </div>
            <div className="detail-grid">
              <div>
                <span>Yakın destek</span>
                <strong>{report.levels.support}</strong>
              </div>
              <div>
                <span>Yakın direnç</span>
                <strong>{report.levels.resistance}</strong>
              </div>
              <div>
                <span>Kırılım seviyesi</span>
                <strong>{report.levels.breakout}</strong>
              </div>
              <div>
                <span>Risk bölgesi</span>
                <strong>{report.levels.riskZone}</strong>
              </div>
            </div>
            <p className="hero-card__helper">Takip bölgesi: {report.levels.followZone}</p>
          </article>

          <article className="list-card">
            <div className="list-card__header">
              <strong>Haber etkisi</strong>
              <StatusPill label={toneToLabel[report.newsImpact.tone]} tone={report.newsImpact.tone} />
            </div>
            <p>{report.newsImpact.summary}</p>
            <strong>{report.newsImpact.score}/100</strong>
          </article>
        </section>

        <section className="list-card">
          <div className="list-card__header">
            <strong>Senaryo analizi</strong>
          </div>
          <div className="home-quick-grid">
            {report.scenarios.map((scenario) => (
              <article key={scenario.title} className="mini-list__row">
                <div className="mini-list__label">
                  <strong>{scenario.title}</strong>
                  <p>{scenario.condition}</p>
                  <p>{scenario.watchLevel}</p>
                  <p>{scenario.risk}</p>
                </div>
                <StatusPill label={toneToLabel[scenario.tone]} tone={scenario.tone} />
              </article>
            ))}
          </div>
        </section>

        <section className="list-card">
          <div className="list-card__header">
            <strong>Hacim ve momentum radarı</strong>
          </div>
          <div className="detail-grid">
            {report.radar.map((item) => (
              <div key={item.label} className="metric-card">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <StatusPill label={toneToLabel[item.tone as keyof typeof toneToLabel] ?? 'Bilgi'} tone={item.tone} />
              </div>
            ))}
          </div>
        </section>

        <section className="home-quick-grid">
          <article className="list-card">
            <div className="list-card__header">
              <strong>Neden hareket ediyor?</strong>
            </div>
            <ul className="detail-list">
              {report.whyMoving.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>

          <article className="list-card">
            <div className="list-card__header">
              <strong>Akıllı takip notları</strong>
            </div>
            <ul className="detail-list">
              {report.followNotes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="hero-card__helper">{report.socialInterest.summary}</p>
          </article>
        </section>

        <section className="list-card">
          <div className="list-card__header">
            <strong>Benzer varlık karşılaştırması</strong>
          </div>
          {report.similarAssets.length ? (
            <div className="mini-list">
              {report.similarAssets.map((item) => (
                <button
                  key={item.assetId}
                  type="button"
                  className="mini-list__row mini-list__row--button"
                  onClick={() => onSelectAsset(item.assetId)}
                >
                  <div className="mini-list__label">
                    <strong>
                      {item.symbol} <span>{item.name}</span>
                    </strong>
                    <p>
                      Gün içi {formatPercent(item.changePercent)} | Hacim {formatCompactNumber(item.volume)} | Volatilite{' '}
                      {formatPercent(item.volatility)}
                    </p>
                  </div>
                  <StatusPill
                    label={item.momentumLabel}
                    tone={
                      item.changePercent >= 2.5
                        ? 'positive'
                        : item.changePercent <= -2.5
                          ? 'negative'
                          : 'neutral'
                    }
                  />
                </button>
              ))}
            </div>
          ) : (
            <StateCard
              title="Benzer karşılaştırma hazır değil"
              description="Aynı sınıfta kıyaslanabilecek yeterli veri henüz gelmedi."
            />
          )}
        </section>
      </div>
    </Panel>
  )
}
