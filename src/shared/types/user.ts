export type ProfileSection = 'overview' | 'holdings' | 'settings'
export type PortfolioVisibility = 'public' | 'friends' | 'private'
export type ThemeMode = 'dark' | 'light'

export interface NotificationPreferences {
  alerts: boolean
  patterns: boolean
  ai: boolean
  news: boolean
  system: boolean
  social: boolean
  desktop: boolean
  live: boolean
}

export interface SoundPreferences {
  enabled: boolean
  volume: number
  ui: boolean
  messages: boolean
  notifications: boolean
}

export interface LiveNotificationSettings {
  enabled: boolean
  mobileEnabled: boolean
  ntfyTopic: string
  deviceLabel: string
  portfolioGoalTry?: number
}

export interface UserSettings {
  notifications: NotificationPreferences
  sound: SoundPreferences
  portfolioVisibility: PortfolioVisibility
  themeMode: ThemeMode
  liveNotifications: LiveNotificationSettings
}
