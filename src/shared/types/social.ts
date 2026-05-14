import type { PortfolioVisibility } from '@shared/types/user'

export type SocialPresence = 'online' | 'busy' | 'away' | 'offline'
export type SocialPostType = 'analysis' | 'trade' | 'note'
export type TradeOutcomeTone = 'positive' | 'negative' | 'neutral'
export type SocialMessageStatus = 'sending' | 'sent' | 'delivered' | 'seen'

export interface ProfileShowcaseSettings {
  wallpaperId: string
  backgroundPresetId: string
}

export interface UserProfile {
  id: string
  username: string
  displayName: string
  bio: string
  avatarDataUrl?: string
  joinedAt: string
}

export interface PublicHoldingSummary {
  assetId: string
  symbol: string
  name: string
  amount: number
  totalValueTry?: number
  dailyChangePercent?: number
}

export interface TradeJournalEntry {
  id: string
  assetId?: string
  assetSymbol: string
  note: string
  outcome: TradeOutcomeTone
  createdAt: string
}

export interface FriendProfile {
  id: string
  username: string
  displayName: string
  bio: string
  joinedAt: string
  location?: string
  avatarDataUrl?: string
  accentColor: string
  presence: SocialPresence
  portfolioVisibility: PortfolioVisibility
  publicAssetIds: string[]
  publicListNames: string[]
  publicHoldings: PublicHoldingSummary[]
  tradeJournal: TradeJournalEntry[]
  showcase: ProfileShowcaseSettings
}

export interface SocialMessage {
  id: string
  friendId: string
  sender: 'self' | 'friend'
  text: string
  gifUrl?: string
  imageUrl?: string
  sentAt: string
  read: boolean
  status?: SocialMessageStatus
}

export interface SocialPokeEvent {
  id: string
  friendId: string
  direction: 'outgoing' | 'incoming'
  sentAt: string
}

export interface SocialProfilePost {
  id: string
  userId: string
  type: SocialPostType
  assetId?: string
  assetSymbol?: string
  title: string
  body: string
  snapshotDataUrl?: string
  createdAt: string
}

export interface SocialProfileComment {
  id: string
  profileUserId: string
  authorId: string
  authorUsername: string
  authorDisplayName: string
  authorAvatarDataUrl?: string
  body: string
  gifUrl?: string
  createdAt: string
}
