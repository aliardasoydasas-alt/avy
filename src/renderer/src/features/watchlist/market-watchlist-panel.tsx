import { memo, useEffect, useMemo, useState, type DragEvent, type ReactNode } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  GripVertical,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  X
} from 'lucide-react'
import { AssetLogo } from '@renderer/components/asset-logo'
import { Panel } from '@renderer/components/panel'
import { StateCard } from '@renderer/components/state-card'
import { formatCurrency, formatPercent } from '@renderer/utils/format'
import { getMarketStatusLabel } from '@renderer/utils/market-hours'
import type { AssetSnapshot, MarketOverviewItem } from '@shared/types/market'

interface WatchlistTab {
  id: string
  label: string
  items: MarketOverviewItem[]
  isCustom?: boolean
  isPinned?: boolean
}

interface WatchlistContextMenuState {
  x: number
  y: number
  watchlistId: string
  watchlistName: string
}

interface MarketWatchlistPanelProps {
  tabs: WatchlistTab[]
  activeTabId: string
  activeWatchlistId: string
  selectedAssetId: string
  favorites: string[]
  selectedSnapshot?: AssetSnapshot
  searchTerm: string
  searchResults: MarketOverviewItem[]
  isSearchLoading: boolean
  isCollapsed: boolean
  onSearchTermChange: (value: string) => void
  onTabChange: (tabId: string) => void
  onSelectAsset: (assetId: string) => void
  onToggleFavorite: (assetId: string) => void
  onAddToWatchlist: (assetId: string) => void
  onRemoveFromWatchlist: (assetId: string, watchlistId?: string) => void
  onCreateWatchlist: (name: string) => void
  onRenameWatchlist: (watchlistId: string, name: string) => void
  onDeleteWatchlist: (watchlistId: string) => void
  onReorderWatchlistAsset: (watchlistId: string, fromIndex: number, toIndex: number) => void
  onToggleCollapse: () => void
  children?: ReactNode
}

const ROW_HEIGHT = 52
const VIEWPORT_HEIGHT = 332
const OVERSCAN = 6

type WatchlistModalState =
  | { type: 'create' }
  | { type: 'rename'; watchlistId: string; currentName: string }
  | { type: 'delete'; watchlistId: string; currentName: string }
  | null

interface WatchlistRowProps {
  item: MarketOverviewItem
  actualIndex: number
  activeTabId: string
  isCustomTab: boolean
  isSelected: boolean
  isFavorite: boolean
  isCollapsed: boolean
  onSelectAsset: (assetId: string) => void
  onToggleFavorite: (assetId: string) => void
  onRemoveFromWatchlist: (assetId: string, watchlistId?: string) => void
  onReorderWatchlistAsset: (watchlistId: string, fromIndex: number, toIndex: number) => void
}

