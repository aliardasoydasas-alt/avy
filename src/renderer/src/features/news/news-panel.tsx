import { ExternalLink } from 'lucide-react'
import type { NewsItem } from '@shared/types/news'
import { Panel } from '@renderer/components/panel'
import { StateCard } from '@renderer/components/state-card'
import { StatusPill } from '@renderer/components/status-pill'
import { openExternalLink } from '@renderer/services/notification-service'
import { formatDateTime, formatRelativeTime } from '@renderer/utils/format'

interface NewsPanelProps {
  news: NewsItem[]
  isLoading: boolean
  hasError: boolean
}

const importanceTone = {
  high: 'negative',
  medium: 'info',
  low: 'neutral'
} as const

const importanceLabels = {
  high: 'Yüksek',
  medium: 'Orta',
  low: 'Düşük'
} as const

const insightTone = {
  positive: 'positive',
  negative: 'negative',
  neutral: 'neutral'
} as const

export const NewsPanel = ({ news, isLoading, hasError }: NewsPanelProps) => (
  <Panel title="Haber akışı" subtitle="Başlıklar ve etkileyen gelişmeler">
    {isLoading ? (
      <StateCard title="Haberler yükleniyor" description="Seçili varlığa ait ilgili haberler getiriliyor." />
    ) : hasError ? (
      <StateCard title="Haberler şu an alınamadı" description="Aktif veri kaynağı ilgili haberleri şu an getiremedi." />
    ) : news.length ? (
      <div className="list-stack">
        {news.map((item) => {
          const commentary = item.aiCommentary ?? {
            tone: 'neutral' as const,
            summary: 'Bu haber için AI yorumu hazırlanıyor.',
            impact: 'Etki değerlendirmesi yeni veri geldikçe güncellenecek.'
          }

          return (
            <article key={item.id} className="list-card">
              <div className="list-card__header">
                <strong>{item.title}</strong>
                <StatusPill label={importanceLabels[item.importance]} tone={importanceTone[item.importance]} />
              </div>
              <p>{item.summary}</p>
              <p>{item.details}</p>
              <div className="list-card__header">
                <strong>AI yorumu</strong>
                <StatusPill
                  label={
                    commentary.tone === 'positive'
                      ? 'Olumlu etki'
                      : commentary.tone === 'negative'
                        ? 'Negatif risk'
                        : 'Dengeli'
                  }
                  tone={insightTone[commentary.tone]}
                />
              </div>
              <p>{commentary.summary}</p>
              <p>{commentary.impact}</p>
              <div className="meta-row">
                <span>
                  {item.source} | {formatDateTime(item.publishedAt)} | {formatRelativeTime(item.publishedAt)}
                </span>
                {item.url ? (
                  <button type="button" className="text-button" onClick={() => void openExternalLink(item.url)}>
                    Aç <ExternalLink size={14} />
                  </button>
                ) : null}
              </div>
            </article>
          )
        })}
      </div>
    ) : (
      <StateCard title="İlgili haber yok" description="Veri kaynağı ilgili haber döndürdüğünde burada listelenecek." />
    )}
  </Panel>
)
