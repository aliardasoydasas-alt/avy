import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { createId } from '@renderer/utils/id'
import type { AiNotificationHistoryItem } from '@shared/types/ai-hub'

const HISTORY_LIMIT = 40
const HISTORY_COOLDOWN_MS = 1000 * 60 * 75

interface AiHubStore {
  history: AiNotificationHistoryItem[]
  recordHistory: (items: Array<Omit<AiNotificationHistoryItem, 'id'>>) => void
  clearHistory: () => void
  hydrateHistory: (history: AiNotificationHistoryItem[]) => void
}

export const useAiHubStore = create<AiHubStore>()(
  persist(
    (set) => ({
      history: [],
      recordHistory: (items) =>
        set((state) => {
          if (!items.length) {
            return state
          }

          const nextHistory = [...state.history]
          let addedCount = 0

          items.forEach((item) => {
            const duplicate = nextHistory.find((historyItem) => {
              if (historyItem.dedupeKey !== item.dedupeKey) {
                return false
              }

              return (
                new Date(item.createdAt).getTime() - new Date(historyItem.createdAt).getTime() <
                HISTORY_COOLDOWN_MS
              )
            })

            if (duplicate) {
              return
            }

            nextHistory.unshift({
              ...item,
              id: createId('ai-history')
            })
            addedCount += 1
          })

          if (!addedCount) {
            return state
          }

          return {
            history: nextHistory
              .sort(
                (left, right) =>
                  new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
              )
              .slice(0, HISTORY_LIMIT)
          }
        }),
      clearHistory: () => set({ history: [] }),
      hydrateHistory: (history) =>
        set(() => ({
          history
        }))
    }),
    {
      name: 'avy-ai-hub-store',
      version: 1,
      storage: createJSONStorage(() => localStorage)
    }
  )
)
