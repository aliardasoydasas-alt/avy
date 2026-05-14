import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { UserSettings } from '@shared/types/user'

const initialSettings: UserSettings = {
  notifications: {
    alerts: true,
    patterns: true,
    ai: true,
    news: true,
    system: true,
    social: true,
    desktop: true,
    live: true
  },
  sound: {
    enabled: true,
    volume: 34,
    ui: true,
    messages: true,
    notifications: true
  },
  portfolioVisibility: 'friends',
  themeMode: 'dark',
  liveNotifications: {
    enabled: true,
    mobileEnabled: false,
    ntfyTopic: '',
    deviceLabel: 'Telefonum'
  }
}

interface SettingsStore {
  settings: UserSettings
  setNotificationPreference: (key: keyof UserSettings['notifications'], enabled: boolean) => void
  setSoundPreference: (key: keyof UserSettings['sound'], value: boolean | number) => void
  setPortfolioVisibility: (visibility: UserSettings['portfolioVisibility']) => void
  setThemeMode: (themeMode: UserSettings['themeMode']) => void
  setLiveNotificationSetting: <Key extends keyof UserSettings['liveNotifications']>(
    key: Key,
    value: UserSettings['liveNotifications'][Key]
  ) => void
  hydrateSettings: (settings: UserSettings) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: initialSettings,
      setNotificationPreference: (key, enabled) =>
        set((state) => ({
          settings: {
            ...state.settings,
            notifications: {
              ...state.settings.notifications,
              [key]: enabled
            }
          }
        })),
      setSoundPreference: (key, value) =>
        set((state) => ({
          settings: {
            ...state.settings,
            sound: {
              ...state.settings.sound,
              [key]: value
            }
          }
        })),
      setPortfolioVisibility: (portfolioVisibility) =>
        set((state) => ({
          settings: {
            ...state.settings,
            portfolioVisibility
          }
        })),
      setThemeMode: (themeMode) =>
        set((state) => ({
          settings: {
            ...state.settings,
            themeMode
          }
        })),
      setLiveNotificationSetting: (key, value) =>
        set((state) => ({
          settings: {
            ...state.settings,
            liveNotifications: {
              ...state.settings.liveNotifications,
              [key]: value
            }
          }
        })),
      hydrateSettings: (settings) =>
        set(() => ({
          settings: {
            ...initialSettings,
            ...settings,
            notifications: {
              ...initialSettings.notifications,
              ...(settings.notifications ?? {})
            },
            sound: {
              ...initialSettings.sound,
              ...(settings.sound ?? {})
            },
            liveNotifications: {
              ...initialSettings.liveNotifications,
              ...(settings.liveNotifications ?? {})
            }
          }
        }))
    }),
    {
      name: 'avy-settings-store',
      version: 4,
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState) => {
        const state = persistedState as Partial<SettingsStore> | undefined

        if (!state) {
          return state
        }

        return {
          settings: {
            ...initialSettings,
            ...(state.settings ?? {}),
            notifications: {
              ...initialSettings.notifications,
              ...(state.settings?.notifications ?? {})
            },
            sound: {
              ...initialSettings.sound,
              ...(state.settings?.sound ?? {})
            },
            liveNotifications: {
              ...initialSettings.liveNotifications,
              ...(state.settings?.liveNotifications ?? {})
            }
          }
        }
      }
    }
  )
)
