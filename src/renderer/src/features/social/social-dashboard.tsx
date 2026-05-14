import { useEffect, useMemo, useState } from 'react'
import { BellRing, Eye, MessageCircle, Search, UserPlus, Users } from 'lucide-react'
import { GifPicker } from '@renderer/components/gif-picker'
import { Panel } from '@renderer/components/panel'
import { SocialRichContentView } from '@renderer/components/social-rich-content'
import { StateCard } from '@renderer/components/state-card'
import { StatusPill } from '@renderer/components/status-pill'
import { SocialAvatar } from '@renderer/features/social/social-avatar'
import { SocialProfileView } from '@renderer/features/social/social-profile-view'
import { useSocialCloud } from '@renderer/hooks/use-social-cloud'
import { useSocialProfileStore } from '@renderer/store/use-social-profile-store'
import { formatDateTime, formatRelativeTime } from '@renderer/utils/format'
import type { MarketOverviewItem } from '@shared/types/market'
import type { FriendProfile, UserProfile } from '@shared/types/social'

interface SocialDashboardProps {
  currentUser: UserProfile
  assetLookup: Map<string, MarketOverviewItem>
  social: ReturnType<typeof useSocialCloud>
  onSelectAsset: (assetId: string) => void
}

const presenceTone = {
  online: 'positive',
  busy: 'negative',
  away: 'neutral',
  offline: 'neutral'
} as const

const presenceLabel = {
  online: 'Çevrim içi',
  busy: 'Meşgul',
  away: 'Az önce aktifti',
  offline: 'Çevrim dışı'
} as const

const messageStatusLabel = {
  sending: 'gönderiliyor',
  sent: 'gönderildi',
  delivered: 'iletildi',
  seen: 'görüldü'
} as const

const relationButtonLabel = (
  relation: 'contact' | 'incoming' | 'outgoing' | 'none'
): string => {
  if (relation === 'contact') {
    return 'Sohbet aç'
  }

  if (relation === 'incoming') {
    return 'İsteği kabul et'
  }

  if (relation === 'outgoing') {
    return 'İstek gönderildi'
  }

  return 'Arkadaş ekle'
}

const FriendSummaryCard = ({
  friend,
  assetLookup,
  relation,
  onAction,
  onViewProfile
}: {
  friend: FriendProfile
  assetLookup: Map<string, MarketOverviewItem>
  relation: 'contact' | 'incoming' | 'outgoing' | 'none'
  onAction: () => void
  onViewProfile: () => void
}) => (
  <article className="list-card social-profile-card">
    <div className="social-profile-card__header">
      <SocialAvatar
        displayName={friend.displayName}
        username={friend.username}
        avatarDataUrl={friend.avatarDataUrl}
      />
      <div className="social-profile-card__title">
        <strong>{friend.displayName}</strong>
        <p>@{friend.username}</p>
      </div>
      <StatusPill label={presenceLabel[friend.presence]} tone={presenceTone[friend.presence]} />
    </div>

    <p>{friend.bio || 'Bu profil henüz kısa bir biyografi eklemedi.'}</p>

    <div className="meta-row">
      <span>Katılım: {formatDateTime(friend.joinedAt)}</span>
      <span>{friend.publicHoldings.length || friend.publicAssetIds.length} açık varlık</span>
    </div>

    <div className="asset-chip-row">
      {friend.publicAssetIds.slice(0, 6).map((assetId) => (
        <span key={assetId} className="chip">
          {assetLookup.get(assetId)?.profile.symbol ?? assetId.split(':').at(-1)}
        </span>
      ))}
    </div>

    <div className="social-profile-card__actions">
      <button type="button" className="secondary-button" onClick={onViewProfile}>
        <Eye size={16} />
        Profili gör
      </button>
      <button
        type="button"
        className={relation === 'incoming' ? 'primary-button' : 'secondary-button'}
        disabled={relation === 'outgoing'}
        onClick={onAction}
      >
        {relation === 'contact' ? <MessageCircle size={16} /> : <UserPlus size={16} />}
        {relationButtonLabel(relation)}
      </button>
    </div>
  </article>
)

