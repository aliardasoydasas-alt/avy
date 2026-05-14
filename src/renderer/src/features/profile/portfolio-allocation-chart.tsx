import { useMemo, useState } from 'react'
import { PieChart } from 'lucide-react'
import type { PortfolioSummary } from '@renderer/services/portfolio-service'
import { formatCurrency, formatPercent } from '@renderer/utils/format'

interface PortfolioAllocationChartProps {
  summary: PortfolioSummary
}

interface AllocationSlice {
  id: string
  label: string
  symbol: string
  valueTry: number
  dailyChangePercent: number
  sharePercent: number
  color: string
}

const SLICE_COLORS = ['#f6c445', '#4ecdc4', '#4f8cff', '#ff7a7a', '#8a6cff', '#5fd19a', '#f38b44', '#8aa5ff']
const DONUT_SIZE = 188
const DONUT_STROKE = 24
const DONUT_RADIUS = DONUT_SIZE / 2 - DONUT_STROKE
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS

const getAvatar = (symbol: string): string => symbol.slice(0, 2).toUpperCase()

const buildSlices = (summary: PortfolioSummary): AllocationSlice[] => {
  if (!summary.totalValueTry) {
    return []
  }

  const primarySlices = summary.holdings.slice(0, 7).map((item, index) => ({
    id: item.holding.id,
    label: item.holding.assetName,
    symbol: item.holding.assetSymbol,
    valueTry: item.totalValueTry,
    dailyChangePercent: item.dailyChangePercent,
    sharePercent: (item.totalValueTry / summary.totalValueTry) * 100,
    color: SLICE_COLORS[index % SLICE_COLORS.length]
  }))

  const remainderValue = summary.holdings.slice(7).reduce((sum, item) => sum + item.totalValueTry, 0)
  const remainderDailyBase = summary.holdings
    .slice(7)
    .reduce((sum, item) => sum + item.dailyChangePercent * item.totalValueTry, 0)

  if (remainderValue <= 0) {
    return primarySlices
  }

  return [
    ...primarySlices,
    {
      id: 'other',
      label: 'Diğer varlıklar',
      symbol: 'DG',
      valueTry: remainderValue,
      dailyChangePercent: remainderValue ? remainderDailyBase / remainderValue : 0,
      sharePercent: (remainderValue / summary.totalValueTry) * 100,
      color: '#6d7489'
    }
  ]
}

export const PortfolioAllocationChart = ({ summary }: PortfolioAllocationChartProps) => {
  const slices = useMemo(() => buildSlices(summary), [summary])
  const [hoveredSliceId, setHoveredSliceId] = useState<string | null>(slices[0]?.id ?? null)
  const activeSlice = slices.find((slice) => slice.id === hoveredSliceId) ?? slices[0]

  if (!slices.length) {
    return (
      <div className="allocation-chart allocation-chart--empty">
        <PieChart size={20} />
        <span>Portföy dağılımı varlık ekledikçe oluşur.</span>
      </div>
    )
  }

  let progress = 0

  return (
    <div className="allocation-chart">
      <div className="allocation-chart__visual">
        <svg viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`} className="allocation-chart__svg" role="img">
          <circle
            cx={DONUT_SIZE / 2}
            cy={DONUT_SIZE / 2}
            r={DONUT_RADIUS}
            className="allocation-chart__track"
          />
          {slices.map((slice) => {
            const dashLength = (slice.sharePercent / 100) * DONUT_CIRCUMFERENCE
            const segment = (
              <circle
                key={slice.id}
                cx={DONUT_SIZE / 2}
                cy={DONUT_SIZE / 2}
                r={DONUT_RADIUS}
                className={`allocation-chart__slice${
                  activeSlice?.id === slice.id ? ' allocation-chart__slice--active' : ''
                }`}
                style={{
                  stroke: slice.color,
                  strokeDasharray: `${dashLength} ${DONUT_CIRCUMFERENCE - dashLength}`,
                  strokeDashoffset: -progress
                }}
                onMouseEnter={() => setHoveredSliceId(slice.id)}
              />
            )
            progress += dashLength
            return segment
          })}
        </svg>

        {activeSlice ? (
          <div className="allocation-chart__center">
            <div className="allocation-chart__avatar" style={{ borderColor: activeSlice.color }}>
              {getAvatar(activeSlice.symbol)}
            </div>
            <strong>{activeSlice.symbol}</strong>
            <span>{formatPercent(activeSlice.sharePercent)}</span>
          </div>
        ) : null}
      </div>

      <div className="allocation-chart__details">
        {activeSlice ? (
          <article className="allocation-chart__spotlight">
            <div className="mini-list__label">
              <div className="allocation-chart__avatar" style={{ borderColor: activeSlice.color }}>
                {getAvatar(activeSlice.symbol)}
              </div>
              <div>
                <strong>{activeSlice.label}</strong>
                <span>{activeSlice.symbol}</span>
              </div>
            </div>
            <div className="meta-row">
              <span>Portföy payı</span>
              <strong>{formatPercent(activeSlice.sharePercent)}</strong>
            </div>
            <div className="meta-row">
              <span>TL karşılığı</span>
              <strong>{formatCurrency(activeSlice.valueTry, 'TRY', 0)}</strong>
            </div>
            <div className="meta-row">
              <span>Günlük değişim</span>
              <strong className={activeSlice.dailyChangePercent >= 0 ? 'metric-positive' : 'metric-negative'}>
                {formatPercent(activeSlice.dailyChangePercent)}
              </strong>
            </div>
          </article>
        ) : null}

        <div className="allocation-chart__legend">
          {slices.map((slice) => (
            <button
              key={slice.id}
              type="button"
              className={`allocation-chart__legend-item${
                activeSlice?.id === slice.id ? ' allocation-chart__legend-item--active' : ''
              }`}
              onMouseEnter={() => setHoveredSliceId(slice.id)}
              onFocus={() => setHoveredSliceId(slice.id)}
            >
              <span className="allocation-chart__legend-dot" style={{ background: slice.color }} />
              <span>{slice.symbol}</span>
              <strong>{formatPercent(slice.sharePercent)}</strong>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
