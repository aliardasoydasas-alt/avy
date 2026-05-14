import { useEffect, useMemo, useState } from 'react'
import {
  BriefcaseBusiness,
  CircleDollarSign,
  Landmark,
  Plus,
  RotateCcw,
  TrendingUp,
  Trash2,
  Wallet
} from 'lucide-react'
import { Panel } from '@renderer/components/panel'
import { StateCard } from '@renderer/components/state-card'
import { PortfolioPerformanceChart } from '@renderer/features/profile/portfolio-performance-chart'
import { canAllocateSaleTargetAmount, getReservedSaleTargetAmount } from '@renderer/services/portfolio-sale-target-service'
import type { PortfolioSummary } from '@renderer/services/portfolio-service'
import { usePortfolioStore } from '@renderer/store/use-portfolio-store'
import { formatCurrency, formatDateTime, formatEditableNumber, formatPercent } from '@renderer/utils/format'
import { getMarketStatusLabel } from '@renderer/utils/market-hours'
import type { CloudSyncState } from '@shared/types/cloud-sync'
import type { MarketOverviewItem } from '@shared/types/market'
import type { PortfolioRange, PortfolioSnapshot } from '@shared/types/portfolio'

interface HoldingsPanelProps {
  overviewItems: MarketOverviewItem[]
  summary: PortfolioSummary
  snapshots: PortfolioSnapshot[]
  range: PortfolioRange
  cloudSync: CloudSyncState
  fxRate: number
  fxSource: 'live' | 'fallback'
  isFxLoading: boolean
  isOverviewLoading: boolean
  isRefreshingOverview: boolean
  onRangeChange: (range: PortfolioRange) => void
  onSelectAsset: (assetId: string) => void
  onRefreshOverview: () => void
}

type HoldingFormType = 'crypto' | 'stock' | 'cash'
type PortfolioChartType = 'line' | 'candles'
interface SaleTargetDraft {
  price: string
  amount: string
}

const assetTypeMeta: Record<HoldingFormType, { label: string; icon: typeof CircleDollarSign }> = {
  crypto: { label: 'Coin', icon: CircleDollarSign },
  stock: { label: 'Hisse', icon: Landmark },
  cash: { label: 'Nakit', icon: Wallet }
}

const cashCurrencies = ['TRY', 'USD', 'EUR'] as const

const formatQuantity = (value: number): string =>
  new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: value >= 1 ? 0 : 2,
    maximumFractionDigits: value >= 1 ? 4 : 8
  }).format(value)

const formatReportDate = (value: string): string =>
  new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short'
  }).format(new Date(value))

const parsePositiveNumber = (value: string): number | undefined => {
  const parsed = Number(value.replace(',', '.'))

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined
  }

  return parsed
}

const getTargetValueTry = (
  currentPrice: number,
  currentPriceTry: number,
  targetPrice: number,
  amount: number
): number => {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0 || !Number.isFinite(currentPriceTry) || currentPriceTry <= 0) {
    return 0
  }

  return (currentPriceTry / currentPrice) * targetPrice * amount
}

const getAssetType = (item: MarketOverviewItem): Exclude<HoldingFormType, 'cash'> =>
  item.profile.class === 'crypto' ? 'crypto' : 'stock'

const getHoldingTypeLabel = (assetType: HoldingFormType): string => {
  if (assetType === 'crypto') {
    return 'Coin'
  }

  if (assetType === 'stock') {
    return 'Hisse'
  }

  return 'Nakit'
}

