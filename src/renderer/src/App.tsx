import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { AyLogo } from '@renderer/components/ay-logo'
import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import { AudioFeedbackBridge } from '@renderer/components/audio-feedback-bridge'
import { IntroSplash } from '@renderer/components/intro-splash'
import { StateCard } from '@renderer/components/state-card'
import { AiDashboard } from '@renderer/features/ai/ai-dashboard'
import { ChartPanel } from '@renderer/features/asset/chart-panel'
import { TerminalAnalysisRail } from '@renderer/features/asset/terminal-analysis-rail'
import { TerminalAssetBar } from '@renderer/features/asset/terminal-asset-bar'
import { StartupAuthScreen } from '@renderer/features/auth/startup-auth-screen'
import { HighlightsDashboard } from '@renderer/features/highlights/highlights-dashboard'
import { InvestorsDashboard } from '@renderer/features/investors/investors-dashboard'
import { ProfileDashboard, ProfileSidebar } from '@renderer/features/profile/profile-dashboard'
import { TopToolbar } from '@renderer/features/shell/top-toolbar'
import { MarketWatchlistPanel } from '@renderer/features/watchlist/market-watchlist-panel'
import { useCloudAccountSync } from '@renderer/hooks/use-cloud-account-sync'
import { useAiHubData } from '@renderer/hooks/use-ai-hub-data'
import { useHoldingSaleTargets } from '@renderer/hooks/use-holding-sale-targets'
import { useLivePortfolioNotifications } from '@renderer/hooks/use-live-portfolio-notifications'
import { usePortfolioSummary } from '@renderer/hooks/use-portfolio-data'
import { useSocialCloud } from '@renderer/hooks/use-social-cloud'
import {
  useAssetDetailQuery,
  useAssetNewsQuery,
  useAssetSearchQuery,
  useHomeExternalPulseQuery,
  useMarketOverviewQuery,
  useRealtimeMarketStream
} from '@renderer/hooks/use-market-data'
import { buildAiInsight } from '@renderer/services/ai-insight-engine'
import { buildAssetIntelligence } from '@renderer/services/asset-intelligence-engine'
import { buildTopDecliners, buildTopMovers } from '@renderer/services/highlights-service'
import { buildHomePulseItems } from '@renderer/services/home-data-service'
import { buildIndicatorSnapshot } from '@renderer/services/indicator-engine'
import { sendLiveNotificationTest as sendLiveNotificationTestMessage } from '@renderer/services/live-notification-service'
import { detectAllPatterns } from '@renderer/services/pattern-detector'
import { useSettingsStore } from '@renderer/store/use-settings-store'
import { useSocialProfileStore } from '@renderer/store/use-social-profile-store'
import { useSocialStore } from '@renderer/store/use-social-store'
import { useTerminalStore } from '@renderer/store/use-terminal-store'
import type { MarketOverviewItem } from '@shared/types/market'
import type { PortfolioRange } from '@shared/types/portfolio'
import type { ChartDrawing } from '@shared/types/chart'

const definedOverviewItem = (
  item: MarketOverviewItem | undefined
): item is MarketOverviewItem => Boolean(item)

const EMPTY_DRAWINGS: ChartDrawing[] = []

