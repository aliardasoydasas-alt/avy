import { Globe2, Layers3, Users, Wallet } from 'lucide-react'
import { Panel } from '@renderer/components/panel'
import { StateCard } from '@renderer/components/state-card'
import { HoldingsPanel } from '@renderer/features/profile/holdings-panel'
import { AccountSettingsPanel } from '@renderer/features/profile/account-settings-panel'
import {
  getProfileShowcaseOverlayStyle,
  getProfileShowcaseStyle
} from '@renderer/services/social-profile-showcase'
import type { PortfolioSummary } from '@renderer/services/portfolio-service'
import { formatCurrency, formatDateTime } from '@renderer/utils/format'
import type { CloudSyncState } from '@shared/types/cloud-sync'
import type { MarketOverviewItem, WatchlistDefinition } from '@shared/types/market'
import type { PortfolioRange, PortfolioSnapshot } from '@shared/types/portfolio'
import type { ProfileShowcaseSettings, UserProfile } from '@shared/types/social'
import type { ProfileSection, UserSettings } from '@shared/types/user'

interface ProfileDashboardProps {
  profile: UserProfile
  friendCount: number
  favoriteItems: MarketOverviewItem[]
  overviewItems: MarketOverviewItem[]
  watchlists: WatchlistDefinition[]
  watchlistItems: Record<string, MarketOverviewItem[]>
  section: ProfileSection
  settings: UserSettings
  showcase: ProfileShowcaseSettings
  portfolioSummary: PortfolioSummary
  portfolioSnapshots: PortfolioSnapshot[]
  portfolioRange: PortfolioRange
  cloudSync: CloudSyncState
  fxRate: number
  fxSource: 'live' | 'fallback'
  isFxLoading: boolean
  isOverviewLoading: boolean
  isRefreshingOverview: boolean
  onSectionChange: (section: ProfileSection) => void
  onSaveProfile: (input: { username: string; displayName: string; bio: string }) => void
  onSaveAvatar: (avatarDataUrl?: string) => void
  onSelectAsset: (assetId: string) => void
  onNotificationToggle: (key: keyof UserSettings['notifications'], enabled: boolean) => void
  onSoundPreferenceChange: (key: keyof UserSettings['sound'], value: boolean | number) => void
  onPortfolioVisibilityChange: (visibility: UserSettings['portfolioVisibility']) => void
  onPortfolioRangeChange: (range: PortfolioRange) => void
  onSetWallpaper: (wallpaperId: string) => void
  onSetBackgroundPreset: (backgroundPresetId: string) => void
  onRefreshOverview: () => void
}

