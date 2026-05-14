import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { createId } from '@renderer/utils/id'

export interface AssetChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  createdAt: string
}

interface AssetChatStore {
  conversations: Record<string, AssetChatMessage[]>
  addMessage: (assetId: string, role: AssetChatMessage['role'], text: string) => AssetChatMessage
  clearConversation: (assetId: string) => void
  hydrateConversations: (conversations: Record<string, AssetChatMessage[]>) => void
}

export const useAssetChatStore = create<AssetChatStore>()(
  persist(
    (set) => ({
      conversations: {},
      addMessage: (assetId, role, text) => {
        const message: AssetChatMessage = {
          id: createId('asset-chat'),
          role,
          text: text.trim(),
          createdAt: new Date().toISOString()
        }

        set((state) => ({
          conversations: {
            ...state.conversations,
            [assetId]: [...(state.conversations[assetId] ?? []), message].slice(-40)
          }
        }))

        return message
      },
      clearConversation: (assetId) =>
        set((state) => ({
          conversations: {
            ...state.conversations,
            [assetId]: []
          }
        })),
      hydrateConversations: (conversations) =>
        set(() => ({
          conversations
        }))
    }),
    {
      name: 'avy-asset-chat-store',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState) => {
        const state = persistedState as Partial<AssetChatStore> | undefined

        if (!state?.conversations) {
          return {
            conversations: {}
          }
        }

        const conversations = Object.fromEntries(
          Object.entries(state.conversations).map(([assetId, messages]) => [
            assetId,
            (messages ?? [])
              .filter((message): message is Partial<AssetChatMessage> => Boolean(message))
              .map((message) => ({
                id: message.id ?? createId('asset-chat'),
                role: message.role === 'assistant' ? 'assistant' : 'user',
                text: typeof message.text === 'string' ? message.text : '',
                createdAt:
                  typeof message.createdAt === 'string' && !Number.isNaN(new Date(message.createdAt).getTime())
                    ? message.createdAt
                    : new Date().toISOString()
              }))
              .filter((message) => message.text.trim().length > 0)
              .slice(-40)
          ])
        )

        return { conversations }
      }
    }
  )
)