export const SocialDashboard = ({
  currentUser,
  assetLookup,
  social,
  onSelectAsset
}: SocialDashboardProps) => {
  const addTradeEntry = useSocialProfileStore((state) => state.addTradeEntry)
  const removeTradeEntry = useSocialProfileStore((state) => state.removeTradeEntry)
  const setWallpaper = useSocialProfileStore((state) => state.setWallpaper)
  const setBackgroundPreset = useSocialProfileStore((state) => state.setBackgroundPreset)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<FriendProfile[]>([])
  const [isSearchLoading, setIsSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const [messageDraft, setMessageDraft] = useState('')
  const [messageGifUrl, setMessageGifUrl] = useState('')

  useEffect(() => {
    if (!social.sessionUserId || !searchTerm.trim()) {
      setSearchResults([])
      setSearchError('')
      setIsSearchLoading(false)
      setHasSearched(false)
      return
    }

    const timeout = window.setTimeout(() => {
      setIsSearchLoading(true)
      setSearchError('')
      setHasSearched(true)
      void social
        .searchProfiles(searchTerm.trim())
        .then((results) => {
          setSearchResults(results)
          setSearchError('')
        })
        .catch((error) => {
          const message =
            error instanceof Error ? error.message : 'Kullanıcı araması şu anda tamamlanamadı.'
          setSearchResults([])
          setSearchError(message)
          social.setErrorMessage(message)
        })
        .finally(() => {
          setIsSearchLoading(false)
        })
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [searchTerm, social, social.sessionUserId])

  const relationMap = useMemo(() => {
    const map = new Map<string, 'contact' | 'incoming' | 'outgoing'>()
    social.contacts.forEach((friend) => map.set(friend.id, 'contact'))
    social.incomingRequests.forEach((friend) => map.set(friend.id, 'incoming'))
    social.outgoingRequests.forEach((friend) => map.set(friend.id, 'outgoing'))
    return map
  }, [social.contacts, social.incomingRequests, social.outgoingRequests])

  const selectedFriend = social.selectedFriend
  const conversation = selectedFriend ? social.conversations[selectedFriend.id] ?? [] : []
  const viewedProfileId = social.viewedProfile?.id
  const viewedRelation = viewedProfileId ? relationMap.get(viewedProfileId) ?? 'none' : 'none'
  const canViewPortfolio =
    social.viewedProfile?.id === social.selfProfile.id
      ? true
      : social.viewedProfile?.portfolioVisibility === 'public'
        ? true
        : social.viewedProfile?.portfolioVisibility === 'friends'
          ? viewedRelation === 'contact'
          : false

  const sendSelectedFriendMessage = async (): Promise<void> => {
    if (!selectedFriend) {
      return
    }

    const trimmedText = messageDraft.trim()
    const trimmedGifUrl = messageGifUrl.trim()

    if (!trimmedText && !trimmedGifUrl) {
      return
    }

    await social.sendMessageToFriend(selectedFriend.id, {
      text: trimmedText,
      gifUrl: trimmedGifUrl || undefined
    })
    setMessageDraft('')
    setMessageGifUrl('')
  }

  if (social.viewedProfile) {
    return (
      <SocialProfileView
        profile={social.viewedProfile}
        isOwnProfile={social.viewedProfile.id === social.selfProfile.id}
        canViewPortfolio={canViewPortfolio}
        assetLookup={assetLookup}
        posts={viewedProfileId ? social.profilePosts[viewedProfileId] ?? [] : []}
        comments={viewedProfileId ? social.profileComments[viewedProfileId] ?? [] : []}
        isLoading={social.isProfileFeedLoading}
        isBusy={social.isBusy}
        statusMessage={social.statusMessage}
        errorMessage={social.errorMessage}
        onBack={social.clearViewedProfile}
        onSelectAsset={onSelectAsset}
        onOpenChat={
          social.viewedProfile.id === social.selfProfile.id
            ? undefined
            : () => social.openChat(social.viewedProfile!.id)
        }
        onSendPoke={
          social.viewedProfile.id === social.selfProfile.id
            ? undefined
            : () => void social.sendPokeToFriend(social.viewedProfile!.id)
        }
        onPublishPost={(input) => social.publishProfilePost(input)}
        onPublishComment={(input) => social.sendProfileComment(social.viewedProfile!.id, input)}
        onAddTradeEntry={addTradeEntry}
        onRemoveTradeEntry={removeTradeEntry}
        onSetWallpaper={setWallpaper}
        onSetBackgroundPreset={setBackgroundPreset}
      />
    )
  }

  return (
    <div className="social-dashboard">
      <section className="hero-card home-hero social-landing-hero">
        <div className="home-hero__main">
          <div>
            <p className="eyebrow">Sosyal alan</p>
            <div className="home-hero__title">
              <h2>Piyasa profili</h2>
              <StatusPill
                label={`@${currentUser.username || 'kullanıcı-adı-bekleniyor'}`}
                tone={currentUser.username ? 'positive' : 'neutral'}
              />
            </div>
            <p className="home-hero__summary">
              Arkadaş bul, profillerini gez, yorum bırak, çizimlerini paylaş ve sohbeti tek
              yerden yönet. Burada yalnızca sosyal akış ve profil vitrini görünüyor.
            </p>
          </div>

          <div className="home-hero__stamp">
            <span>Arkadaş</span>
            <strong>{social.contacts.length}</strong>
            <span>Bekleyen istek</span>
            <strong>{social.incomingRequests.length}</strong>
          </div>
        </div>

        <div className="social-profile-card__actions">
          <button type="button" className="primary-button" onClick={() => social.openOwnProfile()}>
            <Eye size={16} />
            Profilime git
          </button>
          {selectedFriend ? (
            <button type="button" className="secondary-button" onClick={() => social.openChat(selectedFriend.id)}>
              <MessageCircle size={16} />
              Son sohbeti aç
            </button>
          ) : null}
        </div>
      </section>

      <Panel title="Kullanıcı ara" subtitle="Kullanıcı adı, e-posta veya ID ile profil bul">
        <div className="list-stack">
          <div className="search-input">
            <Search size={16} />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Kullanıcı adı, e-posta veya ID ara"
            />
          </div>

          {searchTerm.trim() ? (
            isSearchLoading ? (
              <StateCard
                title="Kullanıcılar aranıyor"
                description="Profil eşleşmeleri hazırlanıyor."
              />
            ) : searchError ? (
              <StateCard title="Arama başarısız oldu" description={searchError} />
            ) : searchResults.length ? (
              <div className="social-suggestions">
                {searchResults.map((friend) => {
                  const relation = relationMap.get(friend.id) ?? 'none'

                  return (
                    <FriendSummaryCard
                      key={friend.id}
                      friend={friend}
                      assetLookup={assetLookup}
                      relation={relation}
                      onViewProfile={() => social.openProfile(friend)}
                      onAction={() => {
                        if (relation === 'contact') {
                          social.openChat(friend.id)
                          return
                        }

                        if (relation === 'incoming') {
                          void social.acceptFriendRequest(friend.id)
                          return
                        }

                        if (relation === 'none') {
                          void social.sendFriendRequest(friend.id)
                        }
                      }}
                    />
                  )
                })}
              </div>
            ) : (
              <StateCard
                title="Kullanıcı bulunamadı"
                description={
                  hasSearched
                    ? 'Bu sorguyla eşleşen açık profil gelmedi. Kullanıcı adı, e-posta veya tam profil ID deneyebilirsin.'
                    : 'Aramaya başlayınca uygun sonuçlar burada görünecek.'
                }
              />
            )
          ) : (
            <StateCard
              title="Aramaya başla"
              description="Kullanıcı adı, e-posta veya profil ID yazdığında gerçek profilleri burada göreceksin."
            />
          )}
        </div>
      </Panel>

      <div className="home-quick-grid">
        <Panel title="Gelen istekler" subtitle="Onay bekleyen arkadaşlar">
          {social.incomingRequests.length ? (
            <div className="social-suggestions">
              {social.incomingRequests.map((friend) => (
                <FriendSummaryCard
                  key={friend.id}
                  friend={friend}
                  assetLookup={assetLookup}
                  relation="incoming"
                  onViewProfile={() => social.openProfile(friend)}
                  onAction={() => void social.acceptFriendRequest(friend.id)}
                />
              ))}
            </div>
          ) : (
            <StateCard
              title="Bekleyen istek yok"
              description="Sana gelen arkadaş istekleri burada görünecek."
            />
          )}
        </Panel>

        <Panel title="Arkadaşların" subtitle="Profillerine hızlı geçiş">
          {social.contacts.length ? (
            <div className="mini-list">
              {social.contacts.map((friend) => (
                <article key={friend.id} className="mini-list__row social-friend-row social-friend-row--card">
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
                  <div className="social-friend-row__meta">
                    {social.unreadCounts[friend.id] ? (
                      <span className="notification-count">{social.unreadCounts[friend.id]}</span>
                    ) : null}
                    <StatusPill
                      label={presenceLabel[friend.presence]}
                      tone={presenceTone[friend.presence]}
                    />
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => social.openProfile(friend)}
                    >
                      <Eye size={16} />
                      Profil
                    </button>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => social.openChat(friend.id)}
                    >
                      <MessageCircle size={16} />
                      Sohbet
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <StateCard
              title="Henüz arkadaş yok"
              description="İstek gönderdiğinde ve karşı taraf kabul ettiğinde burada listelenir."
            />
          )}
        </Panel>
      </div>

      <Panel title="Sohbet merkezi" subtitle={selectedFriend ? selectedFriend.displayName : 'Arkadaş seç'}>
        {selectedFriend ? (
          <div className="social-chat">
            <FriendSummaryCard
              friend={selectedFriend}
              assetLookup={assetLookup}
              relation="contact"
              onViewProfile={() => social.openProfile(selectedFriend)}
              onAction={() => void social.sendPokeToFriend(selectedFriend.id)}
            />

            <div className="social-message-list">
              {conversation.length ? (
                conversation.map((message) => (
                  <article
                    key={message.id}
                    className={
                      message.sender === 'self' ? 'social-message social-message--self' : 'social-message'
                    }
                  >
                    <strong>{message.sender === 'self' ? 'Sen' : selectedFriend.displayName}</strong>
                    <SocialRichContentView text={message.text} gifUrl={message.gifUrl} />
                    <span>
                      {formatRelativeTime(message.sentAt)}
                      {message.sender === 'self' && message.status
                        ? ` â€¢ ${messageStatusLabel[message.status]}`
                        : ''}
                    </span>
                  </article>
                ))
              ) : (
                <StateCard
                  title="Mesaj yok"
                  description="Bu profil ile sohbet geçmişi boş. İlk mesajı sen gönderebilirsin."
                />
              )}
            </div>

            <GifPicker
              gifUrl={messageGifUrl || undefined}
              onChange={(value) => setMessageGifUrl(value ?? '')}
            />

            <div className="inline-form social-composer">
              <input
                value={messageDraft}
                onChange={(event) => setMessageDraft(event.target.value)}
                placeholder="Mesaj yaz"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void sendSelectedFriendMessage()
                  }
                }}
              />
              <button
                type="button"
                className="primary-button"
                disabled={social.isBusy}
                onClick={() => void sendSelectedFriendMessage()}
              >
                Gönder
              </button>
            </div>
          </div>
        ) : (
          <StateCard
            title="Arkadaş seç"
            description="Mesajlaşmak ve dürtmek için önce bir arkadaş seç."
          />
        )}
      </Panel>

      <Panel title="Dürtmeler" subtitle="Son sosyal hareketler">
        {social.pokeHistory.length ? (
          <div className="mini-list">
            {social.pokeHistory.slice(0, 8).map((poke) => {
              const friend = social.contacts.find((item) => item.id === poke.friendId)
              return (
                <div key={poke.id} className="mini-list__row">
                  <div className="mini-list__label">
                    <BellRing size={14} />
                    <div>
                      <strong>{friend?.displayName ?? poke.friendId}</strong>
                      <p>{poke.direction === 'outgoing' ? 'Sen dürttün' : 'Seni dürttü'}</p>
                    </div>
                  </div>
                  <span>{formatDateTime(poke.sentAt)}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <StateCard
            title="Dürtme kaydı yok"
            description="Gönderdiğin ve aldığın dürtmeler burada tutulacak."
          />
        )}
      </Panel>
    </div>
  )
}

interface SocialSidebarProps {
  currentUser: UserProfile
  pendingIncomingCount: number
}

export const SocialSidebar = ({ currentUser, pendingIncomingCount }: SocialSidebarProps) => (
  <Panel title="Sosyal özet" subtitle="Profil ve arkadaş akışı">
    <div className="list-stack">
      <article className="list-card">
        <div className="mini-list__label">
          <Users size={16} />
          <strong>@{currentUser.username || 'kullanıcı-adı-bekleniyor'}</strong>
        </div>
        <p>
          Profil vitrini, yorum duvarı ve analiz paylaşımları bu hesap üzerinden yönetilir.
        </p>
      </article>
      <article className="list-card">
        <div className="mini-list__label">
          <BellRing size={16} />
          <strong>Bekleyen istek</strong>
        </div>
        <p>Şu an {pendingIncomingCount} arkadaş isteği onay bekliyor.</p>
      </article>
    </div>
  </Panel>
)

