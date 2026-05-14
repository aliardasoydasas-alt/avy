import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  BellRing,
  CandlestickChart,
  Eye,
  ImagePlus,
  MessageCircle,
  PenSquare,
  Send,
  Sparkles,
  Trash2
} from 'lucide-react'
import { GifPicker } from '@renderer/components/gif-picker'
import { Panel } from '@renderer/components/panel'
import { SocialRichContentView } from '@renderer/components/social-rich-content'
import { StateCard } from '@renderer/components/state-card'
import { StatusPill } from '@renderer/components/status-pill'
import {
  BACKGROUND_PRESETS,
  WALLPAPER_PRESETS,
  getBackgroundPreviewStyle,
  getProfileShowcaseOverlayStyle,
  getProfileShowcaseStyle,
  getWallpaperPreviewStyle
} from '@renderer/services/social-profile-showcase'
import { SocialAvatar } from '@renderer/features/social/social-avatar'
import { formatDateTime } from '@renderer/utils/format'
import type { MarketOverviewItem } from '@shared/types/market'
import type {
  FriendProfile,
  SocialProfileComment,
  SocialProfilePost,
  TradeOutcomeTone
} from '@shared/types/social'

interface SocialProfileViewProps {
  profile: FriendProfile
  isOwnProfile: boolean
  canViewPortfolio: boolean
  assetLookup: Map<string, MarketOverviewItem>
  posts: SocialProfilePost[]
  comments: SocialProfileComment[]
  isLoading: boolean
  isBusy: boolean
  statusMessage?: string
  errorMessage?: string
  onBack: () => void
  onSelectAsset: (assetId: string) => void
  onOpenChat?: () => void
  onSendPoke?: () => void
  onPublishPost: (input: {
    type: SocialProfilePost['type']
    assetId?: string
    assetSymbol?: string
    title: string
    body: string
    snapshotDataUrl?: string
  }) => Promise<void>
  onPublishComment: (input: { text: string; gifUrl?: string }) => Promise<void>
  onAddTradeEntry: (input: {
    assetId?: string
    assetSymbol: string
    note: string
    outcome: TradeOutcomeTone
  }) => void
  onRemoveTradeEntry: (entryId: string) => void
  onSetWallpaper: (wallpaperId: string) => void
  onSetBackgroundPreset: (backgroundPresetId: string) => void
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

const outcomeToneLabel = {
  positive: { label: 'İyi sonuç', tone: 'positive' as const },
  negative: { label: 'Zorlandı', tone: 'negative' as const },
  neutral: { label: 'Not edildi', tone: 'neutral' as const }
}

const postTypeLabel = {
  analysis: 'İnceleme',
  trade: 'Trade notu',
  note: 'Profil notu'
} as const

export const SocialProfileView = ({
  profile,
  isOwnProfile,
  canViewPortfolio,
  assetLookup,
  posts,
  comments,
  isLoading,
  isBusy,
  statusMessage,
  errorMessage,
  onBack,
  onSelectAsset,
  onOpenChat,
  onSendPoke,
  onPublishPost,
  onPublishComment,
  onAddTradeEntry,
  onRemoveTradeEntry,
  onSetWallpaper,
  onSetBackgroundPreset
}: SocialProfileViewProps) => {
  const [postDraft, setPostDraft] = useState({
    type: 'analysis' as SocialProfilePost['type'],
    assetFilter: '',
    assetId: '',
    title: '',
    body: '',
    snapshotDataUrl: ''
  })
  const [postFeedback, setPostFeedback] = useState('')
  const [commentDraft, setCommentDraft] = useState('')
  const [commentGifUrl, setCommentGifUrl] = useState('')
  const [commentFeedback, setCommentFeedback] = useState('')
  const [tradeDraft, setTradeDraft] = useState({
    assetFilter: '',
    assetId: '',
    note: '',
    outcome: 'neutral' as TradeOutcomeTone
  })

  const assetOptions = useMemo(() => {
    const normalized = postDraft.assetFilter.trim().toLowerCase()

    return Array.from(assetLookup.values())
      .filter((item) => {
        if (!normalized) {
          return true
        }

        return (
          item.profile.symbol.toLowerCase().includes(normalized) ||
          item.profile.name.toLowerCase().includes(normalized)
        )
      })
      .slice(0, 40)
  }, [assetLookup, postDraft.assetFilter])

  const tradeAssetOptions = useMemo(() => {
    const normalized = tradeDraft.assetFilter.trim().toLowerCase()

    return Array.from(assetLookup.values())
      .filter((item) => {
        if (!normalized) {
          return true
        }

        return (
          item.profile.symbol.toLowerCase().includes(normalized) ||
          item.profile.name.toLowerCase().includes(normalized)
        )
      })
      .slice(0, 40)
  }, [assetLookup, tradeDraft.assetFilter])

  const reviewPosts = useMemo(
    () => posts.filter((post) => post.type === 'analysis'),
    [posts]
  )

  const activityPosts = useMemo(
    () => posts.filter((post) => post.type !== 'analysis'),
    [posts]
  )

  const showcase = profile.showcase

  const submitComment = async (): Promise<void> => {
    const trimmedText = commentDraft.trim()
    const trimmedGif = commentGifUrl.trim()

    if (!trimmedText && !trimmedGif) {
      setCommentFeedback('Yorum veya GIF eklemelisin.')
      return
    }

    try {
      await onPublishComment({
        text: trimmedText,
        gifUrl: trimmedGif || undefined
      })
      setCommentDraft('')
      setCommentGifUrl('')
      setCommentFeedback('Yorum profile bırakıldı.')
    } catch (error) {
      setCommentFeedback(error instanceof Error ? error.message : 'Yorum gönderilemedi.')
    }
  }

  const publishDraft = async (): Promise<void> => {
    const selectedAsset = assetLookup.get(postDraft.assetId)
    const trimmedTitle = postDraft.title.trim()
    const trimmedBody = postDraft.body.trim()

    if (!trimmedTitle || !trimmedBody) {
      setPostFeedback('Yayın için başlık ve açıklama gerekli.')
      return
    }

    try {
      await onPublishPost({
        type: postDraft.type,
        assetId: postDraft.assetId || undefined,
        assetSymbol: selectedAsset?.profile.symbol,
        title: trimmedTitle,
        body: trimmedBody,
        snapshotDataUrl: postDraft.snapshotDataUrl || undefined
      })
      setPostDraft({
        type: 'analysis',
        assetFilter: '',
        assetId: '',
        title: '',
        body: '',
        snapshotDataUrl: ''
      })
      setPostFeedback('Paylaşım profil akışında yayına alındı.')
    } catch (error) {
      setPostFeedback(error instanceof Error ? error.message : 'Paylaşım yayınlanamadı.')
    }
  }

  return (
    <div className="social-dashboard social-profile-screen">
      <section className="social-showcase-card" style={getProfileShowcaseStyle(showcase)}>
        <div
          className={`social-showcase-card__overlay social-showcase-card__overlay--${showcase.backgroundPresetId}`}
          style={getProfileShowcaseOverlayStyle(showcase)}
        />
        <div className="social-showcase-card__content">
          <div className="social-showcase-card__topbar">
            <button type="button" className="secondary-button" onClick={onBack}>
              <ArrowLeft size={16} />
              Sosyale dön
            </button>
            <div className="asset-chip-row">
              <span className="chip">
                <Sparkles size={14} />
                Profil vitrini
              </span>
              <StatusPill label={presenceLabel[profile.presence]} tone={presenceTone[profile.presence]} />
            </div>
          </div>

          <div className="social-showcase-card__hero">
            <div className="profile-avatar profile-avatar--showcase">
              {profile.avatarDataUrl ? (
                <img src={profile.avatarDataUrl} alt={`${profile.displayName} profil resmi`} />
              ) : (
                <SocialAvatar displayName={profile.displayName} username={profile.username} className="social-avatar" />
              )}
            </div>

            <div className="social-showcase-card__copy">
              <p className="eyebrow">Sosyal profil</p>
              <div className="home-hero__title">
                <h2>{profile.displayName}</h2>
                <span>@{profile.username}</span>
              </div>
              <p className="home-hero__summary">
                {profile.bio || 'Bu profil henüz bir biyografi eklemedi.'}
              </p>

              <div className="asset-chip-row">
                <span className="chip">İnceleme {reviewPosts.length}</span>
                <span className="chip">Yorum {comments.length}</span>
                <span className="chip">Trade günlüğü {profile.tradeJournal.length}</span>
                <span className="chip">Katılım {formatDateTime(profile.joinedAt)}</span>
              </div>
            </div>
          </div>

          {!isOwnProfile ? (
            <div className="social-profile-card__actions">
              {onOpenChat ? (
                <button type="button" className="primary-button" onClick={onOpenChat}>
                  <MessageCircle size={16} />
                  Mesaj gönder
                </button>
              ) : null}
              {onSendPoke ? (
                <button type="button" className="secondary-button" onClick={onSendPoke}>
                  <BellRing size={16} />
                  Dürt
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {isOwnProfile ? (
        <Panel title="Profil vitrini" subtitle="Hazır yüklü wallpaper ve hareketli arka plan seç">
          <div className="social-showcase-settings">
            <div className="list-stack">
              <strong>Wallpaper</strong>
              <div className="social-showcase-grid">
                {WALLPAPER_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={
                      showcase.wallpaperId === preset.id
                        ? 'social-showcase-tile social-showcase-tile--active'
                        : 'social-showcase-tile'
                    }
                    onClick={() => onSetWallpaper(preset.id)}
                  >
                    <span
                      className="social-showcase-tile__preview"
                      style={getWallpaperPreviewStyle(preset.id)}
                    />
                    <strong>{preset.title}</strong>
                    <p>{preset.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="list-stack">
              <strong>Hareketli arka plan</strong>
              <div className="social-showcase-grid">
                {BACKGROUND_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={
                      showcase.backgroundPresetId === preset.id
                        ? 'social-showcase-tile social-showcase-tile--active'
                        : 'social-showcase-tile'
                    }
                    onClick={() => onSetBackgroundPreset(preset.id)}
                  >
                    <span
                      className={`social-showcase-tile__preview social-showcase-tile__preview--animated social-showcase-card__overlay--${preset.id}`}
                      style={getBackgroundPreviewStyle(preset.id)}
                    />
                    <strong>{preset.title}</strong>
                    <p>{preset.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Panel>
      ) : null}

      <div className="home-quick-grid">
        <Panel title="Varlıklar" subtitle="Profilde açık görünenler">
          {canViewPortfolio && profile.publicHoldings.length ? (
            <div className="list-stack">
              {profile.publicHoldings.map((holding) => (
                <button
                  key={`${holding.assetId}-${holding.symbol}`}
                  type="button"
                  className="list-card social-holding-card"
                  onClick={() => onSelectAsset(holding.assetId)}
                >
                  <div className="list-card__header">
                    <strong>{holding.symbol}</strong>
                    {holding.dailyChangePercent !== undefined ? (
                      <StatusPill
                        label={`${holding.dailyChangePercent >= 0 ? '+' : ''}${holding.dailyChangePercent.toFixed(2)}%`}
                        tone={holding.dailyChangePercent >= 0 ? 'positive' : 'negative'}
                      />
                    ) : null}
                  </div>
                  <p>{holding.name}</p>
                  <div className="meta-row">
                    <span>Miktar: {holding.amount}</span>
                    <strong>
                      {holding.totalValueTry !== undefined
                        ? `${Math.round(holding.totalValueTry).toLocaleString('tr-TR')} TL`
                        : 'Değer paylaşılmıyor'}
                    </strong>
                  </div>
                </button>
              ))}
            </div>
          ) : canViewPortfolio && profile.publicAssetIds.length ? (
            <div className="asset-chip-row">
              {profile.publicAssetIds.map((assetId) => (
                <button key={assetId} type="button" className="chip" onClick={() => onSelectAsset(assetId)}>
                  {assetLookup.get(assetId)?.profile.symbol ?? assetId.split(':').at(-1)}
                </button>
              ))}
            </div>
          ) : !canViewPortfolio ? (
            <StateCard
              title="Portföy görünürlüğü sınırlı"
              description={
                profile.portfolioVisibility === 'private'
                  ? 'Bu profil portföy detayını kimseyle paylaşmıyor.'
                  : 'Bu profil portföy detayını yalnızca arkadaşlarıyla paylaşıyor.'
              }
            />
          ) : (
            <StateCard
              title="Açık varlık yok"
              description="Bu profil şu an herkese açık varlık detayı paylaşmıyor."
            />
          )}
        </Panel>

        <Panel title="Trade günlüğü" subtitle="Kısa ve net geçmiş notları">
          {profile.tradeJournal.length ? (
            <div className="list-stack">
              {profile.tradeJournal.map((entry) => (
                <article key={entry.id} className="list-card social-trade-card">
                  <div className="list-card__header">
                    <strong>{entry.assetSymbol}</strong>
                    <StatusPill
                      label={outcomeToneLabel[entry.outcome].label}
                      tone={outcomeToneLabel[entry.outcome].tone}
                    />
                  </div>
                  <p>{entry.note}</p>
                  <div className="meta-row">
                    <span>{formatDateTime(entry.createdAt)}</span>
                    {isOwnProfile ? (
                      <button type="button" className="text-button" onClick={() => onRemoveTradeEntry(entry.id)}>
                        <Trash2 size={14} />
                        Kaldır
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <StateCard
              title="Trade günlüğü boş"
              description="Bu profilde henüz kısa trade notu paylaşılmadı."
            />
          )}
        </Panel>
      </div>

      {isOwnProfile ? (
        <div className="home-quick-grid">
          <Panel title="İnceleme yayınla" subtitle="Grafik düşüncelerini profil akışına taşı">
            <div className="list-stack">
              <div className="filter-chip-row">
                {(['analysis', 'trade', 'note'] as SocialProfilePost['type'][]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={postDraft.type === type ? 'chip chip--active' : 'chip'}
                    onClick={() => setPostDraft((state) => ({ ...state, type }))}
                  >
                    {postTypeLabel[type]}
                  </button>
                ))}
              </div>

              <label className="field-stack">
                <span>Varlık ara</span>
                <input
                  value={postDraft.assetFilter}
                  onChange={(event) => setPostDraft((state) => ({ ...state, assetFilter: event.target.value }))}
                  placeholder="BTC, ASELS, AAPL..."
                />
              </label>

              <label className="field-stack">
                <span>Varlık seç</span>
                <select
                  value={postDraft.assetId}
                  onChange={(event) => setPostDraft((state) => ({ ...state, assetId: event.target.value }))}
                >
                  <option value="">Varlık bağlama (opsiyonel)</option>
                  {assetOptions.map((item) => (
                    <option key={item.assetId} value={item.assetId}>
                      {item.profile.symbol} - {item.profile.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-stack">
                <span>Başlık</span>
                <input
                  value={postDraft.title}
                  onChange={(event) => setPostDraft((state) => ({ ...state, title: event.target.value }))}
                  placeholder="Bugünkü görünüm"
                />
              </label>

              <label className="field-stack">
                <span>Açıklama</span>
                <textarea
                  rows={5}
                  value={postDraft.body}
                  onChange={(event) => setPostDraft((state) => ({ ...state, body: event.target.value }))}
                  placeholder="Hedef, kırılım, risk ve izlediğin seviyeleri yaz"
                />
              </label>

              <label className="secondary-button profile-upload-button">
                <ImagePlus size={16} />
                Grafik görseli ekle
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0]

                    if (!file) {
                      return
                    }

                    const reader = new FileReader()
                    reader.onload = () => {
                      if (typeof reader.result === 'string') {
                        setPostDraft((state) => ({ ...state, snapshotDataUrl: reader.result }))
                      }
                    }
                    reader.readAsDataURL(file)
                  }}
                />
              </label>

              <button type="button" className="primary-button" disabled={isBusy} onClick={() => void publishDraft()}>
                <PenSquare size={16} />
                Profilde yayınla
              </button>

              {postFeedback ? <p className="hero-card__helper">{postFeedback}</p> : null}
            </div>
          </Panel>

          <Panel title="Trade notu ekle" subtitle="Kısa trade geçmişi">
            <div className="list-stack">
              <label className="field-stack">
                <span>Varlık ara</span>
                <input
                  value={tradeDraft.assetFilter}
                  onChange={(event) => setTradeDraft((state) => ({ ...state, assetFilter: event.target.value }))}
                  placeholder="BTC, THYAO, NVDA..."
                />
              </label>

              <label className="field-stack">
                <span>Varlık seç</span>
                <select
                  value={tradeDraft.assetId}
                  onChange={(event) => setTradeDraft((state) => ({ ...state, assetId: event.target.value }))}
                >
                  <option value="">Opsiyonel seçim</option>
                  {tradeAssetOptions.map((item) => (
                    <option key={item.assetId} value={item.assetId}>
                      {item.profile.symbol} - {item.profile.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="filter-chip-row">
                {(['positive', 'neutral', 'negative'] as TradeOutcomeTone[]).map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    className={tradeDraft.outcome === tone ? 'chip chip--active' : 'chip'}
                    onClick={() => setTradeDraft((state) => ({ ...state, outcome: tone }))}
                  >
                    {outcomeToneLabel[tone].label}
                  </button>
                ))}
              </div>

              <label className="field-stack">
                <span>Not</span>
                <textarea
                  rows={4}
                  value={tradeDraft.note}
                  onChange={(event) => setTradeDraft((state) => ({ ...state, note: event.target.value }))}
                  placeholder="Giriş, çıkış veya öğrenim notunu yaz"
                />
              </label>

              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  const trimmedNote = tradeDraft.note.trim()

                  if (!trimmedNote) {
                    return
                  }

                  const selectedAsset = assetLookup.get(tradeDraft.assetId)
                  onAddTradeEntry({
                    assetId: tradeDraft.assetId || undefined,
                    assetSymbol: selectedAsset?.profile.symbol || tradeDraft.assetFilter || 'GENEL',
                    note: trimmedNote,
                    outcome: tradeDraft.outcome
                  })
                  setTradeDraft({
                    assetFilter: '',
                    assetId: '',
                    note: '',
                    outcome: 'neutral'
                  })
                }}
              >
                <CandlestickChart size={16} />
                Trade notunu ekle
              </button>
            </div>
          </Panel>
        </div>
      ) : null}

      <div className="home-quick-grid">
        <Panel title="Grafik paylaşımları" subtitle="Profilde yayınlanan analizler, çizimler ve hedefler">
          {isLoading && !reviewPosts.length ? (
            <StateCard
              title="İncelemeler yükleniyor"
              description="Profil akışı bağlanırken kısa bir gecikme olabilir."
            />
          ) : reviewPosts.length ? (
            <div className="list-stack">
              {isLoading ? <p className="hero-card__helper">İncelemeler arka planda güncelleniyor.</p> : null}
              {reviewPosts.map((post) => (
                <article key={post.id} className="list-card social-post-card social-post-card--review">
                  <div className="list-card__header">
                    <div className="mini-list__label">
                      <PenSquare size={16} />
                      <strong>{post.title}</strong>
                    </div>
                    <StatusPill label="İnceleme" tone="info" />
                  </div>
                  {post.assetId ? (
                    <button type="button" className="chip" onClick={() => onSelectAsset(post.assetId)}>
                      {post.assetSymbol ?? assetLookup.get(post.assetId)?.profile.symbol ?? 'Varlık'}
                    </button>
                  ) : null}
                  {post.snapshotDataUrl ? (
                    <img src={post.snapshotDataUrl} alt={post.title} className="social-post-card__image" />
                  ) : null}
                  <p>{post.body}</p>
                  <div className="meta-row">
                    <span>{formatDateTime(post.createdAt)}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <StateCard
              title="İnceleme yok"
              description="Bu profilde henüz grafik odaklı bir inceleme paylaşılmadı."
            />
          )}
        </Panel>

        <Panel title="Yorumlar" subtitle="Herkese açık profil duvarı">
          <div className="list-stack social-wall">
            <div className="social-wall__composer">
              <div className="inline-form social-composer">
                <input
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                  placeholder="Bu profile herkese açık yorum bırak"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void submitComment()
                    }
                  }}
                />
                <button type="button" className="primary-button" onClick={() => void submitComment()}>
                  <Send size={16} />
                  Gönder
                </button>
              </div>
              <GifPicker gifUrl={commentGifUrl || undefined} onChange={(value) => setCommentGifUrl(value ?? '')} />
            </div>

            {commentFeedback ? <p className="hero-card__helper">{commentFeedback}</p> : null}
            {statusMessage ? <p className="hero-card__helper">{statusMessage}</p> : null}
            {errorMessage ? <p className="negative-text">{errorMessage}</p> : null}
            {isLoading && comments.length ? (
              <p className="hero-card__helper">Yorumlar arka planda güncelleniyor.</p>
            ) : null}

            {comments.length ? (
              <div className="list-stack social-wall__list">
                {comments.map((comment) => (
                  <article key={comment.id} className="list-card social-comment-card social-comment-card--wall">
                    <div className="social-profile-card__header">
                      <SocialAvatar
                        className="social-avatar social-avatar--mini"
                        displayName={comment.authorDisplayName}
                        username={comment.authorUsername}
                        avatarDataUrl={comment.authorAvatarDataUrl}
                      />
                      <div className="social-profile-card__title">
                        <strong>{comment.authorDisplayName}</strong>
                        <p>@{comment.authorUsername}</p>
                      </div>
                    </div>
                    <SocialRichContentView text={comment.body} gifUrl={comment.gifUrl} />
                    <div className="meta-row">
                      <span>{formatDateTime(comment.createdAt)}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <StateCard
                title="Yorum yok"
                description="Bu profil için henüz herkese açık bir yorum bırakılmadı."
              />
            )}
          </div>
        </Panel>
      </div>

      <div className="home-quick-grid">
        <Panel title="Diğer paylaşımlar" subtitle="Trade notları ve kısa durum güncellemeleri">
          {activityPosts.length ? (
            <div className="list-stack">
              {activityPosts.map((post) => (
                <article key={post.id} className="list-card social-post-card">
                  <div className="list-card__header">
                    <div className="mini-list__label">
                      <Eye size={16} />
                      <strong>{post.title}</strong>
                    </div>
                    <StatusPill label={postTypeLabel[post.type]} tone="neutral" />
                  </div>
                  {post.assetId ? (
                    <button type="button" className="chip" onClick={() => onSelectAsset(post.assetId)}>
                      {post.assetSymbol ?? assetLookup.get(post.assetId)?.profile.symbol ?? 'Varlık'}
                    </button>
                  ) : null}
                  <p>{post.body}</p>
                  <div className="meta-row">
                    <span>{formatDateTime(post.createdAt)}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <StateCard
              title="Ek paylaşım yok"
              description="Trade ve kısa durum notları burada görünür."
            />
          )}
        </Panel>

        {profile.publicListNames.length ? (
          <Panel title="Açık listeler" subtitle="Piyasa odaklı koleksiyonlar">
            <div className="asset-chip-row">
              {profile.publicListNames.map((listName) => (
                <span key={listName} className="chip">
                  <Eye size={14} />
                  {listName}
                </span>
              ))}
            </div>
          </Panel>
        ) : (
          <Panel title="Açık listeler" subtitle="Piyasa odaklı koleksiyonlar">
            <StateCard
              title="Açık liste yok"
              description="Bu profil şu an herkese açık bir liste göstermiyor."
            />
          </Panel>
        )}
      </div>
    </div>
  )
}



