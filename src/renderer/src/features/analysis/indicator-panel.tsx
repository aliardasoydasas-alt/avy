import type { IndicatorSnapshot, IndicatorToggleState } from '@shared/types/analysis'
import type { AssetSnapshot } from '@shared/types/market'
import { Panel } from '@renderer/components/panel'
import { StatusPill } from '@renderer/components/status-pill'
import { formatCurrency } from '@renderer/utils/format'

interface IndicatorPanelProps {
  snapshot: AssetSnapshot
  indicators: IndicatorSnapshot
  toggles: IndicatorToggleState
  onToggle: (key: keyof IndicatorToggleState, enabled: boolean) => void
}

const recommendationTone = {
  buy: 'positive',
  sell: 'negative',
  neutral: 'neutral'
} as const

const recommendationLabels = {
  buy: 'AL',
  sell: 'SAT',
  neutral: 'NOTR'
} as const

const toggleLabels: Record<keyof IndicatorToggleState, string> = {
  rsi: 'RSI',
  macd: 'MACD',
  movingAverages: 'EMA / SMA',
  bollinger: 'Bollinger',
  volume: 'Hacim analizi',
  supportResistance: 'Destek / Direnc'
}

const volumeTrendLabels = {
  rising: 'Yukselen',
  falling: 'Dusen',
  balanced: 'Dengeli'
} as const

const trendLabels = {
  bullish: 'Yukselis',
  bearish: 'Dusus',
  sideways: 'Yatay'
} as const

export const IndicatorPanel = ({
  snapshot,
  indicators,
  toggles,
  onToggle
}: IndicatorPanelProps) => (
  <Panel title="Teknik gorunum" subtitle="Indikator ozeti">
    <div className="recommendation-strip">
      <StatusPill
        label={recommendationLabels[indicators.recommendation]}
        tone={recommendationTone[indicators.recommendation]}
      />
      <p>{indicators.summary}</p>
    </div>

    <div className="toggle-grid">
      {(Object.keys(toggles) as Array<keyof IndicatorToggleState>).map((key) => (
        <label key={key} className="toggle-card">
          <input
            type="checkbox"
            checked={toggles[key]}
            onChange={(event) => onToggle(key, event.target.checked)}
          />
          <span>{toggleLabels[key]}</span>
        </label>
      ))}
    </div>

    <div className="indicator-grid">
      {toggles.rsi ? (
        <div className="metric-card">
          <span>RSI</span>
          <strong>{indicators.rsi.toFixed(1)}</strong>
        </div>
      ) : null}
      {toggles.macd ? (
        <div className="metric-card">
          <span>MACD hist</span>
          <strong>{indicators.macd.histogram.toFixed(3)}</strong>
        </div>
      ) : null}
      {toggles.movingAverages ? (
        <>
          <div className="metric-card">
            <span>EMA 20</span>
            <strong>{formatCurrency(indicators.ema20, snapshot.profile.currency)}</strong>
          </div>
          <div className="metric-card">
            <span>SMA 50</span>
            <strong>{formatCurrency(indicators.sma50, snapshot.profile.currency)}</strong>
          </div>
        </>
      ) : null}
      {toggles.bollinger ? (
        <div className="metric-card">
          <span>Bollinger</span>
          <strong>
            {formatCurrency(indicators.bollinger.lower, snapshot.profile.currency)} /{' '}
            {formatCurrency(indicators.bollinger.upper, snapshot.profile.currency)}
          </strong>
        </div>
      ) : null}
      {toggles.volume ? (
        <div className="metric-card">
          <span>Hacim egilimi</span>
          <strong>{volumeTrendLabels[indicators.volumeTrend]}</strong>
        </div>
      ) : null}
      {toggles.supportResistance ? (
        <div className="metric-card">
          <span>Destek / direnc</span>
          <strong>
            {formatCurrency(indicators.support, snapshot.profile.currency)} /{' '}
            {formatCurrency(indicators.resistance, snapshot.profile.currency)}
          </strong>
        </div>
      ) : null}
      <div className="metric-card">
        <span>Trend ozeti</span>
        <strong>{trendLabels[indicators.trend]}</strong>
      </div>
    </div>

    <p className="disclaimer">
      Bu panel sadece teknik durumu ozetler; kesin yatirim tavsiyesi olarak yorumlanmamali.
    </p>
  </Panel>
)
