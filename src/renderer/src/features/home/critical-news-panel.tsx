import { ArrowUpRight, BrainCircuit, Globe2 } from 'lucide-react'
import { Panel } from '@renderer/components/panel'
import { StateCard } from '@renderer/components/state-card'
import { StatusPill } from '@renderer/components/status-pill'
import { openExternalLink } from '@renderer/services/notification-service'
import { formatDateTime } from '@renderer/utils/format'
import type { HomeNewsItem } from '@shared/types/home'

interface CriticalNewsPanelProps {
  news: HomeNewsItem[]
  isLoading: boolean
  hasError: boolean
}

const getToneLabel = (tone: HomeNewsItem['insight']['tone']): string =>
  tone === 'positive' ? 'Olumlu etki' : tone === 'negative' ? 'Negatif risk' : 'Dengeli etki'

export const CriticalNewsPanel = ({
  news,
  isLoading,
  hasError
}: CriticalNewsPanelProps) => (
  <Panel title="Dunya gundemi" subtitle="Kritik haberler" className="critical-news-panel">
    {hasError ? (
      <StateCard
        title="Kritik haberler yuklenemedi"
        description="Global haber akisi su an alinmiyor. Ag veya kaynak yaniti duzeldiginde panel otomatik yenilenir."
      />
    ) : isLoading && !news.length ? (
      <StateCard
        title="Kritik haberler hazirlaniyor"
        description="Merkez bankalari, jeopolitik gelismeler ve global piyasa akisina ait basliklar toplaniyor."
      />
    ) : news.length ? (
      <div className="critical-news-list">
        {news.map((item) => (
          <article key={item.id} className="critical-news-card">
            <div className="critical-news-card__content">
              <div className="meta-row">
                <div className="mini-list__label">
                  <Globe2 size={14} />
                  <span>{item.source}</span>
                </div>
                <span>{formatDateTime(item.publishedAt)}</span>
              </div>

              <h3>{item.title}</h3>
              <p>{item.summary}</p>

              {item.url ? (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    void openExternalLink(item.url)
                  }}
                >
                  <ArrowUpRight size={16} />
                  Haberi ac
                </button>
              ) : null}
            </div>

            <aside className="critical-news-card__impact">
              <div className="critical-news-card__impact-header">
                <div className="mini-list__label">
                  <BrainCircuit size={14} />
                  <strong>AI yorumu</strong>
                </div>
                <StatusPill label={getToneLabel(item.insight.tone)} tone={item.insight.tone} />
              </div>

              <p>{item.insight.summary}</p>
              <p>
                <span className="positive-text">Olumlu senaryo:</span> {item.insight.positiveCase}
              </p>
              <p>
                <span className="negative-text">Risk senaryosu:</span> {item.insight.negativeCase}
              </p>
            </aside>
          </article>
        ))}
      </div>
    ) : (
      <StateCard
        title="Haber akisi bos"
        description="Piyasayi etkileyebilecek kritik baslik bulunamadiginda bu panel sade kalir."
      />
    )}
  </Panel>
)