const WatchlistRow = memo(
  ({
    item,
    actualIndex,
    activeTabId,
    isCustomTab,
    isSelected,
    isFavorite,
    isCollapsed,
    onSelectAsset,
    onToggleFavorite,
    onRemoveFromWatchlist,
    onReorderWatchlistAsset
  }: WatchlistRowProps) => {
    const marketStatus = getMarketStatusLabel(item.profile)
    const isPositive = item.quote.changePercent >= 0

    const handleDrop = (event: DragEvent<HTMLDivElement>) => {
      if (!isCustomTab) {
        return
      }

      event.preventDefault()
      const fromIndex = Number(event.dataTransfer.getData('text/plain'))
      if (Number.isFinite(fromIndex)) {
        onReorderWatchlistAsset(activeTabId, fromIndex, actualIndex)
      }
    }

    return (
      <div
        className={[
          'terminal-watchlist__row',
          isSelected ? 'terminal-watchlist__row--active' : '',
          isCollapsed ? 'terminal-watchlist__row--collapsed' : ''
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ transform: `translateY(${actualIndex * ROW_HEIGHT}px)` }}
        draggable={isCustomTab}
        onDragStart={(event) => {
          if (!isCustomTab) {
            return
          }

          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', String(actualIndex))
        }}
        onDragOver={(event) => {
          if (isCustomTab) {
            event.preventDefault()
          }
        }}
        onDrop={handleDrop}
      >
        <button
          type="button"
          className="terminal-watchlist__row-main"
          onClick={() => onSelectAsset(item.assetId)}
        >
          <AssetLogo profile={item.profile} />
          <span
            className={
              isPositive
                ? 'terminal-watchlist__delta-dot terminal-watchlist__delta-dot--positive'
                : 'terminal-watchlist__delta-dot terminal-watchlist__delta-dot--negative'
            }
          />
          <div className="terminal-watchlist__row-copy">
            <strong>{item.profile.symbol}</strong>
            {!isCollapsed ? <p>{item.profile.name}</p> : null}
          </div>
          <div className="terminal-watchlist__row-price">
            {!isCollapsed ? (
              <strong>{formatCurrency(item.quote.price, item.profile.currency)}</strong>
            ) : null}
            <span
              className={
                marketStatus ? 'terminal-watchlist__market-status' : isPositive ? 'positive-text' : 'negative-text'
              }
            >
              {marketStatus ?? formatPercent(item.quote.changePercent)}
            </span>
          </div>
        </button>

        {isCustomTab ? (
          <div className="terminal-watchlist__row-actions">
            <span className="terminal-watchlist__drag" title="Sürükleyip sırala">
              <GripVertical size={13} />
            </span>
            <button
              type="button"
              className="icon-button terminal-watchlist__favorite"
              onClick={(event) => {
                event.stopPropagation()
                onRemoveFromWatchlist(item.assetId, activeTabId)
              }}
              title="Listeden çıkar"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="icon-button terminal-watchlist__favorite"
            onClick={(event) => {
              event.stopPropagation()
              onToggleFavorite(item.assetId)
            }}
            title="Favori"
          >
            <Star size={13} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>
    )
  }
)

const MarketWatchlistPanelComponent = ({
  tabs,
  activeTabId,
  activeWatchlistId,
  selectedAssetId,
  favorites,
  selectedSnapshot,
  searchTerm,
  searchResults,
  isSearchLoading,
  isCollapsed,
  onSearchTermChange,
  onTabChange,
  onSelectAsset,
  onToggleFavorite,
  onAddToWatchlist,
  onRemoveFromWatchlist,
  onCreateWatchlist,
  onRenameWatchlist,
  onDeleteWatchlist,
  onReorderWatchlistAsset,
  onToggleCollapse,
  children
}: MarketWatchlistPanelProps) => {
  const [scrollTop, setScrollTop] = useState(0)
  const [searchInput, setSearchInput] = useState(searchTerm)
  const [isManageOpen, setIsManageOpen] = useState(false)
  const [modalState, setModalState] = useState<WatchlistModalState>(null)
  const [watchlistNameInput, setWatchlistNameInput] = useState('')
  const [contextMenu, setContextMenu] = useState<WatchlistContextMenuState | null>(null)

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0]
  const items = activeTab?.items ?? []
  const totalHeight = items.length * ROW_HEIGHT
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const endIndex = Math.min(
    items.length,
    startIndex + Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT) + OVERSCAN * 2
  )
  const visibleItems = useMemo(() => items.slice(startIndex, endIndex), [endIndex, items, startIndex])
  const isCustomTab = Boolean(activeTab?.isCustom)
  const pinnedTabs = useMemo(() => tabs.filter((tab) => tab.isPinned), [tabs])
  const customTabs = useMemo(() => tabs.filter((tab) => tab.isCustom), [tabs])
  const addTargetList =
    tabs.find((tab) => tab.id === (isCustomTab ? activeTabId : activeWatchlistId && activeWatchlistId)) ??
    customTabs[0]

  useEffect(() => {
    setScrollTop(0)
  }, [activeTabId])

  useEffect(() => {
    setSearchInput(searchTerm)
  }, [searchTerm])

  useEffect(() => {
    if (!contextMenu) {
      return
    }

    const closeContextMenu = () => setContextMenu(null)

    window.addEventListener('click', closeContextMenu)
    window.addEventListener('blur', closeContextMenu)

    return () => {
      window.removeEventListener('click', closeContextMenu)
      window.removeEventListener('blur', closeContextMenu)
    }
  }, [contextMenu])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (searchInput !== searchTerm) {
        onSearchTermChange(searchInput)
      }
    }, 180)

    return () => window.clearTimeout(timeout)
  }, [onSearchTermChange, searchInput, searchTerm])

  const openCreateModal = () => {
    setWatchlistNameInput('')
    setModalState({ type: 'create' })
    setIsManageOpen(false)
  }

  const openRenameModal = () => {
    if (!isCustomTab || !activeTab) {
      return
    }

    openRenameModalFor(activeTab.id, activeTab.label)
  }

  const openDeleteModal = () => {
    if (!isCustomTab || !activeTab) {
      return
    }

    openDeleteModalFor(activeTab.id, activeTab.label)
  }

  const closeModal = () => {
    setModalState(null)
    setWatchlistNameInput('')
  }

  const openRenameModalFor = (watchlistId: string, currentName: string) => {
    setWatchlistNameInput(currentName)
    setModalState({ type: 'rename', watchlistId, currentName })
    setIsManageOpen(false)
    setContextMenu(null)
  }

  const openDeleteModalFor = (watchlistId: string, currentName: string) => {
    setModalState({ type: 'delete', watchlistId, currentName })
    setIsManageOpen(false)
    setContextMenu(null)
  }

  const submitModal = () => {
    if (!modalState) {
      return
    }

    if (modalState.type === 'create') {
      const value = watchlistNameInput.trim()
      if (!value) {
        return
      }
      onCreateWatchlist(value)
      closeModal()
      return
    }

    if (modalState.type === 'rename') {
      const value = watchlistNameInput.trim()
      if (!value) {
        return
      }
      onRenameWatchlist(modalState.watchlistId, value)
      closeModal()
      return
    }

    if (modalState.type === 'delete') {
      onDeleteWatchlist(modalState.watchlistId)
      closeModal()
    }
  }

  return (
    <div className={isCollapsed ? 'market-right-rail market-right-rail--collapsed' : 'market-right-rail'}>
      <Panel
        title="Watchlist"
        subtitle={activeTab?.label ?? 'Izleme listesi'}
        className="panel--terminal-watchlist"
        action={
          <div className="terminal-watchlist__header-actions">
            <button
              type="button"
              className="icon-button terminal-watchlist__collapse"
              title={isCollapsed ? 'Paneli genislet' : 'Paneli daralt'}
              onClick={onToggleCollapse}
            >
              {isCollapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>
            <button
              type="button"
              className="icon-button"
              title="Liste yonetimi"
              onClick={() => setIsManageOpen((value) => !value)}
            >
              <MoreHorizontal size={14} />
            </button>
          </div>
        }
      >
        <div className="terminal-watchlist__topbar">
          <label className="terminal-search terminal-search--compact">
            <Search size={13} />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Coin veya hisse ara"
            />
            {isSearchLoading ? <LoaderCircle size={13} className="spin" /> : null}
          </label>
          <button
            type="button"
            className="icon-button terminal-watchlist__new-list"
            title="Yeni liste"
            onClick={openCreateModal}
          >
            <Plus size={14} />
          </button>
        </div>

        {isManageOpen ? (
          <div className="terminal-watchlist__menu">
            <button type="button" className="terminal-watchlist__menu-item" onClick={openCreateModal}>
              <Plus size={14} />
              <span>Yeni liste oluştur</span>
            </button>
            <button
              type="button"
              className="terminal-watchlist__menu-item"
              onClick={openRenameModal}
              disabled={!isCustomTab}
            >
              <Pencil size={14} />
              <span>Listeyi yeniden adlandır</span>
            </button>
            <button
              type="button"
              className="terminal-watchlist__menu-item terminal-watchlist__menu-item--danger"
              onClick={openDeleteModal}
              disabled={!isCustomTab}
            >
              <Trash2 size={14} />
              <span>Listeyi sil</span>
            </button>
          </div>
        ) : null}

        <div className="terminal-watchlist__tabs terminal-watchlist__tabs--pinned">
          {pinnedTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={tab.id === activeTabId ? 'chip chip--active chip--watchlist' : 'chip chip--watchlist'}
              onClick={() => onTabChange(tab.id)}
              title={tab.label}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {customTabs.length ? (
          <div className="terminal-watchlist__tabs terminal-watchlist__tabs--compact">
            {customTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={tab.id === activeTabId ? 'chip chip--active chip--watchlist' : 'chip chip--watchlist'}
                onClick={() => onTabChange(tab.id)}
              onContextMenu={(event) => {
                event.preventDefault()
                onTabChange(tab.id)
                setIsManageOpen(false)
                setContextMenu({
                  x: event.clientX,
                  y: event.clientY,
                  watchlistId: tab.id,
                  watchlistName: tab.label
                })
              }}
              title={tab.label}
            >
              {tab.label}
            </button>
            ))}
          </div>
        ) : null}

        {!searchInput.trim() && addTargetList ? (
          <div className="terminal-watchlist__target">
            <span>Yeni varliklar su listeye eklenir</span>
            <strong>{addTargetList.label}</strong>
          </div>
        ) : null}

        {searchInput.trim() ? (
          <div className="terminal-search-results terminal-search-results--compact">
            {searchResults.length ? (
              searchResults.slice(0, 8).map((item) => (
                <div key={item.assetId} className="terminal-search-results__row terminal-search-results__row--compact">
                  <button
                    type="button"
                    className="terminal-search-results__main"
                    onClick={() => onSelectAsset(item.assetId)}
                  >
                    <AssetLogo profile={item.profile} />
                    <div>
                      <strong>{item.profile.symbol}</strong>
                      <p>{item.profile.name}</p>
                    </div>
                  </button>
                  <div className="terminal-search-results__actions">
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => onAddToWatchlist(item.assetId)}
                      title={addTargetList ? `${addTargetList.label} listesine ekle` : 'Listeye ekle'}
                    >
                      <Plus size={13} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => onToggleFavorite(item.assetId)}
                      title="Favori"
                    >
                      <Star size={13} fill={favorites.includes(item.assetId) ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <StateCard title="Sonuc yok" description="Aramana uygun varlik bulunamadi." />
            )}
          </div>
        ) : (
          <>
            <div className="terminal-watchlist__viewport" onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
              {items.length ? (
                <div className="terminal-watchlist__spacer" style={{ height: totalHeight || VIEWPORT_HEIGHT }}>
                  {visibleItems.map((item, index) => {
                    const actualIndex = startIndex + index
                    return (
                      <WatchlistRow
                        key={item.assetId}
                        item={item}
                        actualIndex={actualIndex}
                        activeTabId={activeTabId}
                        isCustomTab={isCustomTab}
                        isSelected={item.assetId === selectedAssetId}
                        isFavorite={favorites.includes(item.assetId)}
                        isCollapsed={isCollapsed}
                        onSelectAsset={onSelectAsset}
                        onToggleFavorite={onToggleFavorite}
                        onRemoveFromWatchlist={onRemoveFromWatchlist}
                        onReorderWatchlistAsset={onReorderWatchlistAsset}
                      />
                    )
                  })}
                </div>
              ) : (
                <div className="terminal-watchlist__empty">
                  <StateCard
                    title="Bu liste bos"
                    description="Aramadan varlik ekleyerek watchlist'ini doldurabilirsin."
                  />
                </div>
              )}
            </div>

            {!isCollapsed && selectedSnapshot ? (
              <div className="terminal-selected-asset-card terminal-selected-asset-card--compact">
                <div className="list-card__header">
                  <div className="mini-list__label">
                    <AssetLogo profile={selectedSnapshot.profile} size="md" />
                    <div>
                      <strong>{selectedSnapshot.profile.symbol}</strong>
                      <p>{selectedSnapshot.profile.name}</p>
                    </div>
                  </div>
                  <span className={selectedSnapshot.quote.changePercent >= 0 ? 'positive-text' : 'negative-text'}>
                    {formatPercent(selectedSnapshot.quote.changePercent)}
                  </span>
                </div>
                <div className="meta-row">
                  <span>{selectedSnapshot.profile.exchange}</span>
                  <strong>{formatCurrency(selectedSnapshot.quote.price, selectedSnapshot.profile.currency)}</strong>
                </div>
              </div>
            ) : null}
          </>
        )}
      </Panel>

      {!isCollapsed ? children : null}

      {contextMenu ? (
        <div
          className="terminal-watchlist-context-menu"
          style={{
            left: contextMenu.x,
            top: contextMenu.y
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="terminal-watchlist__menu-item"
            onClick={() => openRenameModalFor(contextMenu.watchlistId, contextMenu.watchlistName)}
          >
            <Pencil size={14} />
            <span>Duzenle</span>
          </button>
          <button
            type="button"
            className="terminal-watchlist__menu-item terminal-watchlist__menu-item--danger"
            onClick={() => openDeleteModalFor(contextMenu.watchlistId, contextMenu.watchlistName)}
          >
            <Trash2 size={14} />
            <span>Sil</span>
          </button>
        </div>
      ) : null}

      {modalState ? (
        <div className="terminal-watchlist-modal__backdrop" onClick={closeModal}>
          <div className="terminal-watchlist-modal" onClick={(event) => event.stopPropagation()}>
            <div className="terminal-watchlist-modal__header">
              <div>
                <strong>
                  {modalState.type === 'create'
                    ? 'Yeni liste'
                    : modalState.type === 'rename'
                      ? 'Listeyi yeniden adlandir'
                      : 'Listeyi sil'}
                </strong>
                <p>
                  {modalState.type === 'delete'
                    ? `"${modalState.currentName}" listesini silmek istedigine emin misin?`
                    : 'Watchlist yonetimini buradan tamamlayabilirsin.'}
                </p>
              </div>
              <button type="button" className="icon-button" onClick={closeModal} title="Kapat">
                <X size={14} />
              </button>
            </div>

            {modalState.type === 'delete' ? (
              <div className="terminal-watchlist-modal__body">
                <p className="terminal-watchlist-modal__danger">
                  Liste silinince icindeki siralama da gider. Varliklar marketten silinmez.
                </p>
              </div>
            ) : (
              <div className="terminal-watchlist-modal__body">
                <label className="field-stack">
                  <span>Liste adi</span>
                  <input
                    autoFocus
                    value={watchlistNameInput}
                    onChange={(event) => setWatchlistNameInput(event.target.value)}
                    placeholder="Ornek: Swing takip"
                  />
                </label>
              </div>
            )}

            <div className="terminal-watchlist-modal__footer">
              <button type="button" className="chip" onClick={closeModal}>
                Vazgec
              </button>
              <button
                type="button"
                className={modalState.type === 'delete' ? 'chip chip--danger' : 'chip chip--active'}
                onClick={submitModal}
                disabled={modalState.type !== 'delete' && !watchlistNameInput.trim()}
              >
                {modalState.type === 'delete' ? 'Listeyi sil' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export const MarketWatchlistPanel = memo(MarketWatchlistPanelComponent)
