import { BarChart3, Clock3, Star, TrendingUp, Users } from 'lucide-react'
import { Panel } from '@renderer/components/panel'
import { StateCard } from '@renderer/components/state-card'
import { StatusPill } from '@renderer/components/status-pill'
import { SocialAvatar } from '@renderer/features/social/social-avatar'
import { formatCurrency, formatDateTime, formatPercent } from '@renderer/utils/format'
import type { MarketPulseItem } from '@shared/types/home'
import type { MarketOverviewItem } from '@shared/types/market'
import type { FriendProfile, TradeJournalEntry } from '@shared/types/social'

interface HomeDashboardProps {
  pulseItems: MarketPulseItem[]
  isPulseLoading: boolean
  hasPulseError: boolean
  favoriteItems: MarketOverviewItem[]
  recentItems: MarketOverviewItem[]
  friends: FriendProfile[]
  onSelectAsset: (assetId: string) => void
  onOpenFriendProfile: (friend: FriendProfile) => void
}

interface FriendActivityItem {
  id: string
  friend: FriendProfile
  entry: TradeJournalEntry
  title: string
  description: string
  tone: 'positive' | 'negative' | 'neutral'
}

const socialPresenceTone = {
  online: 'positive',
  busy: 'negative',
  away: 'neutral',
  offline: 'neutral'
} as const

const socialPresenceLabel = {
  online: 'Çevrim içi',
  busy: 'Meşgul',
  away: 'Az önce aktifti',
  offline: 'Çevrim dışı'
} as const

const getToneSummary = (
  pulseItems: MarketPulseItem[]
): { label: string; tone: 'positive' | 'negative' | 'neutral'; description: string } => {
  const positiveCount = pulseItems.filter((item) => item.tone === 'positive').length
  const negativeCount = pulseItems.filter((item) => item.tone === 'negative').length

  if (positiveCount > negativeCount) {
    return {
      label: 'Risk iştahı öne çıkıyor',
      tone: 'positive',
      description:
        'Genel piyasa görünümünde pozitif başlıklar ağırlık kazanıyor. Endeksler ve öncü varlıklarda yukarı yönlü duyarlılık artmış olabilir.'
    }
  }

  if (negativeCount > positiveCount) {
    return {
      label: 'Temkinli görünüm',
      tone: 'negative',
      description:
        'Makro ve piyasa verileri şu an daha savunmacı bir tabloya işaret ediyor. Hacim ve haber akışıyla birlikte oynaklık artabilir.'
    }
  }

  return {
    label: 'Dengeli görünüm',
    tone: 'neutral',
    description:
      'Piyasa verileri karışık sinyal veriyor. Net yön için kritik haber akışına ve büyük varlıklardaki momentum teyidine bakmak faydalı olabilir.'
  }
}

const getToneLabel = (tone: MarketPulseItem['tone']): string =>
  tone === 'positive' ? 'Olumlu' : tone === 'negative' ? 'Baskı var' : 'Dengeli'

const getDayKey = (value: string): string =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date(value))

const buildFriendActivityItems = (friends: FriendProfile[]): FriendActivityItem[] => {
  const buyPattern = /\b(al(?:dı|dim|ım|indi|ış|im)|ekled[iı]?|pozisyon açtı|long)\b/i
  const sellPattern = /\b(sat(?:tı|tim|ım|ış)?|çıkış yaptı|pozisyon kapattı|short)\b/i
  const todayKey = getDayKey(new Date().toISOString())

  return friends
    .flatMap((friend) =>
      friend.tradeJournal.map((entry) => {
        const note = entry.note.trim()
        const isBuy = buyPattern.test(note)
        const isSell = sellPattern.test(note)
        const whenLabel = getDayKey(entry.createdAt) === todayKey ? 'bugün' : 'yakın zamanda'

        if (isBuy) {
          return {
            id: `${friend.id}:${entry.id}`,
            friend,
            entry,
            title: `${friend.displayName} ${whenLabel} ${entry.assetSymbol} aldı`,
            description: note,
            tone: 'positive' as const
          }
        }

        if (isSell) {
          return {
            id: `${friend.id}:${entry.id}`,
            friend,
            entry,
            title: `${friend.displayName} ${whenLabel} ${entry.assetSymbol} sattı`,
            description: note,
            tone: 'negative' as const
          }
        }

        return {
          id: `${friend.id}:${entry.id}`,
          friend,
          entry,
          title: `${friend.displayName}, ${entry.assetSymbol} için not paylaştı`,
          description: note,
          tone:
            entry.outcome === 'positive'
              ? 'positive'
              : entry.outcome === 'negative'
                ? 'negative'
                : 'neutral'
        }
      })
    )
    .sort(
      (left, right) =>
        new Date(right.entry.createdAt).getTime() - new Date(left.entry.createdAt).getTime()
    )
    .slice(0, 8)
}