const App = () => {
  const [introVisible, setIntroVisible] = useState(true)
  const [authCheckTimedOut, setAuthCheckTimedOut] = useState(false)
  const [portfolioRange, setPortfolioRange] = useState<PortfolioRange>('30D')
  const [isPortfolioRefreshing, setIsPortfolioRefreshing] = useState(false)
  const [activeMarketTabId, setActiveMarketTabId] = useState('crypto')
  const [isMarketPanelCollapsed, setIsMarketPanelCollapsed] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 900 : false
  )
  const [mobileTerminalTab, setMobileTerminalTab] = useState<'watchlist' | 'analysis'>('watchlist')
  const socialFeaturesEnabled = false
  const queryClient = useQueryClient()

  const activeScreen = useTerminalStore((state) => state.activeScreen)
  const profileSection = useTerminalStore((state) => state.profileSection)
  const selectedAssetId = useTerminalStore((state) => state.selectedAssetId)
  const selectedTimeframe = useTerminalStore((state) => state.selectedTimeframe)
  const chartViewId = `${selectedAssetId}:${selectedTimeframe}`
  const activeWatchlistId = useTerminalStore((state) => state.activeWatchlistId)
  const searchTerm = useTerminalStore((state) => state.searchTerm)
  const watchlists = useTerminalStore((state) => state.watchlists)
  const favorites = useTerminalStore((state) => state.favorites)
  const recentAssetIds = useTerminalStore((state) => state.recentAssetIds)
  const alerts = useTerminalStore((state) => state.alerts)
  const alertHistory = useTerminalStore((state) => state.alertHistory)
  const notifications = useTerminalStore((state) => state.notifications)
  const patternNotificationSettings = useTerminalStore((state) => state.patternNotificationSettings)
  const indicatorToggles = useTerminalStore((state) => state.indicatorToggles)
  const setActiveScreen = useTerminalStore((state) => state.setActiveScreen)
  const setProfileSection = useTerminalStore((state) => state.setProfileSection)
  const openProfileSection = useTerminalStore((state) => state.openProfileSection)
  const setSelectedAsset = useTerminalStore((state) => state.setSelectedAsset)
  const setSelectedTimeframe = useTerminalStore((state) => state.setSelectedTimeframe)
  const setActiveWatchlist = useTerminalStore((state) => state.setActiveWatchlist)
  const setSearchTerm = useTerminalStore((state) => state.setSearchTerm)
  const createWatchlist = useTerminalStore((state) => state.createWatchlist)
  const renameWatchlist = useTerminalStore((state) => state.renameWatchlist)
  const deleteWatchlist = useTerminalStore((state) => state.deleteWatchlist)
  const addAssetToWatchlist = useTerminalStore((state) => state.addAssetToWatchlist)
  const removeAssetFromWatchlist = useTerminalStore((state) => state.removeAssetFromWatchlist)
  const reorderWatchlistAsset = useTerminalStore((state) => state.reorderWatchlistAsset)
  const toggleFavorite = useTerminalStore((state) => state.toggleFavorite)
  const addAlert = useTerminalStore((state) => state.addAlert)
  const toggleAlert = useTerminalStore((state) => state.toggleAlert)
  const markNotificationRead = useTerminalStore((state) => state.markNotificationRead)
  const markAllNotificationsRead = useTerminalStore((state) => state.markAllNotificationsRead)
  const selectedChartDrawings =
    useTerminalStore((state) => state.chartDrawings[chartViewId]) ?? EMPTY_DRAWINGS
  const addChartDrawing = useTerminalStore((state) => state.addChartDrawing)
  const setChartDrawings = useTerminalStore((state) => state.setChartDrawings)
  const removeLastChartDrawing = useTerminalStore((state) => state.removeLastChartDrawing)
  const clearChartDrawings = useTerminalStore((state) => state.clearChartDrawings)
  const setPatternNotification = useTerminalStore((state) => state.setPatternNotification)
  const setIndicatorToggle = useTerminalStore((state) => state.setIndicatorToggle)

  const currentUser = useSocialStore((state) => state.currentUser)
  const updateProfile = useSocialStore((state) => state.updateProfile)
  const updateAvatar = useSocialStore((state) => state.updateAvatar)
  const tradeJournal = useSocialProfileStore((state) => state.tradeJournal)
  const showcase = useSocialProfileStore((state) => state.showcase)
  const hydrateShowcase = useSocialProfileStore((state) => state.hydrateShowcase)
  const setWallpaper = useSocialProfileStore((state) => state.setWallpaper)
  const setBackgroundPreset = useSocialProfileStore((state) => state.setBackgroundPreset)
  const settings = useSettingsStore((state) => state.settings)
  const setNotificationPreference = useSettingsStore((state) => state.setNotificationPreference)
  const setSoundPreference = useSettingsStore((state) => state.setSoundPreference)
  const setPortfolioVisibility = useSettingsStore((state) => state.setPortfolioVisibility)
  const setThemeMode = useSettingsStore((state) => state.setThemeMode)
  const setLiveNotificationSetting = useSettingsStore((state) => state.setLiveNotificationSetting)

  const deferredSearchTerm = useDeferredValue(searchTerm)
  const isTerminalWorkspace = activeScreen === 'home' || activeScreen === 'asset'
  const isAiScreen = activeScreen === 'ai'
  const isHighlightsScreen = activeScreen === 'highlights'
  const isInvestorsScreen = activeScreen === 'investors'
  const isProfileScreen = activeScreen === 'profile'
  const usesWideShell = !isProfileScreen

  const overviewQuery = useMarketOverviewQuery()
  const searchQuery = useAssetSearchQuery(deferredSearchTerm)
  const detailQuery = useAssetDetailQuery(selectedAssetId, selectedTimeframe, isTerminalWorkspace)
  const newsQuery = useAssetNewsQuery(selectedAssetId, isTerminalWorkspace)
  const homeExternalPulseQuery = useHomeExternalPulseQuery(
    activeScreen === 'home' || activeScreen === 'ai'
  )

  const overviewItems = overviewQuery.data ?? []
  const deferredOverviewItems = useDeferredValue(overviewItems)
  const searchResults = searchQuery.data ?? []
  const homePulseItems = useMemo(() => {
    if (activeScreen !== 'home' && !isAiScreen) {
      return []
    }

    try {
      return buildHomePulseItems(deferredOverviewItems, homeExternalPulseQuery.data)
    } catch (error) {
      console.error('AVY home pulse build failed', error)
      return []
    }
  }, [activeScreen, deferredOverviewItems, homeExternalPulseQuery.data, isAiScreen])
  const topMovers = useMemo(() => {
    if (!isHighlightsScreen && activeMarketTabId !== 'highlights') {
      return []
    }

    try {
      return buildTopMovers(deferredOverviewItems, 20)
    } catch (error) {
      console.error('AVY highlights build failed', error)
      return []
    }
  }, [activeMarketTabId, deferredOverviewItems, isHighlightsScreen])
  const topDecliners = useMemo(() => {
    if (!isHighlightsScreen && activeMarketTabId !== 'highlights') {
      return []
    }

    try {
      return buildTopDecliners(deferredOverviewItems, 20)
    } catch (error) {
      console.error('AVY decliners build failed', error)
      return []
    }
  }, [activeMarketTabId, deferredOverviewItems, isHighlightsScreen])
  const overviewMap = useMemo(
    () => new Map(overviewItems.map((item) => [item.assetId, item])),
    [overviewItems]
  )
  const selectedOverviewItem = overviewMap.get(selectedAssetId)
  const activeWatchlist = watchlists.find((watchlist) => watchlist.id === activeWatchlistId) ?? watchlists[0]
  const favoriteItems = favorites.map((assetId) => overviewMap.get(assetId)).filter(definedOverviewItem)
  const watchlistItemsById = Object.fromEntries(
    watchlists.map((watchlist) => [
      watchlist.id,
      watchlist.assetIds.map((assetId) => overviewMap.get(assetId)).filter(definedOverviewItem)
    ])
  ) as Record<string, MarketOverviewItem[]>
  const portfolio = usePortfolioSummary(
    isProfileScreen || isAiScreen ? overviewItems : deferredOverviewItems,
    portfolioRange
  )
  const holdingAssetIds = useMemo(
    () =>
      portfolio.summary.holdings
        .filter((item) => item.holding.assetType !== 'cash')
        .map((item) => item.holding.assetId)
        .slice(0, 12),
    [portfolio.summary.holdings]
  )
  const streamedAssetIds = useMemo(() => {
    const visibleIds = new Set<string>()
    const addIds = (ids: Array<string | undefined>, limit?: number) => {
      ids
        .filter((value): value is string => Boolean(value))
        .slice(0, limit)
        .forEach((value) => visibleIds.add(value))
    }

    addIds([selectedAssetId], 1)

    if (isTerminalWorkspace || activeScreen === 'asset') {
      addIds([selectedAssetId], 1)
    } else if (activeScreen === 'profile') {
      addIds(holdingAssetIds, 12)
    } else if (activeScreen === 'highlights') {
      addIds(topMovers.map((item) => item.assetId), 4)
      addIds(topDecliners.map((item) => item.assetId), 4)
    } else if (activeScreen === 'ai') {
      addIds(favorites, 4)
      addIds(recentAssetIds, 2)
    } else {
      addIds(activeWatchlist?.assetIds ?? [], 4)
      addIds(favorites, 2)
      addIds(recentAssetIds, 2)
    }

    return Array.from(visibleIds)
  }, [
    activeScreen,
    favorites,
    holdingAssetIds,
    isTerminalWorkspace,
    recentAssetIds,
    selectedAssetId,
    topDecliners,
    topMovers
  ])

  useRealtimeMarketStream(
    streamedAssetIds,
    isTerminalWorkspace ? selectedAssetId : '',
    selectedTimeframe
  )

  const selectedSnapshot = detailQuery.data
  const [analysisSnapshot, setAnalysisSnapshot] = useState(selectedSnapshot)
  const analysisViewKeyRef = useRef('')

  useEffect(() => {
    const nextViewKey = `${selectedAssetId}:${selectedTimeframe}`

    if (!selectedSnapshot) {
      setAnalysisSnapshot(undefined)
      analysisViewKeyRef.current = nextViewKey
      return
    }

    const previousLastTime = analysisSnapshot?.candles[analysisSnapshot.candles.length - 1]?.time
    const nextLastTime = selectedSnapshot.candles[selectedSnapshot.candles.length - 1]?.time
    const shouldApplyImmediately =
      analysisViewKeyRef.current !== nextViewKey ||
      !analysisSnapshot ||
      analysisSnapshot.profile.id !== selectedSnapshot.profile.id ||
      analysisSnapshot.candles.length !== selectedSnapshot.candles.length ||
      previousLastTime !== nextLastTime

    if (shouldApplyImmediately) {
      analysisViewKeyRef.current = nextViewKey
      setAnalysisSnapshot(selectedSnapshot)
      return
    }

    const timeout = window.setTimeout(() => {
      analysisViewKeyRef.current = nextViewKey
      setAnalysisSnapshot(selectedSnapshot)
    }, 2600)

    return () => window.clearTimeout(timeout)
  }, [analysisSnapshot, selectedAssetId, selectedSnapshot, selectedTimeframe])
  const chartSnapshot = analysisSnapshot ?? selectedSnapshot

  const enabledPatternTypes = useMemo(
    () =>
      (Object.entries(patternNotificationSettings) as Array<[keyof typeof patternNotificationSettings, boolean]>)
        .filter(([, enabled]) => enabled)
        .map(([pattern]) => pattern),
    [patternNotificationSettings]
  )
  const selectedPatterns = useMemo(() => {
    if (!analysisSnapshot || !enabledPatternTypes.length) {
      return []
    }

    try {
      return detectAllPatterns(analysisSnapshot.candles, enabledPatternTypes)
    } catch (error) {
      console.error('AVY pattern detection failed', error)
      return []
    }
  }, [analysisSnapshot, enabledPatternTypes])
  const selectedIndicators = useMemo(() => {
    if (!analysisSnapshot) {
      return null
    }

    try {
      return buildIndicatorSnapshot(analysisSnapshot.candles)
    } catch (error) {
      console.error('AVY indicator calculation failed', error)
      return null
    }
  }, [analysisSnapshot])
  const selectedAiInsight = useMemo(() => {
    if (!analysisSnapshot || !selectedIndicators) {
      return null
    }

    try {
      return buildAiInsight(analysisSnapshot, selectedIndicators, selectedPatterns)
    } catch (error) {
      console.error('AVY AI insight calculation failed', error)
      return null
    }
  }, [analysisSnapshot, selectedIndicators, selectedPatterns])
  const unreadNotifications = notifications.filter((notification) => !notification.read).length
  const assetAlerts = alerts.filter((alert) => alert.assetId === selectedAssetId)
  const aiHub = useAiHubData({
    overviewItems,
    favoriteAssetIds: favorites,
    recentAssetIds,
    portfolioSummary: portfolio.summary,
    macroPulseItems: homePulseItems,
    enabled: isAiScreen || activeMarketTabId === 'ai-watchlist'
  })
  const publicListNames = useMemo(() => watchlists.map((watchlist) => watchlist.name), [watchlists])
  const publicHoldings = useMemo(
    () =>
      settings.portfolioVisibility === 'private'
        ? []
        : portfolio.summary.holdings.slice(0, 12).map((item) => ({
            assetId: item.holding.assetId,
            symbol: item.holding.assetSymbol,
            name: item.holding.assetName,
            amount: item.holding.amount,
            totalValueTry: item.totalValueTry,
            dailyChangePercent: item.dailyChangePercent
          })),
    [portfolio.summary.holdings, settings.portfolioVisibility]
  )
  const social = useSocialCloud({
    currentUser,
    publicAssetIds: favorites,
    publicListNames,
    publicHoldings,
    portfolioVisibility: settings.portfolioVisibility,
    tradeJournal,
    showcase,
    socialFeaturesEnabled,
    onHydrateProfile: ({ username, displayName, bio, avatarDataUrl, showcase: nextShowcase }) => {
      updateProfile({ username, displayName, bio })
      updateAvatar(avatarDataUrl)
      hydrateShowcase(nextShowcase)
    }
  })
  const cloudSync = useCloudAccountSync({
    client: social.client,
    sessionUserId: social.sessionUserId,
    enabled: Boolean(social.sessionUserId && social.client)
  })
  const selectedAssetIntelligence = useMemo(() => {
    if (!analysisSnapshot || !selectedIndicators || !selectedAiInsight) {
      return null
    }

    try {
      return buildAssetIntelligence({
        snapshot: analysisSnapshot,
        indicators: selectedIndicators,
        patterns: selectedPatterns,
        insight: selectedAiInsight,
        news: newsQuery.data ?? [],
        overviewItems,
        friends: socialFeaturesEnabled ? social.contacts : []
      })
    } catch (error) {
      console.error('AVY asset intelligence calculation failed', error)
      return null
    }
  }, [analysisSnapshot, newsQuery.data, overviewItems, selectedAiInsight, selectedIndicators, selectedPatterns, social.contacts, socialFeaturesEnabled])
  const cryptoItems = useMemo(
    () =>
      [...overviewItems]
        .filter((item) => item.profile.class === 'crypto')
        .sort((left, right) => right.quote.volume - left.quote.volume),
    [overviewItems]
  )
  const stockItems = useMemo(
    () =>
      [...overviewItems]
        .filter((item) => item.profile.class === 'stock')
        .sort((left, right) => right.quote.volume - left.quote.volume),
    [overviewItems]
  )
  const aiWatchlistItems = useMemo(
    () =>
      (isAiScreen || activeMarketTabId === 'ai-watchlist'
        ? aiHub.watchlist.map((item) => overviewMap.get(item.assetId)).filter(definedOverviewItem)
        : []),
    [activeMarketTabId, aiHub.watchlist, isAiScreen, overviewMap]
  )
  const highlightItems = useMemo(() => {
    const merged = new Map<string, MarketOverviewItem>()
    ;[...topMovers.slice(0, 10), ...topDecliners.slice(0, 10)].forEach((item) => {
      merged.set(item.assetId, item)
    })
    return Array.from(merged.values())
  }, [topDecliners, topMovers])
  const marketTabs = useMemo(
    () => [
      { id: 'crypto', label: 'Kripto', items: cryptoItems, isPinned: true },
      { id: 'stocks', label: 'Hisse', items: stockItems, isPinned: true },
      { id: 'ai-watchlist', label: 'AI Tavsiyesi', items: aiWatchlistItems, isPinned: true },
      ...watchlists.map((watchlist) => ({
        id: watchlist.id,
        label: watchlist.name,
        items: watchlistItemsById[watchlist.id] ?? [],
        isCustom: true
      }))
    ],
    [aiWatchlistItems, cryptoItems, stockItems, watchlistItemsById, watchlists]
  )
  const liveNotifications = useMemo(
    () => notifications.filter((notification) => notification.scope === 'live'),
    [notifications]
  )

  useEffect(() => {
    if (marketTabs.some((tab) => tab.id === activeMarketTabId)) {
      return
    }

    if (activeWatchlistId && marketTabs.some((tab) => tab.id === activeWatchlistId)) {
      setActiveMarketTabId(activeWatchlistId)
      return
    }

    setActiveMarketTabId(marketTabs[0]?.id ?? 'crypto')
  }, [activeMarketTabId, activeWatchlistId, marketTabs])

  useEffect(() => {
    if (selectedTimeframe !== '1s') {
      return
    }

    if (selectedOverviewItem?.profile.class === 'crypto') {
      return
    }

    setSelectedTimeframe('1m')
  }, [selectedOverviewItem?.profile.class, selectedTimeframe, setSelectedTimeframe])

  useLivePortfolioNotifications({
    summary: portfolio.summary,
    settings: settings.liveNotifications,
    enabled: Boolean(social.sessionUserId)
  })
  useHoldingSaleTargets({
    summary: portfolio.summary
  })

  const refreshPortfolioLiveData = useCallback(async () => {
    setIsPortfolioRefreshing(true)

    try {
      await Promise.all([
        overviewQuery.refetch(),
        portfolio.fxQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ['market-overview'] })
      ])
    } finally {
      window.setTimeout(() => {
        setIsPortfolioRefreshing(false)
      }, 350)
    }
  }, [overviewQuery, portfolio.fxQuery, queryClient])

  const handleSelectAsset = useCallback(
    (assetId: string) => {
      setSelectedAsset(assetId)
      if (searchTerm) {
        setSearchTerm('')
      }
    },
    [searchTerm, setSearchTerm, setSelectedAsset]
  )

  const handleChangeMarketTab = useCallback(
    (tabId: string) => {
      setActiveMarketTabId(tabId)
      if (watchlists.some((watchlist) => watchlist.id === tabId)) {
        setActiveWatchlist(tabId)
      }
    },
    [setActiveWatchlist, watchlists]
  )

  const handleCreateResistanceAlert = useCallback(() => {
    if (!selectedIndicators || !selectedSnapshot) {
      return
    }

    addAlert({
      assetId: selectedSnapshot.profile.id,
      label: `${selectedSnapshot.profile.symbol} direnç alarmı`,
      type: 'price_above',
      referencePrice: selectedIndicators.resistance
    })
  }, [addAlert, selectedIndicators, selectedSnapshot])

  const handleCreateSupportAlert = useCallback(() => {
    if (!selectedIndicators || !selectedSnapshot) {
      return
    }

    addAlert({
      assetId: selectedSnapshot.profile.id,
      label: `${selectedSnapshot.profile.symbol} destek alarmı`,
      type: 'price_below',
      referencePrice: selectedIndicators.support
    })
  }, [addAlert, selectedIndicators, selectedSnapshot])

  const handleCreateMomentumAlert = useCallback(() => {
    if (!selectedSnapshot) {
      return
    }

    addAlert({
      assetId: selectedSnapshot.profile.id,
      label: `${selectedSnapshot.profile.symbol} %3 yükseliş alarmı`,
      type: 'percent_up',
      threshold: 3
    })
  }, [addAlert, selectedSnapshot])

  const handleCreatePullbackAlert = useCallback(() => {
    if (!selectedSnapshot) {
      return
    }

    addAlert({
      assetId: selectedSnapshot.profile.id,
      label: `${selectedSnapshot.profile.symbol} %3 düşüş alarmı`,
      type: 'percent_down',
      threshold: 3
    })
  }, [addAlert, selectedSnapshot])

  const handleSendLiveNotificationTest = useCallback(async () => {
    if (!settings.liveNotifications.ntfyTopic.trim()) {
      useTerminalStore.getState().pushNotification({
        title: 'Canlı bildirim konusu eksik',
        message: 'Telefonuna test göndermek için önce canlı bildirim konusu gir.',
        timestamp: new Date().toISOString(),
        scope: 'system',
        dedupeKey: 'system:missing-live-topic'
      })
      return
    }

    await sendLiveNotificationTestMessage(settings.liveNotifications)
    useTerminalStore.getState().pushNotification({
      title: 'Telefon bildirimi test edildi',
      message:
        'Telefon kanalına bir test bildirimi yollandı. ntfy uygulamasında aynı konuya aboneysen telefonunda görünür.',
      timestamp: new Date().toISOString(),
      scope: 'live',
      dedupeKey: `live:test:${new Date().toISOString().slice(0, 13)}`
    })
  }, [settings.liveNotifications])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setIntroVisible(false)
    }, 1700)

    return () => window.clearTimeout(timeout)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = settings.themeMode
    document.body.dataset.theme = settings.themeMode
  }, [settings.themeMode])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)')
    const syncViewport = () => setIsMobileViewport(media.matches)

    syncViewport()
    media.addEventListener('change', syncViewport)

    return () => media.removeEventListener('change', syncViewport)
  }, [])

  useEffect(() => {
    if (!socialFeaturesEnabled && activeScreen === 'social') {
      setActiveScreen('home')
    }
  }, [activeScreen, setActiveScreen, socialFeaturesEnabled])

  useEffect(() => {
    if (
      introVisible ||
      !social.isConfigured ||
      !social.isSessionLoading ||
      Boolean(social.sessionUserId)
    ) {
      setAuthCheckTimedOut(false)
      return
    }

    const timeout = window.setTimeout(() => {
      setAuthCheckTimedOut(true)
    }, 8500)

    return () => window.clearTimeout(timeout)
  }, [introVisible, social.isConfigured, social.isSessionLoading, social.sessionUserId])

  if (introVisible) {
    return <IntroSplash />
  }

  if (!social.sessionUserId) {
    return (
      <StartupAuthScreen
        isConfigured={social.isConfigured}
        isCheckingSession={social.isSessionLoading && !authCheckTimedOut}
        isBusy={social.isBusy}
        statusMessage={social.statusMessage}
        errorMessage={
          authCheckTimedOut
            ? 'Oturum kontrolü beklenenden uzun sürdü. Giriş ekranını açtık; istersen yeniden giriş yapabilirsin.'
            : social.errorMessage
        }
        onAuthenticate={social.authenticate}
      />
    )
  }

  const terminalCenter =
    detailQuery.isError ? (
      <StateCard title="Varlık yüklenemedi" description="Seçilen enstrüman aktif veri kaynağından alınamadı." />
    ) : detailQuery.isLoading || !selectedSnapshot || !chartSnapshot || !selectedIndicators ? (
      <StateCard title="Terminal hazırlanıyor" description="Grafik, zaman aralıkları ve analiz modülleri yükleniyor." />
    ) : (
      <div className="terminal-center-stack">
        <TerminalAssetBar
          snapshot={selectedSnapshot}
          liveQuote={selectedOverviewItem?.quote}
          isFavorite={favorites.includes(selectedSnapshot.profile.id)}
          unreadNotifications={unreadNotifications}
          aiTitle={selectedAiInsight?.title}
          onToggleFavorite={toggleFavorite}
        />
        <ChartPanel
          snapshot={chartSnapshot}
          patterns={selectedPatterns}
          indicators={selectedIndicators}
          news={newsQuery.data ?? []}
          drawings={selectedChartDrawings}
          selectedTimeframe={selectedTimeframe}
          canPublishAnalysis={false}
          shareableFriends={[]}
          onTimeframeChange={setSelectedTimeframe}
          onAddDrawing={addChartDrawing}
          onSetDrawings={setChartDrawings}
          onRemoveLastDrawing={removeLastChartDrawing}
          onClearDrawings={clearChartDrawings}
          onPublishAnalysis={async () => {
            throw new Error('Grafik paylaşımı şu an kapalı.')
          }}
          onShareAnalysisToFriend={async () => {
            throw new Error('Arkadaşa paylaşım şu an kapalı.')
          }}
        />
      </div>
    )

  const analysisRailContent =
    selectedSnapshot && selectedIndicators ? (
      <TerminalAnalysisRail
        snapshot={selectedSnapshot}
        liveQuote={selectedOverviewItem?.quote}
        indicators={selectedIndicators}
        insight={selectedAiInsight}
        intelligence={selectedAssetIntelligence}
        newsCount={newsQuery.data?.length ?? 0}
        alerts={assetAlerts}
        onCreateResistanceAlert={handleCreateResistanceAlert}
        onCreateSupportAlert={handleCreateSupportAlert}
        onCreateMomentumAlert={handleCreateMomentumAlert}
        onCreatePullbackAlert={handleCreatePullbackAlert}
      />
    ) : (
      <StateCard
        title="Sağ panel hazır"
        description="Bir varlık seçtiğinde kısa analiz, alarm kısayolları ve haber etkisi burada görünür."
      />
    )

  const terminalRightRail = (
    <MarketWatchlistPanel
      tabs={marketTabs}
      activeTabId={activeMarketTabId}
      activeWatchlistId={activeWatchlistId}
      selectedAssetId={selectedAssetId}
      favorites={favorites}
      selectedSnapshot={selectedSnapshot}
      searchTerm={searchTerm}
      searchResults={searchResults}
      isSearchLoading={searchQuery.isLoading}
      isCollapsed={isMarketPanelCollapsed}
      onSearchTermChange={setSearchTerm}
      onTabChange={handleChangeMarketTab}
      onSelectAsset={handleSelectAsset}
      onToggleFavorite={toggleFavorite}
      onAddToWatchlist={addAssetToWatchlist}
      onRemoveFromWatchlist={removeAssetFromWatchlist}
      onCreateWatchlist={createWatchlist}
      onRenameWatchlist={renameWatchlist}
      onDeleteWatchlist={deleteWatchlist}
      onReorderWatchlistAsset={reorderWatchlistAsset}
      onToggleCollapse={() => setIsMarketPanelCollapsed((value) => !value)}
    >
      {analysisRailContent}
    </MarketWatchlistPanel>
  )

  const mobileTerminalRail = (
    <section className="mobile-terminal-panels">
      <div className="mobile-terminal-panels__tabs">
        <button
          type="button"
          className={mobileTerminalTab === 'watchlist' ? 'chip chip--active' : 'chip'}
          onClick={() => setMobileTerminalTab('watchlist')}
        >
          Listeler
        </button>
        <button
          type="button"
          className={mobileTerminalTab === 'analysis' ? 'chip chip--active' : 'chip'}
          onClick={() => setMobileTerminalTab('analysis')}
        >
          Analiz
        </button>
      </div>

      <div className="mobile-terminal-panels__body">
        {mobileTerminalTab === 'watchlist' ? (
          <MarketWatchlistPanel
            tabs={marketTabs}
            activeTabId={activeMarketTabId}
            activeWatchlistId={activeWatchlistId}
            selectedAssetId={selectedAssetId}
            favorites={favorites}
            selectedSnapshot={selectedSnapshot}
            searchTerm={searchTerm}
            searchResults={searchResults}
            isSearchLoading={searchQuery.isLoading}
            isCollapsed={false}
            onSearchTermChange={setSearchTerm}
            onTabChange={handleChangeMarketTab}
            onSelectAsset={handleSelectAsset}
            onToggleFavorite={toggleFavorite}
            onAddToWatchlist={addAssetToWatchlist}
            onRemoveFromWatchlist={removeAssetFromWatchlist}
            onCreateWatchlist={createWatchlist}
            onRenameWatchlist={renameWatchlist}
            onDeleteWatchlist={deleteWatchlist}
            onReorderWatchlistAsset={reorderWatchlistAsset}
            onToggleCollapse={() => undefined}
          />
        ) : (
          analysisRailContent
        )}
      </div>
    </section>
  )

  return (
    <div
      className={[
        'app-shell',
        isMobileViewport ? 'app-shell--mobile' : '',
        usesWideShell ? 'app-shell--workspace' : '',
        usesWideShell && isMarketPanelCollapsed ? 'app-shell--market-panel-collapsed' : ''
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <AudioFeedbackBridge />
      <TopToolbar
        activeScreen={activeScreen}
        currentUser={currentUser}
        notifications={notifications}
        liveNotifications={liveNotifications}
        liveNotificationSettings={settings.liveNotifications}
        portfolioValueTry={portfolio.summary.totalValueTry}
        assetLookup={overviewMap}
        onReadNotification={markNotificationRead}
        onReadAllNotifications={markAllNotificationsRead}
        onOpenProfileSection={openProfileSection}
        onSelectScreen={setActiveScreen}
        onLiveNotificationSettingChange={setLiveNotificationSetting}
        onSendLiveNotificationTest={handleSendLiveNotificationTest}
        themeMode={settings.themeMode}
        onToggleTheme={() => setThemeMode(settings.themeMode === 'dark' ? 'light' : 'dark')}
        onSignOut={() => {
          if (social.sessionUserId) {
            void social.signOut()
          }
        }}
      />

      {!usesWideShell ? (
        <aside className="app-shell__left app-shell__left--terminal">
          <div className="terminal-brand-badge">
            <AyLogo compact />
          </div>
        </aside>
      ) : null}

      <main className={isTerminalWorkspace ? 'app-shell__center app-shell__center--terminal' : 'app-shell__center'}>
        {isProfileScreen ? (
          <ProfileDashboard
            profile={currentUser}
            friendCount={socialFeaturesEnabled ? social.contacts.length : 0}
            favoriteItems={favoriteItems}
            overviewItems={overviewItems}
            watchlists={watchlists}
            watchlistItems={watchlistItemsById}
            section={profileSection}
            settings={settings}
            showcase={showcase}
            portfolioSummary={portfolio.summary}
            portfolioSnapshots={portfolio.snapshots}
            portfolioRange={portfolioRange}
            cloudSync={cloudSync}
            fxRate={portfolio.fxQuery.data?.usdTry ?? 38}
            fxSource={portfolio.fxQuery.data?.source ?? 'fallback'}
            isFxLoading={portfolio.fxQuery.isLoading}
            isOverviewLoading={overviewQuery.isLoading}
            isRefreshingOverview={isPortfolioRefreshing || overviewQuery.isRefetching}
            onSectionChange={setProfileSection}
            onSaveProfile={updateProfile}
            onSaveAvatar={updateAvatar}
            onSelectAsset={setSelectedAsset}
            onNotificationToggle={setNotificationPreference}
            onSoundPreferenceChange={setSoundPreference}
            onPortfolioVisibilityChange={setPortfolioVisibility}
            onPortfolioRangeChange={setPortfolioRange}
            onSetWallpaper={setWallpaper}
            onSetBackgroundPreset={setBackgroundPreset}
            onRefreshOverview={() => void refreshPortfolioLiveData()}
          />
        ) : isAiScreen ? (
          <div className="terminal-section-page">
            <AiDashboard
              watchlist={aiHub.watchlist}
              opportunities={aiHub.opportunities}
              portfolioReview={aiHub.portfolioReview}
              portfolioSummary={portfolio.summary}
              macroSummary={aiHub.macroSummary}
              history={aiHub.history}
              isLoading={aiHub.isLoading}
              hasError={aiHub.hasError}
              onSelectAsset={handleSelectAsset}
            />
          </div>
        ) : isHighlightsScreen ? (
          <div className="terminal-section-page">
            <HighlightsDashboard
              gainers={topMovers}
              decliners={topDecliners}
              isLoading={overviewQuery.isLoading}
              hasError={overviewQuery.isError}
              onSelectAsset={handleSelectAsset}
            />
          </div>
        ) : isInvestorsScreen ? (
          <div className="terminal-section-page">
            <InvestorsDashboard overviewLookup={overviewMap} onSelectAsset={handleSelectAsset} />
          </div>
        ) : (
          <>
            {terminalCenter}
            {isMobileViewport ? mobileTerminalRail : null}
          </>
        )}
      </main>

      {!isMobileViewport || isProfileScreen ? (
        <aside
          className={
            isProfileScreen
              ? 'app-shell__right'
              : `app-shell__right app-shell__right--terminal${isMarketPanelCollapsed ? ' app-shell__right--terminal-collapsed' : ''}`
          }
        >
          {isProfileScreen ? (
            <ProfileSidebar
              profile={currentUser}
              friendCount={socialFeaturesEnabled ? social.contacts.length : 0}
              holdingCount={portfolio.summary.holdings.length}
              settings={settings}
              portfolioSummary={portfolio.summary}
              cloudSync={cloudSync}
            />
          ) : (
            terminalRightRail
          )}
        </aside>
      ) : null}
    </div>
  )
}

export default App


