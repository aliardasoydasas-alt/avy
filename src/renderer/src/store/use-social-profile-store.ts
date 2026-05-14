import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { DEFAULT_PROFILE_SHOWCASE, normalizeProfileShowcase } from '@renderer/services/social-profile-showcase'
import { createId } from '@renderer/utils/id'
import type {
  ProfileShowcaseSettings,
  TradeJournalEntry,
  TradeOutcomeTone
} from '@shared/types/social'

interface AddTradeEntryInput {
  assetId?: string
  assetSymbol: string
  note: string
  outcome: TradeOutcomeTone
}

interface SocialProfileStore {
  tradeJournal: TradeJournalEntry[]
  showcase: ProfileShowcaseSettings
  addTradeEntry: (input: AddTradeEntryInput) => void
  removeTradeEntry: (entryId: string) => void
  setWallpaper: (wallpaperId: string) => void
  setBackgroundPreset: (backgroundPresetId: string) => void
  hydrateShowcase: (showcase?: Partial<ProfileShowcaseSettings> | null) => void
  hydrateSocialProfileState: (input: {
    tradeJournal: TradeJournalEntry[]
    showcase?: Partial<ProfileShowcaseSettings> | null
  }) => void
}

export const useSocialProfileStore = create<SocialProfileStore>()(
  persist(
    (set) => ({
      tradeJournal: [],
      showcase: DEFAULT_PROFILE_SHOWCASE,
      addTradeEntry: ({ assetId, assetSymbol, note, outcome }) =>
        set((state) => ({
          tradeJournal: [
            {
              id: createId('trade-journal'),
              assetId,
              assetSymbol: assetSymbol.trim().toUpperCase(),
              note: note.trim(),
              outcome,
              createdAt: new Date().toISOString()
            },
            ...state.tradeJournal
          ].slice(0, 40)
        })),
      removeTradeEntry: (entryId) =>
        set((state) => ({
          tradeJournal: state.tradeJournal.filter((entry) => entry.id !== entryId)
        })),
      setWallpaper: (wallpaperId) =>
        set((state) => {
          const nextShowcase = normalizeProfileShowcase({
            ...state.showcase,
            wallpaperId
          })

          if (
            state.showcase.wallpaperId === nextShowcase.wallpaperId &&
            state.showcase.backgroundPresetId === nextShowcase.backgroundPresetId
          ) {
            return state
          }

          return {
            showcase: nextShowcase
          }
        }),
      setBackgroundPreset: (backgroundPresetId) =>
        set((state) => {
          const nextShowcase = normalizeProfileShowcase({
            ...state.showcase,
            backgroundPresetId
          })

          if (
            state.showcase.wallpaperId === nextShowcase.wallpaperId &&
            state.showcase.backgroundPresetId === nextShowcase.backgroundPresetId
          ) {
            return state
          }

          return {
            showcase: nextShowcase
          }
        }),
      hydrateShowcase: (showcase) =>
        set((state) => {
          const nextShowcase = normalizeProfileShowcase(showcase)

          if (
            state.showcase.wallpaperId === nextShowcase.wallpaperId &&
            state.showcase.backgroundPresetId === nextShowcase.backgroundPresetId
          ) {
            return state
          }

          return {
            showcase: nextShowcase
          }
        }),
      hydrateSocialProfileState: ({ tradeJournal, showcase }) =>
        set(() => ({
          tradeJournal: tradeJournal ?? [],
          showcase: normalizeProfileShowcase(showcase)
        }))
    }),
    {
      name: 'avy-social-profile-store',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState) => {
        const state = persistedState as Partial<SocialProfileStore> | undefined

        if (!state) {
          return state
        }

        return {
          ...state,
          tradeJournal: state.tradeJournal ?? [],
          showcase: normalizeProfileShowcase(state.showcase)
        }
      }
    }
  )
)