const PortfolioMoodBadge = ({ dailyChangePercent }: { dailyChangePercent: number }) => {
  const isBullish = dailyChangePercent >= 0

  return (
    <div className={`portfolio-mood-card${isBullish ? ' portfolio-mood-card--bull' : ' portfolio-mood-card--bear'}`}>
      <div className="portfolio-mood-card__icon" aria-hidden="true">
        {isBullish ? (
          <svg viewBox="0 0 64 64" role="presentation">
            <path d="M15 36c0-11 7-19 17-19h6c8 0 15 6 17 14l4 9c1 2-1 4-3 4h-4v4c0 3-2 5-5 5h-2c-3 0-5-2-5-5v-2H27v2c0 3-2 5-5 5h-2c-3 0-5-2-5-5v-7c0-2 0-5 0-5Z" />
            <path d="M23 19l-7-7M41 19l7-7" />
          </svg>
        ) : (
          <svg viewBox="0 0 64 64" role="presentation">
            <path d="M15 39c0-10 7-17 17-17h5c9 0 16 5 18 13l4 8c1 2-1 4-3 4h-4v4c0 3-2 5-5 5h-2c-3 0-5-2-5-5v-2H27v2c0 3-2 5-5 5h-2c-3 0-5-2-5-5v-6Z" />
            <path d="M21 24l-8-8M43 24l8-8" />
          </svg>
        )}
      </div>
      <div>
        <strong>
          {isBullish
            ? `Bugün portföyün ${formatPercent(dailyChangePercent)} yükseldi`
            : `Bugün portföyün ${formatPercent(Math.abs(dailyChangePercent))} düştü`}
        </strong>
        <p>
          {isBullish
            ? 'Günün kazananları ağırlığı taşıyor. Momentum korunursa baskın pozisyonlarda ivme sürebilir.'
            : 'Günün zayıf halkaları toplamı aşağı çekiyor. Yoğun pozisyonlarda riski yeniden gözden geçirmek faydalı olabilir.'}
        </p>
      </div>
    </div>
  )
}