const initialsFromProfile = (profile: UserProfile): string => {
  const seed = profile.displayName || profile.username || 'AVY'
  return seed
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export const ProfileDashboard = ({
  profile,
  friendCount,
  favoriteItems,
  overviewItems,
  watchlists,
  watchlistItems,
  section,
  settings,
  showcase,
  portfolioSummary,
  portfolioSnapshots,
  portfolioRange,
  cloudSync,
  fxRate,
  fxSource,
  isFxLoading,
  isOverviewLoading,
  isRefreshingOverview,
  onSectionChange,
  onSaveProfile,
  onSaveAvatar,
  onSelectAsset,
  onNotificationToggle,
  onSoundPreferenceChange,
  onPortfolioVisibilityChange,
  onPortfolioRangeChange,
  onSetWallpaper,
  onSetBackgroundPreset,
  onRefreshOverview
}: ProfileDashboardProps) => (
  <div className="home-stack">
    <section className="social-showcase-card social-showcase-card--profile" style={getProfileShowcaseStyle(showcase)}>
      <div
        className={`social-showcase-card__overlay social-showcase-card__overlay--${showcase.backgroundPresetId}`}
        style={getProfileShowcaseOverlayStyle(showcase)}
      />
      <div className="social-showcase-card__content">
        <div className="social-showcase-card__topbar">
          <p className="eyebrow">Profil vitrini</p>
          <div className="asset-chip-row">
            <span className="chip">Arkadaş {friendCount}</span>
            <span className="chip">Pozisyon {portfolioSummary.holdings.length}</span>
            <span className="chip">Liste {watchlists.length}</span>
          </div>
        </div>

        <div className="social-showcase-card__hero">
          <div className="profile-avatar profile-avatar--showcase">
            {profile.avatarDataUrl ? (
              <img src={profile.avatarDataUrl} alt="Profil resmi" />
            ) : (
              <strong>{initialsFromProfile(profile)}</strong>
            )}
          </div>

          <div className="social-showcase-card__copy">
            <div className="home-hero__title">
              <h2>{profile.displayName || 'Profilini tamamla'}</h2>
              <span>@{profile.username || 'kullanici-adi-bekleniyor'}</span>
            </div>
            <p className="home-hero__summary">
              {profile.bio || 'Wallpaper, hareketli arka plan ve portföy vitriniyle profil alanını kişiselleştirebilirsin.'}
            </p>
            <div className="asset-chip-row">
              <span className="chip">Katılım {formatDateTime(profile.joinedAt)}</span>
              <span className="chip">Portföy {formatCurrency(portfolioSummary.totalValueTry, 'TRY', 0)}</span>
              <span className="chip">
                Günlük {portfolioSummary.totalDailyChangeValueTry >= 0 ? '+' : ''}
                {formatCurrency(portfolioSummary.totalDailyChangeValueTry, 'TRY', 0)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div className="filter-chip-row">
      {[
        ['overview', 'Profil'],
        ['holdings', 'Varlıklarım'],
        ['settings', 'Ayarlar']
      ].map(([value, label]) => (
        <button
          key={value}
          type="button"
          className={section === value ? 'chip chip--active' : 'chip'}
          onClick={() => onSectionChange(value as ProfileSection)}
        >
          {label}
        </button>
      ))}
    </div>

    {section === 'settings' ? (
      <AccountSettingsPanel
        profile={profile}
        settings={settings}
        showcase={showcase}
        onSaveProfile={onSaveProfile}
        onSaveAvatar={onSaveAvatar}
        onNotificationToggle={onNotificationToggle}
        onSoundPreferenceChange={onSoundPreferenceChange}
        onPortfolioVisibilityChange={onPortfolioVisibilityChange}
        onSetWallpaper={onSetWallpaper}
        onSetBackgroundPreset={onSetBackgroundPreset}
      />
    ) : section === 'holdings' ? (
      <HoldingsPanel
        overviewItems={overviewItems}
        summary={portfolioSummary}
        snapshots={portfolioSnapshots}
        range={portfolioRange}
        cloudSync={cloudSync}
        fxRate={fxRate}
        fxSource={fxSource}
        isFxLoading={isFxLoading}
        isOverviewLoading={isOverviewLoading}
        isRefreshingOverview={isRefreshingOverview}
        onRangeChange={onPortfolioRangeChange}
        onSelectAsset={onSelectAsset}
        onRefreshOverview={onRefreshOverview}
      />
    ) : (
      <>
        <div className="home-quick-grid">
          <Panel title="Varlıklarım" subtitle="Profil vitrininin ön plana çıkan pozisyonları">
            {portfolioSummary.holdings.length ? (
              <div className="mini-list">
                {portfolioSummary.holdings.slice(0, 6).map((item) => (
                  <button
                    key={item.holding.id}
                    type="button"
                    className="mini-list__row"
                    onClick={() => {
                      if (item.holding.assetType !== 'cash') {
                        onSelectAsset(item.holding.assetId)
                      }
                    }}
                  >
                    <div className="mini-list__label">
                      <Wallet size={14} />
                      <span>{item.holding.assetSymbol}</span>
                    </div>
                    <span>{formatCurrency(item.totalValueTry, 'TRY', 0)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <StateCard
                title="Portföy boş"
                description="Eklediğin coin, hisse ve nakit pozisyonları profil vitrininin bu alanında görünür."
              />
            )}
          </Panel>

          <Panel title="Açık listeler" subtitle="İzleme listelerin">
            {watchlists.length ? (
              <div className="list-stack">
                {watchlists.map((watchlist) => (
                  <article key={watchlist.id} className="list-card">
                    <div className="list-card__header">
                      <strong>{watchlist.name}</strong>
                      <span>{watchlist.assetIds.length} varlık</span>
                    </div>
                    <div className="asset-chip-row">
                      {(watchlistItems[watchlist.id] ?? []).slice(0, 6).map((item) => (
                        <button
                          key={item.assetId}
                          type="button"
                          className="chip"
                          onClick={() => onSelectAsset(item.assetId)}
                        >
                          {item.profile.symbol}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <StateCard
                title="Liste yok"
                description="Oluşturduğun izleme listeleri burada herkese açık görünür."
              />
            )}
          </Panel>
        </div>

        <Panel title="Profil özeti" subtitle="Hızlı görünüm">
          <div className="home-quick-grid">
            <article className="list-card">
              <div className="mini-list__label">
                <Users size={16} />
                <strong>Arkadaş çevresi</strong>
              </div>
              <p>Sosyal bağlantıların ve paylaşımlarının görünürlüğü burada özetlenir.</p>
              <div className="meta-row">
                <span>Arkadaş</span>
                <strong>{friendCount}</strong>
              </div>
            </article>

            <article className="list-card">
              <div className="mini-list__label">
                <Wallet size={16} />
                <strong>Portföy özeti</strong>
              </div>
              <p>Toplam portföy ve günlük hareketi tek bakışta takip et.</p>
              <div className="meta-row">
                <span>Toplam değer</span>
                <strong>{formatCurrency(portfolioSummary.totalValueTry, 'TRY', 0)}</strong>
              </div>
              <div className="meta-row">
                <span>Bugünkü durum</span>
                <strong className={portfolioSummary.totalDailyChangeValueTry >= 0 ? 'metric-positive' : 'metric-negative'}>
                  {portfolioSummary.totalDailyChangeValueTry >= 0 ? '+' : ''}
                  {formatCurrency(portfolioSummary.totalDailyChangeValueTry, 'TRY', 0)}
                </strong>
              </div>
            </article>

            <article className="list-card">
              <div className="mini-list__label">
                <Layers3 size={16} />
                <strong>Vitrin ve listeler</strong>
              </div>
              <p>Profil duvarın, açık listelerin ve seçtiğin arka plan burada birleşir.</p>
              <div className="meta-row">
                <span>Favori</span>
                <strong>{favoriteItems.length}</strong>
              </div>
              <div className="meta-row">
                <span>Açık liste</span>
                <strong>{watchlists.length}</strong>
              </div>
            </article>
          </div>
        </Panel>
      </>
    )}
  </div>
)

interface ProfileSidebarProps {
  profile: UserProfile
  friendCount: number
  holdingCount: number
  settings: UserSettings
  portfolioSummary: PortfolioSummary
  cloudSync: CloudSyncState
}

export const ProfileSidebar = ({
  profile,
  friendCount,
  holdingCount,
  settings,
  portfolioSummary,
  cloudSync
}: ProfileSidebarProps) => (
  <Panel title="Profil özeti" subtitle="Hızlı görünüm">
    <div className="list-stack">
      <article className="list-card">
        <div className="mini-list__label">
          <Users size={16} />
          <strong>{profile.username || 'kullanici-adi-bekleniyor'}</strong>
        </div>
        <p>{profile.bio || 'Bio eklediğinde burada görünür.'}</p>
      </article>

      <article className="list-card">
        <div className="meta-row">
          <span>Arkadaş</span>
          <strong>{friendCount}</strong>
        </div>
        <div className="meta-row">
          <span>Pozisyon</span>
          <strong>{holdingCount}</strong>
        </div>
        <div className="meta-row">
          <span>Toplam portföy</span>
          <strong>{formatCurrency(portfolioSummary.totalValueTry, 'TRY', 0)}</strong>
        </div>
        <div className="meta-row">
          <span>Bugünkü durum</span>
          <strong className={portfolioSummary.totalDailyChangeValueTry >= 0 ? 'metric-positive' : 'metric-negative'}>
            {portfolioSummary.totalDailyChangeValueTry >= 0 ? '+' : ''}
            {formatCurrency(portfolioSummary.totalDailyChangeValueTry, 'TRY', 0)}
          </strong>
        </div>
        <div className="meta-row">
          <span>Bildirim sesi</span>
          <strong>{settings.sound.enabled ? 'Açık' : 'Kapalı'}</strong>
        </div>
        <div className="meta-row">
          <span>Bulut senkronu</span>
          <strong>
            {cloudSync.status === 'synced'
              ? 'Hazır'
              : cloudSync.status === 'saving'
                ? 'Kaydediliyor'
                : cloudSync.status === 'loading'
                  ? 'Yükleniyor'
                  : cloudSync.status === 'offline'
                    ? 'Çevrimdışı'
                    : 'Kontrol et'}
          </strong>
        </div>
      </article>

      <article className="list-card">
        <div className="mini-list__label">
          <Globe2 size={16} />
          <strong>Profil vitrini</strong>
        </div>
        <p>Wallpaper ve arka plan ayarlarını üst menüdeki Ayarlar alanından dilediğin zaman değiştirebilirsin.</p>
      </article>
    </div>
  </Panel>
)
