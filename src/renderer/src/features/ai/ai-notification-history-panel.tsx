import { BellRing } from 'lucide-react'
import { Panel } from '@renderer/components/panel'
import { StateCard } from '@renderer/components/state-card'
import { StatusPill } from '@renderer/components/status-pill'
import { formatDateTime } from '@renderer/utils/format'
import type { AiNotificationHistoryItem } from '@shared/types/ai-hub'

interface AiNotificationHistoryPanelProps {
  history: AiNotificationHistoryItem[]
}

const labelByKind = {
  breakout: 'Direnç testi',
  oversold: 'Aşırı satım',
  volume: 'Hacim artışı',
  pattern: 'Formasyon',
  macd: 'MACD',
  portfolio: 'Portföy',
  macro: 'Makro'
} as const

export const AiNotificationHistoryPanel = ({
  history
}: AiNotificationHistoryPanelProps) => (
  <Panel title="AI Bildirim Geçmişi" subtitle="AI tarafından üretilen son uyarılar">
    {history.length ? (
      <div className="ai-history-list">
        {history.slice(0, 12).map((item) => (
          <article key={item.id} className="ai-history-card">
            <div className="ai-history-card__header">
              <div className="mini-list__label">
                <BellRing size={15} />
                <strong>{item.title}</strong>
              </div>
              <StatusPill label={labelByKind[item.kind]} tone={item.tone} />
            </div>
            <p>{item.message}</p>
            <div className="meta-row">
              <span>{item.assetSymbol ?? 'Genel AI'}</span>
              <span>{formatDateTime(item.createdAt)}</span>
            </div>
          </article>
        ))}
      </div>
    ) : (
      <StateCard
        title="AI geçmişi boş"
        description="AI sinyal geçmişi burada birikmeye başlayacak."
      />
    )}
  </Panel>
)
