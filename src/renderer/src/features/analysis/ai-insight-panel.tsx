import { Panel } from '@renderer/components/panel'
import { StatusPill } from '@renderer/components/status-pill'
import type { AiInsight } from '@renderer/services/ai-insight-engine'

interface AiInsightPanelProps {
  insight: AiInsight
}

export const AiInsightPanel = ({ insight }: AiInsightPanelProps) => (
  <Panel title="AI görüşü" subtitle={insight.horizon}>
    <div className="recommendation-strip">
      <StatusPill label={`${insight.title} • Güven %${insight.confidence}`} tone={insight.tone} />
      <p>{insight.summary}</p>
    </div>

    <div className="list-card">
      <strong>Neye bakıyor?</strong>
      <div className="insight-list">
        {insight.rationale.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </div>
    </div>

    <div className="list-card">
      <strong>Risk notları</strong>
      <div className="insight-list">
        {insight.risks.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </div>
    </div>

    <p className="disclaimer">{insight.disclaimer}</p>
  </Panel>
)
