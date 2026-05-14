import { useEffect, useMemo, useState } from 'react'
import { BellRing, ImagePlus, MessageCircleMore, Send, X } from 'lucide-react'
import { GifPicker } from '@renderer/components/gif-picker'
import { SocialRichContentView } from '@renderer/components/social-rich-content'
import { SocialAvatar } from '@renderer/features/social/social-avatar'
import { useSocialCloud } from '@renderer/hooks/use-social-cloud'
import { formatRelativeTime } from '@renderer/utils/format'

const messageStatusLabel = {
  sending: 'gönderiliyor',
  sent: 'gönderildi',
  delivered: 'iletildi',
  seen: 'görüldü'
} as const

interface SocialChatDockProps {
  social: ReturnType<typeof useSocialCloud>
  onOpenSocialScreen: () => void
}

export const SocialChatDock = ({ social, onOpenSocialScreen }: SocialChatDockProps) => {
  const [messageDraft, setMessageDraft] = useState('')
  const [messageGifUrl, setMessageGifUrl] = useState('')
  const [isGifPickerOpen, setIsGifPickerOpen] = useState(false)

  const unreadTotal = useMemo(
    () =>
      Object.values(social.unreadCounts).reduce((sum, value) => sum + value, 0) +
      social.incomingRequests.length,
    [social.incomingRequests.length, social.unreadCounts]
  )

  const selectedFriend = social.selectedFriend
  const conversation = selectedFriend ? social.conversations[selectedFriend.id] ?? [] : []

  useEffect(() => {
    if (!social.isChatOpen || social.selectedFriendId || !social.contacts[0]?.id) {
      return
    }

    social.openChat(social.contacts[0].id)
  }, [social.contacts, social.isChatOpen, social.selectedFriendId])

  const sendMessage = async (): Promise<void> => {
    if (!selectedFriend) {
      return
    }

    const trimmedText = messageDraft.trim()
    const trimmedGif = messageGifUrl.trim()

    if (!trimmedText && !trimmedGif) {
      return
    }

    await social.sendMessageToFriend(selectedFriend.id, {
      text: trimmedText,
      gifUrl: trimmedGif || undefined
    })
    setMessageDraft('')
    setMessageGifUrl('')
    setIsGifPickerOpen(false)
  }

  if (!social.isConfigured || !social.sessionUserId) {
    return null
  }

  return (
    <div className="social-dock">
      {social.isChatOpen ? (
        <section className="social-dock__panel">
          <header className="social-dock__header">
            <div>
              <strong>Mesajlar</strong>
              <p>{selectedFriend ? selectedFriend.displayName : 'Arkadaş seç'}</p>
            </div>
            <div className="social-dock__header-actions">
              {social.incomingRequests.length ? (
                <button type="button" className="text-button" onClick={onOpenSocialScreen}>
                  <BellRing size={16} />
                  {social.incomingRequests.length} istek
                </button>
              ) : null}
              <button type="button" className="text-button" onClick={() => social.closeChat()}>
                <X size={16} />
              </button>
            </div>
          </header>

          <div className="social-dock__body">
            <aside className="social-dock__friends">
              {social.contacts.length ? (
                social.contacts.map((friend) => (
                  <button
                    key={friend.id}
                    type="button"
                    className={
                      friend.id === selectedFriend?.id
                        ? 'social-dock__friend social-dock__friend--active'
                        : 'social-dock__friend'
                    }
                    onClick={() => social.openChat(friend.id)}
                  >
                    <SocialAvatar
                      className="social-avatar social-avatar--mini"
                      displayName={friend.displayName}
                      username={friend.username}
                      avatarDataUrl={friend.avatarDataUrl}
                    />
                    <div className="social-dock__friend-meta">
                      <strong>{friend.displayName}</strong>
                      <p>@{friend.username}</p>
                    </div>
                    {social.unreadCounts[friend.id] ? (
                      <span className="notification-count">{social.unreadCounts[friend.id]}</span>
                    ) : null}
                  </button>
                ))
              ) : (
                <div className="social-dock__empty">
                  <strong>Arkadaş yok</strong>
                  <p>Önce sosyal sayfadan bir isteği kabul et.</p>
                </div>
              )}
            </aside>

            <div className="social-dock__chat">
              {selectedFriend ? (
                <>
                  <div className="social-dock__chat-header">
                    <div className="mini-list__label">
                      <SocialAvatar
                        className="social-avatar social-avatar--mini"
                        displayName={selectedFriend.displayName}
                        username={selectedFriend.username}
                        avatarDataUrl={selectedFriend.avatarDataUrl}
                      />
                      <div>
                        <strong>{selectedFriend.displayName}</strong>
                        <p>@{selectedFriend.username}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => void social.sendPokeToFriend(selectedFriend.id)}
                    >
                      Dürt
                    </button>
                  </div>

                  <div className="social-dock__messages">
                    {conversation.length ? (
                      conversation.map((message) => (
                        <article
                          key={message.id}
                          className={
                            message.sender === 'self'
                              ? 'social-dock__message social-dock__message--self'
                              : 'social-dock__message'
                          }
                        >
                          <SocialRichContentView
                            text={message.text}
                            gifUrl={message.gifUrl}
                            imageUrl={message.imageUrl}
                          />
                          <span>
                            {formatRelativeTime(message.sentAt)}
                            {message.sender === 'self' && message.status
                              ? ` • ${messageStatusLabel[message.status]}`
                              : ''}
                          </span>
                        </article>
                      ))
                    ) : (
                      <div className="social-dock__empty">
                        <strong>Sohbet başlamadı</strong>
                        <p>İlk mesajı göndererek konuşmayı başlat.</p>
                      </div>
                    )}
                  </div>

                  {isGifPickerOpen ? (
                    <div className="social-dock__gif-panel">
                      <GifPicker gifUrl={messageGifUrl || undefined} onChange={(value) => setMessageGifUrl(value ?? '')} />
                    </div>
                  ) : null}

                  <div className="social-dock__composer">
                    <button
                      type="button"
                      className={isGifPickerOpen ? 'icon-button chip--active' : 'icon-button'}
                      onClick={() => setIsGifPickerOpen((current) => !current)}
                      title="GIF seç"
                    >
                      <ImagePlus size={15} />
                    </button>
                    <input
                      value={messageDraft}
                      onChange={(event) => setMessageDraft(event.target.value)}
                      placeholder="Mesaj yaz"
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          void sendMessage()
                        }
                      }}
                    />
                    <button type="button" className="primary-button" onClick={() => void sendMessage()}>
                      <Send size={16} />
                    </button>
                  </div>
                </>
              ) : (
                <div className="social-dock__empty">
                  <strong>Sohbet seç</strong>
                  <p>Soldan bir arkadaş seç ya da sosyal sayfayı aç.</p>
                  <button type="button" className="secondary-button" onClick={onOpenSocialScreen}>
                    Sosyal sayfayı aç
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      ) : (
        <button type="button" className="social-dock__launcher" onClick={() => social.setIsChatOpen(true)}>
          <MessageCircleMore size={18} />
          Mesajlar
          {unreadTotal ? <span className="notification-count">{unreadTotal}</span> : null}
        </button>
      )}
    </div>
  )
}
