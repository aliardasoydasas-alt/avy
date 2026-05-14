import { Globe2 } from 'lucide-react'
import { Panel } from '@renderer/components/panel'
import { StateCard } from '@renderer/components/state-card'
import { StatusPill } from '@renderer/components/status-pill'
import type { AiMacroSummary } from '@shared/types/ai-hub'

interface AiMacroPanelProps {
  summary: AiMacroSummary
}

export const AiMacroPanel = ({ summary }: AiMacroPanelProps) => (
  <Panel title="AI Makro Piyasa Özeti" subtitle="Makro verilerin kısa yorumu">
    {!summary.items.length ? (
      <StateCard title={summary.title} description={summary.summary} />
    ) : (
      <div className="ai-macro-stack">
        <div className="list-card">
          <div className="mini-list__label">
            <Globe2 size={16} />
            <strong>{summary.title}</strong>
          </div>
          <p>{summary.summary}</p>
        </div>

        <div className="ai-macro-grid">
          {summary.items.map((item) => (
            <article key={item.id} className="ai-macro-card">
              <div className="ai-macro-card__header">
                <div>
                  <span className="eyebrow">{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
                <StatusPill label={item.change} tone={item.tone} />
              </div>
              <p>{item.summary}</p>
              <div className="meta-row">
                <span>{item.source}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    )}
  </Panel>
)