export const HoldingsPanel = ({
  overviewItems,
  summary,
  snapshots,
  range,
  cloudSync,
  fxRate,
  fxSource,
  isFxLoading,
  isOverviewLoading,
  isRefreshingOverview,
  onRangeChange,
  onSelectAsset,
  onRefreshOverview
}: HoldingsPanelProps) => {
  const addHolding = usePortfolioStore((state) => state.addHolding)
  const addCashHolding = usePortfolioStore((state) => state.addCashHolding)
  const removeHolding = usePortfolioStore((state) => state.removeHolding)
  const addSaleTarget = usePortfolioStore((state) => state.addSaleTarget)
  const updateSaleTarget = usePortfolioStore((state) => state.updateSaleTarget)
  const removeSaleTarget = usePortfolioStore((state) => state.removeSaleTarget)
  const [assetType, setAssetType] = useState<HoldingFormType>('crypto')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAssetId, setSelectedAssetId] = useState('')
  const [amountInput, setAmountInput] = useState('')
  const [averageCostInput, setAverageCostInput] = useState('')
  const [cashCurrency, setCashCurrency] = useState<(typeof cashCurrencies)[number]>('TRY')
  const [formMessage, setFormMessage] = useState('')
  const [portfolioChartType, setPortfolioChartType] = useState<PortfolioChartType>('line')
  const [newSaleTargetDrafts, setNewSaleTargetDrafts] = useState<Record<string, SaleTargetDraft>>({})
  const [editSaleTargetDrafts, setEditSaleTargetDrafts] = useState<Record<string, SaleTargetDraft>>({})
  const [saleTargetMessages, setSaleTargetMessages] = useState<Record<string, string>>({})

  const overviewById = useMemo(
    () => new Map(overviewItems.map((item) => [item.assetId, item])),
    [overviewItems]
  )

  const filteredAssets = useMemo(() => {
    if (assetType === 'cash') {
      return []
    }

    const normalized = searchTerm.trim().toLowerCase()

    return overviewItems
      .filter((item) => getAssetType(item) === assetType)
      .filter((item) => {
        if (!normalized) {
          return true
        }

        return (
          item.profile.symbol.toLowerCase().includes(normalized) ||
          item.profile.name.toLowerCase().includes(normalized)
        )
      })
      .sort((left, right) => right.quote.volume - left.quote.volume)
      .slice(0, 40)
  }, [assetType, overviewItems, searchTerm])

  useEffect(() => {
    if (assetType === 'cash') {
      setSelectedAssetId('')
      return
    }

    if (!filteredAssets.length) {
      setSelectedAssetId('')
      return
    }

    if (!filteredAssets.some((item) => item.assetId === selectedAssetId)) {
      setSelectedAssetId(filteredAssets[0].assetId)
    }
  }, [assetType, filteredAssets, selectedAssetId])

  const selectedAsset =
    assetType === 'cash' ? undefined : filteredAssets.find((item) => item.assetId === selectedAssetId)

  const dailyReports = useMemo(
    () =>
      [...snapshots]
        .sort((left, right) => new Date(right.capturedAt).getTime() - new Date(left.capturedAt).getTime())
        .slice(0, 10),
    [snapshots]
  )

  const costAwareHoldings = summary.holdings.filter((item) => item.averageCostTry !== undefined)

  const setSaleTargetMessage = (holdingId: string, message: string) =>
    setSaleTargetMessages((state) => ({
      ...state,
      [holdingId]: message
    }))

  const getNewSaleTargetDraft = (holdingId: string): SaleTargetDraft =>
    newSaleTargetDrafts[holdingId] ?? {
      price: '',
      amount: ''
    }

  const getEditSaleTargetDraft = (
    targetId: string,
    targetPrice: number,
    amount: number
  ): SaleTargetDraft =>
    editSaleTargetDrafts[targetId] ?? {
      price: formatEditableNumber(targetPrice),
      amount: formatEditableNumber(amount)
    }

  const submitHolding = () => {
    const amount = Number(amountInput.replace(',', '.'))

    if (!Number.isFinite(amount) || amount <= 0) {
      setFormMessage('Miktar alanı sıfırdan büyük olmalı.')
      return
    }

    if (assetType === 'cash') {
      addCashHolding({
        currency: cashCurrency,
        amount
      })
      setAmountInput('')
      setAverageCostInput('')
      setFormMessage(`${cashCurrency} nakit bakiyesi portföyüne eklendi.`)
      return
    }

    if (!selectedAsset) {
      setFormMessage('Portföye eklemek için önce bir varlık seç.')
      return
    }

    const averageCost = averageCostInput ? Number(averageCostInput.replace(',', '.')) : undefined

    if (averageCost !== undefined && (!Number.isFinite(averageCost) || averageCost <= 0)) {
      setFormMessage('Ortalama maliyet girildiğinde pozitif olmalı.')
      return
    }

    addHolding({
      asset: selectedAsset.profile,
      assetType,
      amount,
      averageCost
    })
    setAmountInput('')
    setAverageCostInput('')
    setFormMessage(`${selectedAsset.profile.symbol} portföyüne eklendi.`)
  }

  return (
    <div className="list-stack">
      <PortfolioMoodBadge dailyChangePercent={summary.totalDailyChangePercent} />

      <div className="portfolio-summary-grid">
        <article className="list-card portfolio-stat-card">
          <div className="mini-list__label">
            <Wallet size={16} />
            <strong>Toplam portföy</strong>
          </div>
          <h3>{formatCurrency(summary.totalValueTry, 'TRY', 0)}</h3>
          <p>{summary.holdings.length} aktif pozisyon izleniyor.</p>
        </article>

        <article className="list-card portfolio-stat-card">
          <div className="mini-list__label">
            <TrendingUp size={16} />
            <strong>Bugünkü değişim</strong>
          </div>
          <h3 className={summary.totalDailyChangeValueTry >= 0 ? 'metric-positive' : 'metric-negative'}>
            {formatCurrency(summary.totalDailyChangeValueTry, 'TRY', 0)}
          </h3>
          <p>{formatPercent(summary.totalDailyChangePercent)}</p>
        </article>

        <article className="list-card portfolio-stat-card">
          <div className="mini-list__label">
            <BriefcaseBusiness size={16} />
            <strong>Kâr / zarar</strong>
          </div>
          {summary.totalProfitLossValueTry !== undefined ? (
            <>
              <h3 className={summary.totalProfitLossValueTry >= 0 ? 'metric-positive' : 'metric-negative'}>
                {formatCurrency(summary.totalProfitLossValueTry, 'TRY', 0)}
              </h3>
              <p>{formatPercent(summary.totalProfitLossPercent ?? 0)}</p>
            </>
          ) : (
            <p>Maliyet girilen {costAwareHoldings.length} varlıktan sonra otomatik hesaplanır.</p>
          )}
        </article>

        <article className="list-card portfolio-stat-card">
          <div className="mini-list__label">
            <CircleDollarSign size={16} />
            <strong>USD/TRY</strong>
          </div>
          <h3>{formatCurrency(fxRate, 'TRY', 2)}</h3>
          <p>
            {isFxLoading
              ? 'Kur güncelleniyor.'
              : fxSource === 'live'
                ? 'Canlı kur ile hesaplandı.'
                : 'Ağ kesintisinde güvenli fallback kur kullanılıyor.'}
          </p>
        </article>

        <article className="list-card portfolio-stat-card">
          <div className="mini-list__label">
            <Wallet size={16} />
            <strong>Bulut senkronu</strong>
          </div>
          <h3>
            {cloudSync.status === 'synced'
              ? 'Hazır'
              : cloudSync.status === 'saving'
                ? 'Kaydediliyor'
                : cloudSync.status === 'loading'
                  ? 'Yükleniyor'
                  : cloudSync.status === 'offline'
                    ? 'Çevrimdışı'
                    : 'Sorun var'}
          </h3>
          <p>
            {cloudSync.errorMessage
              ? cloudSync.errorMessage
              : cloudSync.lastSyncedAt
                ? `Son senkron ${formatDateTime(cloudSync.lastSyncedAt)}`
                : 'Bu hesapla açtığın diğer cihazlara portföyün otomatik taşınır.'}
          </p>
        </article>
      </div>

      <div className="home-quick-grid">
        <Panel title="Varlık ekle" subtitle="Coin, hisse veya nakit pozisyonu ekle">
          <div className="list-stack">
            <div className="filter-chip-row">
              {Object.entries(assetTypeMeta).map(([value, meta]) => {
                const Icon = meta.icon

                return (
                  <button
                    key={value}
                    type="button"
                    className={assetType === value ? 'chip chip--active' : 'chip'}
                    onClick={() => setAssetType(value as HoldingFormType)}
                  >
                    <Icon size={14} />
                    {meta.label}
                  </button>
                )
              })}
            </div>

            {assetType === 'cash' ? (
              <>
                <label className="field-stack">
                  <span>Nakit birimi</span>
                  <select
                    value={cashCurrency}
                    onChange={(event) => setCashCurrency(event.target.value as (typeof cashCurrencies)[number])}
                  >
                    {cashCurrencies.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                </label>

                <article className="holding-asset-preview">
                  <div className="holding-avatar">{cashCurrency.slice(0, 2)}</div>
                  <div>
                    <strong>{cashCurrency} nakit pozisyonu</strong>
                    <p>Boşta tuttuğun bakiyeyi portföy toplamına dahil edebilirsin.</p>
                  </div>
                </article>
              </>
            ) : (
              <>
                <label className="field-stack">
                  <span>Varlık ara</span>
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder={assetType === 'crypto' ? 'Örnek: BTC, ETH, SOL' : 'Örnek: ASELS, AAPL'}
                  />
                </label>

                <label className="field-stack">
                  <span>Seçilen varlık</span>
                  <select
                    value={selectedAssetId}
                    onChange={(event) => setSelectedAssetId(event.target.value)}
                    disabled={!filteredAssets.length}
                  >
                    {!filteredAssets.length ? <option value="">Sonuç bulunamadı</option> : null}
                    {filteredAssets.map((item) => (
                      <option key={item.assetId} value={item.assetId}>
                        {item.profile.symbol} - {item.profile.name}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedAsset ? (
                  <button
                    type="button"
                    className="holding-asset-preview"
                    onClick={() => onSelectAsset(selectedAsset.assetId)}
                  >
                    <div className="holding-avatar">{selectedAsset.profile.symbol.slice(0, 2)}</div>
                    <div>
                      <strong>
                        {selectedAsset.profile.symbol} • {selectedAsset.profile.name}
                      </strong>
                      <p>
                        {formatCurrency(selectedAsset.quote.price, selectedAsset.profile.currency)} •{' '}
                        {getMarketStatusLabel(selectedAsset.profile) ?? formatPercent(selectedAsset.quote.changePercent)}
                      </p>
                    </div>
                  </button>
                ) : (
                  <StateCard
                    title={isOverviewLoading ? 'Varlıklar yükleniyor' : 'Varlık seç'}
                    description={
                      isOverviewLoading
                        ? 'Canlı piyasa listesi geldikten sonra eklemek istediğin varlığı seçebilirsin.'
                        : 'Arama yaparak eklemek istediğin coin veya hisseyi seç.'
                    }
                  />
                )}
              </>
            )}

            <div className="form-grid holdings-form-grid">
              <label className="field-stack">
                <span>{assetType === 'cash' ? 'Nakit miktarı' : 'Miktar'}</span>
                <input
                  value={amountInput}
                  onChange={(event) => setAmountInput(event.target.value)}
                  inputMode="decimal"
                  placeholder={assetType === 'crypto' ? '0.2500' : assetType === 'stock' ? '10' : '25000'}
                />
              </label>

              {assetType !== 'cash' ? (
                <label className="field-stack">
                  <span>Ortalama maliyet (opsiyonel)</span>
                  <input
                    value={averageCostInput}
                    onChange={(event) => setAverageCostInput(event.target.value)}
                    inputMode="decimal"
                    placeholder={selectedAsset ? formatEditableNumber(selectedAsset.quote.price) : '0'}
                  />
                </label>
              ) : null}
            </div>

            <div className="inline-form">
              <button type="button" className="primary-button" onClick={submitHolding}>
                <Plus size={16} />
                Portföye ekle
              </button>
              {formMessage ? <span className="hero-card__helper">{formMessage}</span> : null}
            </div>
          </div>
        </Panel>

      </div>

      <Panel
        title="Portföy performansı"
        subtitle="Toplam değer geçmişi"
        className="portfolio-performance-panel"
        action={
          <div className="portfolio-performance-actions">
            <div className="filter-chip-row">
              {(['7D', '30D', 'ALL'] as PortfolioRange[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={range === value ? 'chip chip--active' : 'chip'}
                  onClick={() => onRangeChange(value)}
                >
                  {value === 'ALL' ? 'Tüm zamanlar' : value}
                </button>
              ))}
            </div>

            <div className="filter-chip-row">
              <button
                type="button"
                className={portfolioChartType === 'line' ? 'chip chip--active' : 'chip'}
                onClick={() => setPortfolioChartType('line')}
              >
                Çizgisel
              </button>
              <button
                type="button"
                className={portfolioChartType === 'candles' ? 'chip chip--active' : 'chip'}
                onClick={() => setPortfolioChartType('candles')}
              >
                Mum
              </button>
            </div>
          </div>
        }
      >
        {summary.holdings.length ? (
          <div className="portfolio-performance-layout">
            <PortfolioPerformanceChart snapshots={snapshots} chartType={portfolioChartType} />

            <aside className="portfolio-daily-report">
              <header className="portfolio-daily-report__header">
                <strong>Günlük raporlar</strong>
                <span>Sadece günlük yüzde değişimi</span>
              </header>

              {dailyReports.length ? (
                <div className="portfolio-daily-report__list">
                  {dailyReports.map((snapshot) => (
                    <article key={snapshot.id} className="portfolio-daily-report__item">
                      <span>{formatReportDate(snapshot.capturedAt)}</span>
                      <strong
                        className={
                          snapshot.dailyChangePercent >= 0 ? 'metric-positive' : 'metric-negative'
                        }
                      >
                        {formatPercent(snapshot.dailyChangePercent)}
                      </strong>
                    </article>
                  ))}
                </div>
              ) : (
                <StateCard
                  title="Günlük rapor oluşacak"
                  description="Yeni günler kaydedildikçe burada tarih bazlı günlük değişimler listelenecek."
                />
              )}
            </aside>
          </div>
        ) : (
          <StateCard
            title="Portföy grafiği hazır"
            description="İlk varlığını ekledikten sonra burada 7 gün, 30 gün ve tüm zamanlar performansını görürsün."
          />
        )}
      </Panel>

      <Panel
        title="Varlıklarım"
        subtitle="Canlı değerleme ve portföy dağılımı"
        action={
          <button
            type="button"
            className={isRefreshingOverview ? 'icon-button icon-button--spinning' : 'icon-button'}
            onClick={onRefreshOverview}
            title="Canlı varlık verisini hemen yenile"
            aria-label="Canlı varlık verisini hemen yenile"
          >
            <RotateCcw size={16} />
          </button>
        }
      >
        {!summary.holdings.length ? (
          <StateCard
            title="Portföy henüz boş"
            description="Coin, hisse veya nakit ekleyerek toplam portföy değerini ve günlük performansını buradan izleyebilirsin."
          />
        ) : (
          <div className="list-stack">
            {summary.holdings.map((item) => {
              const marketItem = overviewById.get(item.holding.assetId)
              const marketStatusLabel =
                item.holding.assetType === 'stock' && marketItem
                  ? getMarketStatusLabel(marketItem.profile)
                  : item.holding.assetType === 'stock' && !marketItem
                    ? 'Piyasa kapalı'
                    : null

              return (
                <article key={item.holding.id} className="list-card holding-card">
                  <div className="holding-card__header">
                    {item.holding.assetType === 'cash' ? (
                      <div className="holding-card__asset holding-card__asset--static">
                        <div className="holding-avatar">{item.holding.assetSymbol.slice(0, 2)}</div>
                        <div>
                          <strong>
                            {item.holding.assetSymbol} • {item.holding.assetName}
                          </strong>
                          <p>
                            {getHoldingTypeLabel(item.holding.assetType)} • {formatQuantity(item.holding.amount)}{' '}
                            {item.holding.assetCurrency}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="holding-card__asset"
                        onClick={() => onSelectAsset(item.holding.assetId)}
                      >
                        <div className="holding-avatar">{item.holding.assetSymbol.slice(0, 2)}</div>
                        <div>
                          <strong>
                            {item.holding.assetSymbol} • {item.holding.assetName}
                          </strong>
                          <p>
                            {getHoldingTypeLabel(item.holding.assetType)} • {formatQuantity(item.holding.amount)} adet
                          </p>
                        </div>
                      </button>
                    )}

                    <button
                      type="button"
                      className="text-button"
                      onClick={() => removeHolding(item.holding.id)}
                    >
                      <Trash2 size={16} />
                      Kaldır
                    </button>
                  </div>

                  <div className="portfolio-metrics-grid">
                    <div className="meta-row">
                      <span>{item.holding.assetType === 'cash' ? 'Birim değer' : 'Anlık fiyat'}</span>
                      <strong>
                        {item.holding.assetType === 'cash'
                          ? `${formatEditableNumber(item.price)} ${item.holding.assetCurrency}`
                          : formatCurrency(item.price, item.holding.assetCurrency)}
                      </strong>
                    </div>
                    <div className="meta-row">
                      <span>TL karşılığı</span>
                      <strong>{formatCurrency(item.priceTry, 'TRY', 2)}</strong>
                    </div>
                    <div className="meta-row">
                      <span>Toplam değer</span>
                      <strong>{formatCurrency(item.totalValueTry, 'TRY', 0)}</strong>
                    </div>
                    <div className="meta-row">
                      <span>Günlük değişim</span>
                      <strong className={item.dailyChangeValueTry >= 0 ? 'metric-positive' : 'metric-negative'}>
                        {formatCurrency(item.dailyChangeValueTry, 'TRY', 0)}
                      </strong>
                    </div>
                    <div className="meta-row">
                      <span>Değişim oranı</span>
                      <strong
                        className={
                          marketStatusLabel
                            ? ''
                            : item.dailyChangePercent >= 0
                              ? 'metric-positive'
                              : 'metric-negative'
                        }
                      >
                        {item.holding.assetType === 'cash'
                          ? 'Sabit bakiye'
                          : marketStatusLabel ?? formatPercent(item.dailyChangePercent)}
                      </strong>
                    </div>
                    <div className="meta-row">
                      <span>Kâr / zarar</span>
                      <strong
                        className={
                          item.profitLossValueTry === undefined
                            ? ''
                            : item.profitLossValueTry >= 0
                              ? 'metric-positive'
                              : 'metric-negative'
                        }
                      >
                        {item.profitLossValueTry !== undefined
                          ? `${formatCurrency(item.profitLossValueTry, 'TRY', 0)} (${formatPercent(item.profitLossPercent ?? 0)})`
                          : item.holding.assetType === 'cash'
                            ? 'Nakit pozisyonunda maliyet uygulanmıyor'
                            : 'Maliyet girilmedi'}
                      </strong>
                    </div>
                  </div>

                  {item.holding.assetType !== 'cash' ? (
                    <div className="sale-target-create">
                      <div className="sale-target-create__header">
                        <strong>SatÄ±ÅŸ hedefleri</strong>
                        <span className="hero-card__helper">
                          AyrÄ±lan {formatQuantity(getReservedSaleTargetAmount(item.holding))} adet â€¢ MÃ¼sait{' '}
                          {formatQuantity(Math.max(item.holding.amount - getReservedSaleTargetAmount(item.holding), 0))} adet
                        </span>
                      </div>

                      {item.holding.saleTargets?.length ? (
                        <div className="sale-target-list">
                          {item.holding.saleTargets.map((target) => {
                            const draft = getEditSaleTargetDraft(target.id, target.targetPrice, target.amount)

                            return (
                              <div key={target.id} className="sale-target-row">
                                <div className="sale-target-row__fields">
                                  <label className="field-stack">
                                    <span>Hedef fiyat</span>
                                    <input
                                      value={draft.price}
                                      inputMode="decimal"
                                      onChange={(event) =>
                                        setEditSaleTargetDrafts((state) => ({
                                          ...state,
                                          [target.id]: {
                                            ...draft,
                                            price: event.target.value
                                          }
                                        }))
                                      }
                                    />
                                  </label>
                                  <label className="field-stack">
                                    <span>SatÄ±ÅŸ miktarÄ±</span>
                                    <input
                                      value={draft.amount}
                                      inputMode="decimal"
                                      onChange={(event) =>
                                        setEditSaleTargetDrafts((state) => ({
                                          ...state,
                                          [target.id]: {
                                            ...draft,
                                            amount: event.target.value
                                          }
                                        }))
                                      }
                                    />
                                  </label>
                                  <div className="sale-target-row__value">
                                    <span>Hedefte TRY karÅŸÄ±lÄ±ÄŸÄ±</span>
                                    <strong>
                                      {formatCurrency(
                                        getTargetValueTry(item.price, item.priceTry, target.targetPrice, target.amount),
                                        'TRY',
                                        0
                                      )}
                                    </strong>
                                  </div>
                                </div>

                                <div className="sale-target-row__actions">
                                  <button
                                    type="button"
                                    className="text-button"
                                    onClick={() => {
                                      const price = parsePositiveNumber(draft.price)
                                      const amount = parsePositiveNumber(draft.amount)

                                      if (!price || !amount) {
                                        setSaleTargetMessage(item.holding.id, 'Hedef fiyat ve satÄ±ÅŸ miktarÄ± pozitif olmalÄ±.')
                                        return
                                      }

                                      if (!canAllocateSaleTargetAmount(item.holding, amount, target.id)) {
                                        setSaleTargetMessage(item.holding.id, 'Toplam hedef miktarÄ± elindeki adedi aÅŸamaz.')
                                        return
                                      }

                                      updateSaleTarget({
                                        holdingId: item.holding.id,
                                        targetId: target.id,
                                        targetPrice: price,
                                        amount
                                      })
                                      setSaleTargetMessage(item.holding.id, 'SatÄ±ÅŸ hedefi gÃ¼ncellendi.')
                                    }}
                                  >
                                    Kaydet
                                  </button>
                                  <button
                                    type="button"
                                    className="text-button"
                                    onClick={() => {
                                      removeSaleTarget(item.holding.id, target.id)
                                      setSaleTargetMessage(item.holding.id, 'SatÄ±ÅŸ hedefi kaldÄ±rÄ±ldÄ±.')
                                    }}
                                  >
                                    Sil
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <StateCard
                          title="HenÃ¼z satÄ±ÅŸ hedefi yok"
                          description="Bu varlÄ±k iÃ§in hedef fiyat eklediÄŸinde AVY fiyat oraya geldiÄŸinde otomatik satÄ±lmÄ±ÅŸ kabul eder."
                        />
                      )}

                      <div className="sale-target-row">
                        <div className="sale-target-row__fields">
                          <label className="field-stack">
                            <span>Yeni hedef fiyat</span>
                            <input
                              value={getNewSaleTargetDraft(item.holding.id).price}
                              inputMode="decimal"
                              placeholder={formatEditableNumber(item.price)}
                              onChange={(event) =>
                                setNewSaleTargetDrafts((state) => ({
                                  ...state,
                                  [item.holding.id]: {
                                    ...getNewSaleTargetDraft(item.holding.id),
                                    price: event.target.value
                                  }
                                }))
                              }
                            />
                          </label>
                          <label className="field-stack">
                            <span>Yeni satÄ±ÅŸ miktarÄ±</span>
                            <input
                              value={getNewSaleTargetDraft(item.holding.id).amount}
                              inputMode="decimal"
                              placeholder={formatEditableNumber(Math.min(item.holding.amount, 1))}
                              onChange={(event) =>
                                setNewSaleTargetDrafts((state) => ({
                                  ...state,
                                  [item.holding.id]: {
                                    ...getNewSaleTargetDraft(item.holding.id),
                                    amount: event.target.value
                                  }
                                }))
                              }
                            />
                          </label>
                          <div className="sale-target-row__value">
                            <span>Hedefte TRY karÅŸÄ±lÄ±ÄŸÄ±</span>
                            <strong>
                              {formatCurrency(
                                getTargetValueTry(
                                  item.price,
                                  item.priceTry,
                                  parsePositiveNumber(getNewSaleTargetDraft(item.holding.id).price) ?? 0,
                                  parsePositiveNumber(getNewSaleTargetDraft(item.holding.id).amount) ?? 0
                                ),
                                'TRY',
                                0
                              )}
                            </strong>
                          </div>
                        </div>

                        <div className="inline-form">
                          <button
                            type="button"
                            className="primary-button"
                            onClick={() => {
                              const draft = getNewSaleTargetDraft(item.holding.id)
                              const price = parsePositiveNumber(draft.price)
                              const amount = parsePositiveNumber(draft.amount)

                              if (!price || !amount) {
                                setSaleTargetMessage(item.holding.id, 'Yeni hedef iÃ§in fiyat ve miktar gir.')
                                return
                              }

                              if (!canAllocateSaleTargetAmount(item.holding, amount)) {
                                setSaleTargetMessage(item.holding.id, 'Toplam hedef miktarÄ± elindeki adedi aÅŸamaz.')
                                return
                              }

                              addSaleTarget({
                                holdingId: item.holding.id,
                                targetPrice: price,
                                amount
                              })
                              setNewSaleTargetDrafts((state) => ({
                                ...state,
                                [item.holding.id]: {
                                  price: '',
                                  amount: ''
                                }
                              }))
                              setSaleTargetMessage(item.holding.id, 'SatÄ±ÅŸ hedefi eklendi.')
                            }}
                          >
                            <Plus size={16} />
                            Hedef ekle
                          </button>
                          {saleTargetMessages[item.holding.id] ? (
                            <span className="hero-card__helper">{saleTargetMessages[item.holding.id]}</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="chart-footer">
                    <span>Son güncelleme: {formatDateTime(item.asset?.quote.updatedAt ?? item.holding.updatedAt)}</span>
                    <span>
                      {item.holding.assetType === 'cash'
                        ? 'Hesaba girilen bakiye'
                        : item.missingAsset
                          ? 'Canlı fiyat bekleniyor'
                          : 'Canlı fiyat aktif'}
                    </span>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </Panel>

    </div>
  )
}
