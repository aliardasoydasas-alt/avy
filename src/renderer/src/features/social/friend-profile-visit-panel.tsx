import { BellRing, Eye, MessageCircle, X } from 'lucide-react'
import { Panel } from '@renderer/components/panel'
import { StateCard } from '@renderer/components/state-card'
import { StatusPill } from '@renderer/components/status-pill'
import { SocialAvatar } from '@renderer/features/social/social-avatar'
import { formatDateTime } from '@renderer/utils/format'
import type { MarketOverviewItem } from '@shared/types/market'
import type { FriendProfile } from '@shared/types/social'

interface FriendProfileVisitPanelProps {
  friend: FriendProfile | null
  assetLookup: Map<string, MarketOverviewItem>
  onSelectAsset: (assetId: string) => void
  onOpenChat: (friendId: string) => void
  onSendPoke: (friendId: string) => void
  onClose: () => void
}

const presenceTone = {
  online: 'positive',
  busy: 'negative',
  away: 'neutral',
  offline: 'neutral'
} as const

const presenceLabel = {
  online: 'Cevrim ici',
  busy: 'Mesgul',
  away: 'Az once aktifti',
  offline: 'Cevrim disi'
} as const

export const FriendProfileVisitPanel = ({
  friend,
  assetLookup,
  onSelectAsset,
  onOpenChat,
  onSendPoke,
  onClose
}: FriendProfileVisitPanelProps) => (
  <Panel
    title="Profil ziyareti"
    subtitle={friend ? friend.displayName : 'Arkadas sec'}
    action={
      friend ? (
        <button type="button" className="icon-button" onClick={onClose} aria-label="Profili kapat">
          <X size={16} />
        </button>
      ) : undefined
    }
  >
    {friend ? (
      <div className="list-stack">
        <article className="list-card social-visit-card">
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

          <p>{friend.bio || 'Bu kullanici henuz bir bio eklememis.'}</p>

          <div className="meta-row">
            <span>Katilim</span>
            <strong>{formatDateTime(friend.joinedAt)}</strong>
          </div>

          <div className="social-visit-card__actions">
            <button type="button" className="primary-button" onClick={() => onOpenChat(friend.id)}>
              <MessageCircle size={16} />
              Sohbeti ac
            </button>
            <button type="button" className="secondary-button" onClick={() => onSendPoke(friend.id)}>
              <BellRing size={16} />
              Durt
            </button>
          </div>
        </article>

        <article className="list-card">
          <div className="mini-list__label">
            <Eye size={16} />
            <strong>Acik takip edilen varliklar</strong>
          </div>
          {friend.publicAssetIds.length ? (
            <div className="asset-chip-row">
              {friend.publicAssetIds.map((assetId) => (
                <button
                  key={assetId}
                  type="button"
                  className="chip"
                  onClick={() => onSelectAsset(assetId)}
                >
                  {assetLookup.get(assetId)?.profile.symbol ?? assetId.split(':').at(-1)}
                </button>
              ))}
            </div>
          ) : (
            <p>Bu profil su an acik varlik paylasmiyor.</p>
          )}
        </article>

        <article className="list-card">
          <div className="mini-list__label">
            <Eye size={16} />
            <strong>Acik izleme listeleri</strong>
          </div>
          {friend.publicListNames.length ? (
            <div className="asset-chip-row">
              {friend.publicListNames.map((listName) => (
                <span key={listName} className="chip">
                  {listName}
                </span>
              ))}
            </div>
          ) : (
            <p>Paylasilan izleme listesi bulunmuyor.</p>
          )}
        </article>
      </div>
    ) : (
      <StateCard
        title="Profil sec"
        description="Arkadas listenden ya da arama sonuclarindan bir profili acarak detaylarini burada gorebilirsin."
      />
    )}
  </Panel>
)