export const HomeDashboard = ({
  pulseItems,
  isPulseLoading,
  hasPulseError,
  favoriteItems,
  recentItems,
  friends,
  onSelectAsset,
  onOpenFriendProfile
}: HomeDashboardProps) => {
  const summary = getToneSummary(pulseItems)
  const generatedAt = formatDateTime(new Date().toISOString())
  const onlineFriends = friends.filter((friend) => friend.presence === 'online')
  const offlineFriends = friends.filter((friend) => friend.presence !== 'online')
  const friendActivities = buildFriendActivityItems(friends)

  return (
    <div className="home-stack">
      <section className="hero-card home-hero">
        <div className="home-hero__main">
          <div>
            <p className="eyebrow">Ana sayfa</p>
            <div className="home-hero__title">
              <h2>Global piyasa merkezi</h2>
              <StatusPill label={summary.label} tone={summary.tone} />
            </div>
            <p className="home-hero__summary">{summary.description}</p>
          </div>

          <div className="home-hero__stamp">
            <span>Son güncelleme</span>
            <strong>{generatedAt}</strong>
          </div>
        </div>
      </section>

      <Panel title="Genel görünüm" subtitle="Piyasa verileri">
        {hasPulseError ? (
          <StateCard
            title="Piyasa verileri alınamadı"
            description="Genel piyasa kartları geçici olarak yüklenemedi. Biraz sonra tekrar dene."
          />
        ) : isPulseLoading && !pulseItems.length ? (
          <StateCard
            title="Piyasa verileri hazırlanıyor"
            description="BIST100, S&P 500, Bitcoin ve dominance kartları yükleniyor."
          />
        ) : pulseItems.length ? (
          <div className="pulse-grid">
            {pulseItems.map((item) => (
              <article key={item.id} className="pulse-card">
                <div className="pulse-card__header">
                  <div>
                    <span className="eyebrow">{item.label}</span>
                    <h3>{item.value}</h3>
                  </div>
                  <StatusPill label={getToneLabel(item.tone)} tone={item.tone} />
                </div>

                <strong
                  className={
                    item.tone === 'negative'
                      ? 'negative-text'
                      : item.tone === 'positive'
                        ? 'positive-text'
                        : ''
                  }
                >
                  {item.change}
                </strong>

                <div className="meta-row">
                  <span>{item.source}</span>
                  <span>{item.note ?? 'Genel piyasa görünümü'}</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <StateCard
            title="Veri bulunamadı"
            description="Gösterilecek genel piyasa verisi şu an hazır değil."
          />
        )}
      </Panel>

      <div className="home-quick-grid">
        <Panel title="Favoriler" subtitle="Hızlı geçiş">
          {favoriteItems.length ? (
            <div className="mini-list">
              {favoriteItems.slice(0, 6).map((item) => (
                <button
                  key={item.assetId}
                  type="button"
                  className="mini-list__row"
                  onClick={() => onSelectAsset(item.assetId)}
                >
                  <div className="mini-list__label">
                    <Star size={14} />
                    <span>{item.profile.symbol}</span>
                  </div>
                  <span>{formatCurrency(item.quote.price, item.profile.currency)}</span>
                </button>
              ))}
            </div>
          ) : (
            <StateCard
              title="Favori yok"
              description="Sabit takip etmek istediğin varlıkları favorilere eklediğinde burada görünecek."
            />
          )}
        </Panel>

        <Panel title="Son bakılanlar" subtitle="Tek tıkla geri dön">
          {recentItems.length ? (
            <div className="mini-list">
              {recentItems.slice(0, 6).map((item) => (
                <button
                  key={item.assetId}
                  type="button"
                  className="mini-list__row"
                  onClick={() => onSelectAsset(item.assetId)}
                >
                  <div className="mini-list__label">
                    <Clock3 size={14} />
                    <span>{item.profile.symbol}</span>
                  </div>
                  <span className={item.quote.changePercent >= 0 ? 'positive-text' : 'negative-text'}>
                    {formatPercent(item.quote.changePercent)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <StateCard
              title="Geçmiş boş"
              description="Açılan varlıklar bu alanda kısa yol olarak listelenecek."
            />
          )}
        </Panel>

        <Panel title="Arkadaşlarım" subtitle="Çevrim içi ve çevrim dışı">
          {friends.length ? (
            <div className="list-stack">
              <div className="list-card">
                <div className="list-card__header">
                  <strong>Çevrim içi</strong>
                  <StatusPill label={`${onlineFriends.length} aktif`} tone="positive" />
                </div>
                {onlineFriends.length ? (
                  <div className="mini-list">
                    {onlineFriends.map((friend) => (
                      <button
                        key={friend.id}
                        type="button"
                        className="mini-list__row social-friend-row"
                        onClick={() => onOpenFriendProfile(friend)}
                      >
                        <div className="mini-list__label">
                          <SocialAvatar
                            className="social-avatar social-avatar--mini"
                            displayName={friend.displayName}
                            username={friend.username}
                            avatarDataUrl={friend.avatarDataUrl}
                          />
                          <div>
                            <strong>{friend.displayName}</strong>
                            <p>@{friend.username}</p>
                          </div>
                        </div>
                        <StatusPill
                          label={socialPresenceLabel[friend.presence]}
                          tone={socialPresenceTone[friend.presence]}
                        />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p>Şu an aktif görünen arkadaş yok.</p>
                )}
              </div>

              <div className="list-card">
                <div className="list-card__header">
                  <strong>Çevrim dışı</strong>
                  <StatusPill label={`${offlineFriends.length} profil`} tone="neutral" />
                </div>
                {offlineFriends.length ? (
                  <div className="mini-list">
                    {offlineFriends.slice(0, 6).map((friend) => (
                      <button
                        key={friend.id}
                        type="button"
                        className="mini-list__row social-friend-row"
                        onClick={() => onOpenFriendProfile(friend)}
                      >
                        <div className="mini-list__label">
                          <SocialAvatar
                            className="social-avatar social-avatar--mini"
                            displayName={friend.displayName}
                            username={friend.username}
                            avatarDataUrl={friend.avatarDataUrl}
                          />
                          <div>
                            <strong>{friend.displayName}</strong>
                            <p>@{friend.username}</p>
                          </div>
                        </div>
                        <StatusPill
                          label={socialPresenceLabel[friend.presence]}
                          tone={socialPresenceTone[friend.presence]}
                        />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p>Çevrim dışı ayrı profiller şu an yok.</p>
                )}
              </div>
            </div>
          ) : (
            <StateCard
              title="Arkadaş paneli hazır"
              description="Sosyal ekranda arkadaş ekledikçe burada çevrim içi ve çevrim dışı olarak ayrılmış şekilde göreceksin."
            />
          )}
        </Panel>
      </div>

      <Panel title="Arkadaş aktiviteleri" subtitle="Alım, satım ve trade notları">
        {friendActivities.length ? (
          <div className="list-stack">
            {friendActivities.map((activity) => (
              <button
                key={activity.id}
                type="button"
                className="list-card social-friend-row"
                onClick={() => onOpenFriendProfile(activity.friend)}
              >
                <div className="list-card__header">
                  <div className="mini-list__label">
                    <SocialAvatar
                      className="social-avatar social-avatar--mini"
                      displayName={activity.friend.displayName}
                      username={activity.friend.username}
                      avatarDataUrl={activity.friend.avatarDataUrl}
                    />
                    <div>
                      <strong>{activity.title}</strong>
                      <p>@{activity.friend.username}</p>
                    </div>
                  </div>
                  <StatusPill label={activity.entry.assetSymbol} tone={activity.tone} />
                </div>
                <p>{activity.description}</p>
                <div className="meta-row">
                  <span>{formatDateTime(activity.entry.createdAt)}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <StateCard
            title="Aktivite henüz yok"
            description="Arkadaşların trade günlüğü ekledikçe burada alım, satım ve kısa trade hareketlerini göreceksin."
          />
        )}
      </Panel>

      <Panel title="Navigasyon" subtitle="Kısa akış">
        <div className="home-guidance-grid">
          <div className="list-card">
            <div className="mini-list__label">
              <TrendingUp size={16} />
              <strong>Varlık ekranına hızlı geçiş</strong>
            </div>
            <p>Soldaki arama ya da listelerden bir coin veya hisse seçerek detay ekranına anında geçebilirsin.</p>
          </div>

          <div className="list-card">
            <div className="mini-list__label">
              <Users size={16} />
              <strong>Arkadaş profillerini ziyaret et</strong>
            </div>
            <p>Ana sayfadaki arkadaş panelinden bir profili açarak sosyal ekrana geçip açık varlıklarını ve listelerini görebilirsin.</p>
          </div>

          <div className="list-card">
            <div className="mini-list__label">
              <BarChart3 size={16} />
              <strong>İncelemeleri profilde izle</strong>
            </div>
            <p>Grafikte yaptığın paylaşım doğrudan profilindeki incelemelere düşer; arkadaşların da oradan görebilir.</p>
          </div>
        </div>
      </Panel>
    </div>
  )
}
