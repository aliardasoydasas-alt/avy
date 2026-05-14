import { useEffect, useMemo, useState } from 'react'
import { BarChart3, BriefcaseBusiness, CalendarClock, Search, ShieldCheck } from 'lucide-react'
import { Panel } from '@renderer/components/panel'
import { StateCard } from '@renderer/components/state-card'
import {
  buildInvestorCoverageNote,
  buildInvestorPerformanceSummary,
  formatHoldingCost,
  getInvestorById,
  getInvestors
} from '@renderer/services/investor-service'
import { formatCurrency, formatDateTime, formatPercent } from '@renderer/utils/format'
import type { InvestorHolding, InvestorProfile, InvestorStyle } from '@shared/types/investors'
import type { MarketOverviewItem } from '@shared/types/market'

interface InvestorsDashboardProps {
  overviewLookup: Map<string, MarketOverviewItem>
  onSelectAsset: (assetId: string) => void
}

const styleLabels: Record<InvestorStyle | 'all', string> = {
  all: 'Tümü',
  value: 'Değer',
  growth: 'Büyüme',
  technology: 'Teknoloji',
  'hedge-fund': 'Hedge fund',
  'long-term': 'Uzun vade'
}

const palette = ['#f6c445', '#57c6ff', '#6ee7b7', '#f97316', '#a78bfa', '#fb7185']

const initialsFromName = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase())
    .join('')

const InvestorAvatar = ({ investor, compact = false }: { investor: InvestorProfile; compact?: boolean }) => {
  const [hasImageError, setHasImageError] = useState(false)

  useEffect(() => {
    setHasImageError(false)
  }, [investor.photoUrl])

  return (
    <div className={compact ? 'investor-card__avatar investor-card__avatar--compact' : 'investor-card__avatar'}>
      {investor.photoUrl && !hasImageError ? (
        <img src={investor.photoUrl} alt={investor.name} onError={() => setHasImageError(true)} />
      ) : (
        <strong>{initialsFromName(investor.name)}</strong>
      )}
    </div>
  )
}

