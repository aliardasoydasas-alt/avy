import type { PatternSignal, PatternType } from '@shared/types/patterns'
import { Panel } from '@renderer/components/panel'
import { StateCard } from '@renderer/components/state-card'
import { StatusPill } from '@renderer/components/status-pill'
import { PATTERN_LABELS } from '@renderer/utils/constants'
import { formatEditableNumber } from '@renderer/utils/format'

interface PatternPanelProps {
  patterns: PatternSignal[]
  settings: Record<PatternType, boolean>
  onToggleSetting: (pattern: PatternType, enabled: boolean) => void
}

export const PatternPanel = ({
  patterns,
  settings,
  onToggleSetting
}: PatternPanelProps) => (
  <Panel title="Formasyon tarayıcı" subtitle="Sadece seçtiğin formasyonlar taranır ve işaretlenir">
    <p className="disclaimer">
      Bir formasyonu burada açmadıkça AVY o yapıyı ne tarar ne de grafikte işaretler. Bildirimler de
      yalnızca seçtiklerin için çalışır.
    </p>
    <div className="toggle-grid">
      {(Object.keys(settings) as PatternType[]).map((pattern) => (
        <label key={pattern} className="toggle-card">
          <input
            type="checkbox"
            checked={settings[pattern]}
            onChange={(event) => onToggleSetting(pattern, event.target.checked)}
          />
          <span>{PATTERN_LABELS[pattern]}</span>
        </label>
      ))}
    </div>

    {patterns.length ? (
      <div className="pattern-list">
        {patterns.map((pattern) => (
          <article key={pattern.id} className="list-card">
            <div className="list-card__header">
              <strong>{pattern.label}</strong>
              <StatusPill
                label={`Güven %${Math.round(pattern.confidence * 100)}`}
                tone={pattern.direction === 'bearish' ? 'negative' : 'positive'}
              />
            </div>
            <p>{pattern.description}</p>
            <div className="meta-row">
              <span>Durum: {pattern.status === 'confirmed' ? 'Doğrulandı' : 'Oluşuyor'}</span>
              {pattern.breakoutLevel ? (
                <span>Kırılım seviyesi: {formatEditableNumber(pattern.breakoutLevel)}</span>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    ) : (
      <StateCard
        title="Aktif formasyon yok"
        description="Önce yukarıdan izlemek istediğin formasyonları aç. Yalnızca seçtiklerin taranır ve grafikte işaretlenir."
      />
    )}
  </Panel>
)
