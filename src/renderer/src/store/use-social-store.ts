import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { sendDesktopNotification } from '@renderer/services/notification-service'
import { getFriendById } from '@renderer/services/social-directory'
import { useTerminalStore } from '@renderer/store/use-terminal-store'
import { createId } from '@renderer/utils/id'
import type { FriendProfile, SocialMessage, SocialPokeEvent, UserProfile } from '@shared/types/social'

const initialProfile: UserProfile = {
  id: 'local-user',
  username: '',
  displayName: 'Yeni kullanici',
  bio: '',
  joinedAt: new Date().toISOString()
}

const initialFriendIds: string[] = []

const initialMessages: Record<string, SocialMessage[]> = {}

interface ProfileDraftInput {
  username: string
  displayName: string
  bio: string
}

interface SocialStore {
  currentUser: UserProfile
  friendIds: string[]
  selectedFriendId: string
  conversations: Record<string, SocialMessage[]>
  pokeHistory: SocialPokeEvent[]
  updateProfile: (input: ProfileDraftInput) => void
  updateAvatar: (avatarDataUrl?: string) => void
  addFriend: (friendId: string) => boolean
  selectFriend: (friendId: string) => void
  sendMessage: (friendId: string, text: string) => void
  markConversationRead: (friendId: string) => void
  pokeFriend: (friendId: string) => void
}

const pushSocialNotification = async (
  title: string,
  message: string,
  dedupeKey: string
): Promise<void> => {
  const terminalStore = useTerminalStore.getState()
  const pushed = terminalStore.pushNotification({
    title,
    message,
    timestamp: new Date().toISOString(),
    scope: 'social',
    dedupeKey
  })

  if (pushed) {
    await sendDesktopNotification(title, message)
  }
}

export const useSocialStore = create<SocialStore>()(
  persist(
    (set, get) => ({
      currentUser: initialProfile,
      friendIds: initialFriendIds,
      selectedFriendId: initialFriendIds[0],
      conversations: initialMessages,
      pokeHistory: [],

      updateProfile: (input) =>
        set((state) => {
          const username = input.username.trim()
          const displayName = input.displayName.trim() || username || 'Yeni kullanici'
          const bio = input.bio.trim()

          if (
            state.currentUser.username === username &&
            state.currentUser.displayName === displayName &&
            state.currentUser.bio === bio
          ) {
            return state
          }

          return {
            currentUser: {
              ...state.currentUser,
              username,
              displayName,
              bio
            }
          }
        }),

      updateAvatar: (avatarDataUrl) =>
        set((state) => {
          if (state.currentUser.avatarDataUrl === avatarDataUrl) {
            return state
          }

          return {
            currentUser: {
              ...state.currentUser,
              avatarDataUrl
            }
          }
        }),

      addFriend: (friendId) => {
        const friend = getFriendById(friendId)

        if (!friend || get().friendIds.includes(friendId)) {
          return false
        }

        set((state) => ({
          friendIds: [friendId, ...state.friendIds],
          selectedFriendId: friendId,
          conversations: {
            ...state.conversations,
            [friendId]:
              state.conversations[friendId] ??
              [
                {
                  id: createId('social-message'),
                  friendId,
                  sender: 'friend',
                  text: `${friend.displayName} profilini paylasti. Sohbeti baslatmak istersen buradan mesaj yazabilirsin.`,
                  sentAt: new Date().toISOString(),
                  read: false
                }
              ]
          }
        }))

        void pushSocialNotification(
          'Yeni arkadas eklendi',
          `${friend.displayName} artik arkadas listende.`,
          `friend-added:${friendId}`
        )

        return true
      },

      selectFriend: (friendId) => set({ selectedFriendId: friendId }),

      sendMessage: (friendId, text) => {
        const trimmed = text.trim()

        if (!trimmed) {
          return
        }

        set((state) => ({
          selectedFriendId: friendId,
          conversations: {
            ...state.conversations,
            [friendId]: [
              ...(state.conversations[friendId] ?? []),
              {
                id: createId('social-message'),
                friendId,
                sender: 'self',
                text: trimmed,
                sentAt: new Date().toISOString(),
                read: true
              }
            ]
          }
        }))

        const friend = getFriendById(friendId)

        if (!friend) {
          return
        }

        void pushSocialNotification(
          'Mesaj hazirlandi',
          `${friend.displayName} ile sohbet gecmisine yeni bir mesaj eklendi.`,
          `social-message:${friendId}:${Date.now()}`
        )
      },

      markConversationRead: (friendId) =>
        set((state) => ({
          conversations: {
            ...state.conversations,
            [friendId]: (state.conversations[friendId] ?? []).map((message) =>
              message.sender === 'friend'
                ? {
                    ...message,
                    read: true
                  }
                : message
            )
          }
        })),

      pokeFriend: (friendId) => {
        const friend = getFriendById(friendId)

        if (!friend) {
          return
        }

        set((state) => ({
          pokeHistory: [
            {
              id: createId('social-poke'),
              friendId,
              direction: 'outgoing',
              sentAt: new Date().toISOString()
            },
            ...state.pokeHistory
          ].slice(0, 24)
        }))

        void pushSocialNotification(
          `${friend.displayName} durtuldu`,
          'Arkadasina durtme bildirimi gonderildi.',
          `poke-out:${friendId}:${Date.now()}`
        )
      }
    }),
    {
      name: 'avy-social-store',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState) => {
        const state = persistedState as Partial<SocialStore> | undefined

        if (!state) {
          return state
        }

        return {
          currentUser: {
            ...initialProfile,
            ...(state.currentUser ?? {})
          },
          friendIds: state.friendIds?.length ? state.friendIds : initialFriendIds,
          selectedFriendId: state.selectedFriendId ?? state.friendIds?.[0] ?? initialFriendIds[0],
          conversations: state.conversations ?? initialMessages,
          pokeHistory: state.pokeHistory ?? []
        }
      }
    }
  )
)

export const getSelectedFriend = (
  friendIds: string[],
  selectedFriendId: string
): FriendProfile | undefined => {
  const fallbackId = friendIds.includes(selectedFriendId) ? selectedFriendId : friendIds[0]
  return fallbackId ? getFriendById(fallbackId) : undefined
}
