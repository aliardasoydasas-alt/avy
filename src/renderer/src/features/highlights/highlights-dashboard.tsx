import { useMemo, useState } from 'react'
import { Flame, Sparkles, TrendingDown, TrendingUp } from 'lucide-react'
import { Panel } from '@renderer/components/panel'
import { StateCard } from '@renderer/components/state-card'
import { StatusPill } from '@renderer/components/status-pill'
import { formatCurrency, formatPercent, formatVolume } from '@renderer/utils/format'
import { getMarketStatusLabel } from '@renderer/utils/market-hours'
import type { MarketOverviewItem } from '@shared/types/market'

interface HighlightsDashboardProps {
  gainers: MarketOverviewItem[]
  decliners: MarketOverviewItem[]
  isLoading: boolean
  hasError: boolean
  onSelectAsset: (assetId: string) => void
}

type HighlightsTab = 'gainers' | 'decliners'

const getClassLabel = (item: MarketOverviewItem): string =>
  item.profile.class === 'crypto' ? 'Kripto' : item.profile.class === 'stock' ? 'Hisse' : item.profile.class

const getChangeTone = (item: MarketOverviewItem): 'positive' | 'negative' | 'neutral' =>
  item.quote.changePercent > 0 ? 'positive' : item.quote.changePercent < 0 ? 'negative' : 'neutral'

export const HighlightsDashboard = ({
  gainers,
  decliners,
  isLoading,
  hasError,
  onSelectAsset
}: HighlightsDashboardProps) => {
  const [activeTab, setActiveTab] = useState<HighlightsTab>('gainers')

  const activeList = activeTab === 'gainers' ? gainers : decliners
  const leader = activeList[0]
  const positiveCount = gainers.filter((item) => item.quote.changePercent >= 0).length
  const negativeCount = decliners.filter((item) => item.quote.changePercent < 0).length

  const heroTitle =
    activeTab === 'gainers' ? 'Günün en çok yükselenleri' : 'Günün en çok düşenleri'
  const heroSummary =
    activeTab === 'gainers'
      ? 'Gerçekten güçlenen kripto ve açık piyasadaki hisseleri yukarıdan aşağıya sıralıyoruz.'
      : 'Satış baskısının yoğunlaştığı varlıkları hacim ve günlük değişimle birlikte gösteriyoruz.'

  return (
    <div className="home-stack">
      <section className="hero-card home-hero">
        <div className="home-hero__main">
          <div>
            <p className="eyebrow">Öne çıkanlar</p>
            <div className="home-hero__title">
              <h2>{heroTitle}</h2>
              <StatusPill
                label={leader ? `${leader.profile.symbol} odakta` : 'Veri bekleniyor'}
                tone={leader ? getChangeTone(leader) : 'neutral'}
              />
            </div>
            <p className="home-hero__summary">{heroSummary}</p>
          </div>

          <div className="home-hero__stamp">
            <span>Yükselen / Düşen</span>
            <strong>
              {positiveCount} / {negativeCount}
            </strong>
          </div>
        </div>
      </section>

      <Panel
        title="Top 20"
        subtitle={activeTab === 'gainers' ? 'Günlük en çok yükselenler' : 'Günlük en çok düşenler'}
        action={
          <div className="filter-chip-row">
            <button
              type="button"
              className={activeTab === 'gainers' ? 'chip chip--active' : 'chip'}
              onClick={() => setActiveTab('gainers')}
            >
              En çok yükselenler
            </button>
            <button
              type="button"
              className={activeTab === 'decliners' ? 'chip chip--active' : 'chip'}
              onClick={() => setActiveTab('decliners')}
            >
              En çok düşenler
            </button>
          </div>
        }
      >
        {hasError ? (
          <StateCard
            title="Öne çıkanlar yüklenemedi"
            description="Canlı piyasa verisi yeniden geldiğinde bu panel otomatik güncellenecek."
          />
        ) : isLoading && !activeList.length ? (
          <StateCard
            title="Liste hazırlanıyor"
            description="Kripto ve hisse tarafında günün en hareketli varlıkları hesaplanıyor."
          />
        ) : activeList.length ? (
          <div className="movers-table">
            {activeList.map((item, index) => {
              const marketStatus = getMarketStatusLabel(item.profile)

              return (
                <button
                  key={item.assetId}
                  type="button"
                  className="movers-row"
                  onClick={() => onSelectAsset(item.assetId)}
                >
                  <div className="movers-row__rank">
                    <span>#{index + 1}</span>
                    {activeTab === 'gainers' ? (index < 3 ? <Flame size={15} /> : <TrendingUp size={15} />) : <TrendingDown size={15} />}
                  </div>

                  <div className="movers-row__asset">
                    <strong>{item.profile.symbol}</strong>
                    <p>{item.profile.name}</p>
                  </div>

                  <div className="movers-row__meta">
                    <span>{getClassLabel(item)}</span>
                    <span>{item.profile.exchange}</span>
                  </div>

                  <div className="movers-row__metrics">
                    <div className="movers-row__metric-card">
                      <span>Fiyat</span>
                      <strong>{formatCurrency(item.quote.price, item.profile.currency)}</strong>
                    </div>
                    <div className="movers-row__metric-card">
                      <span>Hacim</span>
                      <strong>{formatVolume(item.quote.volume)}</strong>
                    </div>
                  </div>

                  <div className="movers-row__change">
                    <Sparkles size={15} />
                    <div className="movers-row__change-copy">
                      <strong className={item.quote.changePercent >= 0 ? 'positive-text' : 'negative-text'}>
                        {formatPercent(item.quote.changePercent)}
                      </strong>
                      <span>{marketStatus ?? 'Günlük değişim'}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <StateCard
            title="Liste boş"
            description="Şu anda günlük öne çıkan varlık bulunamadı."
          />
        )}
      </Panel>
    </div>
  )
}

interface HighlightsSidebarProps {
  gainers: MarketOverviewItem[]
  decliners: MarketOverviewItem[]
}

export const HighlightsSidebar = ({ gainers, decliners }: HighlightsSidebarProps) => {
  const leaders = useMemo(() => [gainers[0], decliners[0]].filter(Boolean), [decliners, gainers])

  return (
    <Panel title="Lider özeti" subtitle="Yükselen ve düşen görünüm">
      <div className="list-stack">
        {leaders.map((item) => (
          <article key={item!.assetId} className="list-card">
            <div className="list-card__header">
              <strong>{item!.quote.changePercent >= 0 ? 'Yükseliş lideri' : 'Düşüş lideri'}</strong>
              <StatusPill label={item!.profile.symbol} tone={getChangeTone(item!)} />
            </div>
            <p>{item!.profile.name}</p>
            <div className="meta-row">
              <span>{item!.profile.exchange}</span>
              <span className={item!.quote.changePercent >= 0 ? 'positive-text' : 'negative-text'}>
                {formatPercent(item!.quote.changePercent)}
              </span>
            </div>
          </article>
        ))}
      </div>
    </Panel>
  )
}