const InvestorAllocationChart = ({
  holdings,
  coverageNote
}: {
  holdings: InvestorHolding[]
  coverageNote: string
}) => {
  const weightedHoldings = holdings.filter((holding) => typeof holding.weightPercent === 'number')
  const totalWeight = weightedHoldings.reduce((sum, holding) => sum + (holding.weightPercent ?? 0), 0)
  const [activeHoldingId, setActiveHoldingId] = useState(weightedHoldings[0]?.id ?? '')
  const activeHolding = weightedHoldings.find((holding) => holding.id === activeHoldingId) ?? weightedHoldings[0]
  const activeIndex = weightedHoldings.findIndex((holding) => holding.id === activeHolding?.id)

  if (!weightedHoldings.length || totalWeight <= 0) {
    return <StateCard title="Dağılım verisi yok" description={coverageNote} />
  }

  let currentOffset = 0

  return (
    <div className="investor-allocation">
      <div className="allocation-chart__visual">
        <svg viewBox="0 0 188 188" className="allocation-chart__svg" aria-hidden="true">
          <circle cx="94" cy="94" r="62" className="allocation-chart__track" />
          {weightedHoldings.map((holding, index) => {
            const share = (holding.weightPercent ?? 0) / totalWeight
            const circumference = 2 * Math.PI * 62
            const dash = circumference * share
            const offset = circumference * (1 - currentOffset)
            currentOffset += share

            return (
              <circle
                key={holding.id}
                cx="94"
                cy="94"
                r="62"
                className={
                  holding.id === activeHolding?.id
                    ? 'allocation-chart__slice allocation-chart__slice--active'
                    : 'allocation-chart__slice'
                }
                stroke={palette[index % palette.length]}
                strokeDasharray={`${dash} ${circumference}`}
                strokeDashoffset={offset}
                onMouseEnter={() => setActiveHoldingId(holding.id)}
              />
            )
          })}
        </svg>
        <div className="allocation-chart__center">
          <div className="allocation-chart__avatar">{activeHolding?.symbol.slice(0, 2) ?? '??'}</div>
          <strong>{activeHolding?.symbol ?? 'VERİ YOK'}</strong>
          <span>{activeHolding?.weightPercent ? `%${activeHolding.weightPercent.toFixed(1)}` : coverageNote}</span>
        </div>
      </div>

      <div className="allocation-chart__details">
        <div className="allocation-chart__spotlight">
          <div className="mini-list__label">
            <span
              className="allocation-chart__legend-dot"
              style={{ background: palette[(activeIndex >= 0 ? activeIndex : 0) % palette.length] }}
            />
            <div>
              <strong>{activeHolding?.name ?? 'Dağılım görünmüyor'}</strong>
              <span>{activeHolding?.symbol ?? 'Veri yok'}</span>
            </div>
          </div>
          <div className="meta-row">
            <span>Portföy payı</span>
            <strong>{activeHolding?.weightPercent ? `%${activeHolding.weightPercent.toFixed(1)}` : 'Veri yok'}</strong>
          </div>
          <p className="hero-card__helper">{coverageNote}</p>
        </div>

        <div className="allocation-chart__legend">
          {weightedHoldings.map((holding, index) => (
            <button
              key={holding.id}
              type="button"
              className={
                holding.id === activeHolding?.id
                  ? 'allocation-chart__legend-item allocation-chart__legend-item--active'
                  : 'allocation-chart__legend-item'
              }
              onMouseEnter={() => setActiveHoldingId(holding.id)}
              onFocus={() => setActiveHoldingId(holding.id)}
            >
              <span className="allocation-chart__legend-dot" style={{ background: palette[index % palette.length] }} />
              <span>{holding.symbol}</span>
              <strong>%{(holding.weightPercent ?? 0).toFixed(1)}</strong>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export const InvestorsDashboard = ({ overviewLookup, onSelectAsset }: InvestorsDashboardProps) => {
  const investors = useMemo(() => getInvestors(), [])
  const [searchTerm, setSearchTerm] = useState('')
  const [styleFilter, setStyleFilter] = useState<InvestorStyle | 'all'>('all')
  const [selectedInvestorId, setSelectedInvestorId] = useState(investors[0]?.id ?? '')

  const filteredInvestors = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase()

    return investors.filter((investor) => {
      const matchesStyle = styleFilter === 'all' || investor.investmentStyle === styleFilter
      const matchesSearch =
        !normalized ||
        investor.name.toLowerCase().includes(normalized) ||
        investor.firm.toLowerCase().includes(normalized) ||
        investor.shortDescription.toLowerCase().includes(normalized)

      return matchesStyle && matchesSearch
    })
  }, [investors, searchTerm, styleFilter])

  useEffect(() => {
    if (!filteredInvestors.length) {
      setSelectedInvestorId('')
      return
    }

    if (!filteredInvestors.some((investor) => investor.id === selectedInvestorId)) {
      setSelectedInvestorId(filteredInvestors[0].id)
    }
  }, [filteredInvestors, selectedInvestorId])

  const selectedInvestor =
    filteredInvestors.find((investor) => investor.id === selectedInvestorId) ??
    getInvestorById(selectedInvestorId) ??
    filteredInvestors[0]

  const performanceSummary = useMemo(
    () =>
      selectedInvestor ? buildInvestorPerformanceSummary(selectedInvestor.holdings, overviewLookup) : [],
    [overviewLookup, selectedInvestor]
  )

  if (!selectedInvestor && !filteredInvestors.length) {
    return (
      <StateCard
        title="Yatırımcı bulunamadı"
        description="Arama veya filtreleri temizlediğinde yatırımcı listesi yeniden dolacaktır."
      />
    )
  }

  if (!selectedInvestor) {
    return (
      <StateCard
        title="Yatırımcı verisi bulunamadı"
        description="Yatırımcı ekranı için veri kaynağı hazırlanamadı."
      />
    )
  }

  const coverageNote = buildInvestorCoverageNote(selectedInvestor.holdings)

  return (
    <div className="investor-dashboard">
      <div className="home-quick-grid investor-kpi-grid">
        <article className="list-card portfolio-stat-card">
          <div className="mini-list__label">
            <BriefcaseBusiness size={16} />
            <strong>İncelenen yatırımcı</strong>
          </div>
          <h3>{filteredInvestors.length}</h3>
          <p>Filtreye göre listelenen toplam profil sayısı.</p>
        </article>

        <article className="list-card portfolio-stat-card">
          <div className="mini-list__label">
            <CalendarClock size={16} />
            <strong>Son güncelleme</strong>
          </div>
          <h3>{formatDateTime(selectedInvestor.lastUpdated)}</h3>
          <p>Seçili yatırımcı için bilinen son portföy tarihi.</p>
        </article>

        <article className="list-card portfolio-stat-card">
          <div className="mini-list__label">
            <BarChart3 size={16} />
            <strong>Takip edilen varlık</strong>
          </div>
          <h3>{selectedInvestor.trackedHoldingCount}</h3>
          <p>Seçili yatırımcının görünür portföy kalemleri.</p>
        </article>

        <article className="list-card portfolio-stat-card">
          <div className="mini-list__label">
            <ShieldCheck size={16} />
            <strong>Kaynak</strong>
          </div>
          <h3>{selectedInvestor.source.label}</h3>
          <p>Veriler kamuya açık ve gecikmeli bildirimlerden gelir.</p>
        </article>
      </div>

      <div className="investor-dashboard__grid">
        <Panel title="Yatırımcılar" subtitle="Kamuya açık ve gecikmeli portföy görünümleri">
          <div className="list-stack">
            <label className="field-stack">
              <span>Yatırımcı ara</span>
              <div className="search-field">
                <Search size={16} />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Ad, fon veya yatırım tarzı ara"
                />
              </div>
            </label>

            <div className="filter-chip-row">
              {(Object.keys(styleLabels) as Array<keyof typeof styleLabels>).map((style) => (
                <button
                  key={style}
                  type="button"
                  className={styleFilter === style ? 'chip chip--active' : 'chip'}
                  onClick={() => setStyleFilter(style)}
                >
                  {styleLabels[style]}
                </button>
              ))}
            </div>

            {filteredInvestors.length ? (
              <div className="list-stack">
                {filteredInvestors.map((investor) => (
                  <button
                    key={investor.id}
                    type="button"
                    className={
                      investor.id === selectedInvestor.id ? 'investor-card investor-card--active' : 'investor-card'
                    }
                    onClick={() => setSelectedInvestorId(investor.id)}
                  >
                    <InvestorAvatar investor={investor} compact />
                    <div className="investor-card__content">
                      <div className="investor-card__header">
                        <strong>{investor.name}</strong>
                        <span>{formatDateTime(investor.lastUpdated)}</span>
                      </div>
                      <p>{investor.shortDescription}</p>
                      <div className="asset-chip-row">
                        <span className="chip">{styleLabels[investor.investmentStyle]}</span>
                        <span className="chip">{investor.firm}</span>
                        <span className="chip">{investor.trackedHoldingCount} varlık</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <StateCard
                title="Sonuç yok"
                description="Bu filtreyle eşleşen yatırımcı bulunamadı."
              />
            )}
          </div>
        </Panel>

        <div className="list-stack">
          <Panel
            title={selectedInvestor.name}
            subtitle={`${selectedInvestor.firm} • ${styleLabels[selectedInvestor.investmentStyle]}`}
          >
            <div className="list-stack">
              <article className="list-card">
                <div className="list-card__header">
                  <div className="mini-list__label">
                    <InvestorAvatar investor={selectedInvestor} />
                    <div>
                      <strong>{selectedInvestor.name}</strong>
                      <span>{selectedInvestor.shortDescription}</span>
                    </div>
                  </div>
                  <a href={selectedInvestor.source.url} target="_blank" rel="noreferrer" className="text-button">
                    Kaynağı aç
                  </a>
                </div>
                <p>{selectedInvestor.aiSummary}</p>
                <div className="meta-row">
                  <span>Veri kaynağı</span>
                  <strong>{selectedInvestor.source.label}</strong>
                </div>
                <div className="meta-row">
                  <span>Son güncelleme</span>
                  <strong>{formatDateTime(selectedInvestor.source.updatedAt)}</strong>
                </div>
                <p className="hero-card__helper">{selectedInvestor.source.note}</p>
              </article>

              <InvestorAllocationChart holdings={selectedInvestor.holdings} coverageNote={coverageNote} />
            </div>
          </Panel>

          <Panel title="Bilinen varlıklar" subtitle="Canlı fiyatla eşleşen kamuya açık pozisyonlar">
            <div className="list-stack">
              {selectedInvestor.holdings.map((holding) => {
                const asset = holding.assetId ? overviewLookup.get(holding.assetId) : undefined
                const estimatedProfitPercent =
                  typeof holding.averageCost === 'number' && asset
                    ? ((asset.quote.price - holding.averageCost) / holding.averageCost) * 100
                    : undefined

                return (
                  <article key={holding.id} className="list-card">
                    <div className="list-card__header">
                      <div className="mini-list__label">
                        <strong>{holding.symbol}</strong>
                        <span>{holding.name}</span>
                      </div>
                      {holding.assetId ? (
                        <button type="button" className="chip" onClick={() => onSelectAsset(holding.assetId!)}>
                          Varlığa git
                        </button>
                      ) : null}
                    </div>
                    <div className="movers-row__metrics">
                      <div className="movers-row__metric-card">
                        <span>Güncel fiyat</span>
                        <strong>{asset ? formatCurrency(asset.quote.price, asset.profile.currency) : 'Veri yok'}</strong>
                      </div>
                      <div className="movers-row__metric-card">
                        <span>Ağırlık</span>
                        <strong>
                          {typeof holding.weightPercent === 'number' ? `%${holding.weightPercent.toFixed(1)}` : 'Bilinmiyor'}
                        </strong>
                      </div>
                      <div className="movers-row__metric-card">
                        <span>Maliyet</span>
                        <strong>{formatHoldingCost(holding)}</strong>
                      </div>
                      <div className="movers-row__metric-card">
                        <span>Tahmini performans</span>
                        <strong>
                          {typeof estimatedProfitPercent === 'number' ? formatPercent(estimatedProfitPercent) : 'Veri yok'}
                        </strong>
                      </div>
                    </div>
                    {holding.knownPosition ? (
                      <div className="meta-row">
                        <span>Bilinen pozisyon</span>
                        <strong>{holding.knownPosition}</strong>
                      </div>
                    ) : null}
                    {holding.sourceNote ? <p className="hero-card__helper">{holding.sourceNote}</p> : null}
                  </article>
                )
              })}
            </div>
          </Panel>

          <Panel title="Performans özeti" subtitle="Canlı fiyat eşleşmesine göre hızlı okuma">
            {performanceSummary.length ? (
              <div className="list-stack">
                {performanceSummary.map((line) => (
                  <article key={line} className="list-card">
                    <p>{line}</p>
                  </article>
                ))}
              </div>
            ) : (
              <StateCard
                title="Özet üretilemedi"
                description="Canlı fiyatla eşleşen yeterli pozisyon bulunamadı."
              />
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
