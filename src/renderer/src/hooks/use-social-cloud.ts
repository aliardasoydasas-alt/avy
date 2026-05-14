import { useEffect, useMemo, useRef, useState } from 'react'
import { sendDesktopNotification } from '@renderer/services/notification-service'
import { playAudioFeedback } from '@renderer/services/audio-feedback-service'
import { playSocialSound } from '@renderer/services/social-sound-service'
import {
  acceptSocialContact,
  addSocialContact,
  createProfileComment,
  createSocialPost,
  formatSocialAuthError,
  formatSocialBackendError,
  fetchConversation,
  fetchProfileComments,
  fetchRecentPokes,
  fetchSocialConnections,
  fetchSocialPostsForProfile,
  fetchSocialProfile,
  getSocialBackendClient,
  getCachedSocialSessionUserId,
  getSocialSession,
  onSocialAuthChange,
  searchProfilesByIdentifier,
  sendSocialMessage,
  sendSocialPoke,
  signInToSocialCloud,
  signOutFromSocialCloud,
  signUpToSocialCloud,
  subscribeToProfileFeed,
  subscribeToProfileUpdates,
  subscribeToSocialRoster,
  subscribeToSocialEvents,
  upsertSocialProfile
} from '@renderer/services/social-backend'
import {
  clearSocialRuntimeConfig,
  getSocialRuntimeConfig,
  isSocialConfigReady,
  saveSocialRuntimeConfig,
  type SocialRuntimeConfig
} from '@renderer/services/social-runtime-config'
import { useTerminalStore } from '@renderer/store/use-terminal-store'
import type {
  FriendProfile,
  ProfileShowcaseSettings,
  PublicHoldingSummary,
  SocialMessage,
  SocialPokeEvent,
  SocialProfileComment,
  SocialProfilePost,
  TradeJournalEntry,
  UserProfile
} from '@shared/types/social'

export type SocialAuthMode = 'login' | 'register'
type PresencePayload = { onlineAt: string }

interface SocialAuthFormInput {
  email: string
  password: string
  username: string
  displayName: string
}

interface SocialComposerInput {
  text?: string
  gifUrl?: string
  imageUrl?: string
}

const normalizeComposerInput = (input: SocialComposerInput | string): SocialComposerInput =>
  typeof input === 'string' ? { text: input } : input

const SOCIAL_FETCH_TIMEOUT_MS = 15_000
const SOCIAL_SEND_TIMEOUT_MS = 12_000
const SOCIAL_AUTH_TIMEOUT_MS = 15_000
const PROFILE_FEED_TIMEOUT_MS = 8_000
const OPTIMISTIC_MESSAGE_SETTLE_MS = 8_000
const MESSAGE_MATCH_WINDOW_MS = 30_000
const BACKGROUND_REFRESH_DELAYS_MS = [1_200, 4_000, 9_000]
const FRIEND_GAIN_ALERT_STORAGE_KEY = 'avy-social-gain-alerts'

const loadFriendGainAlertKeys = (): Set<string> => {
  try {
    const raw = window.localStorage.getItem(FRIEND_GAIN_ALERT_STORAGE_KEY)

    if (!raw) {
      return new Set()
    }

    const parsed = JSON.parse(raw) as string[]
    return new Set(parsed)
  } catch {
    return new Set()
  }
}

const persistFriendGainAlertKeys = (keys: Set<string>): void => {
  try {
    window.localStorage.setItem(FRIEND_GAIN_ALERT_STORAGE_KEY, JSON.stringify([...keys]))
  } catch {
    // Ignore storage quota issues and keep runtime set alive.
  }
}

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, ms))

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> => {
  let timer = 0

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = window.setTimeout(() => reject(new Error(message)), timeoutMs)
      })
    ])
  } finally {
    if (timer) {
      window.clearTimeout(timer)
    }
  }
}

const withRetry = async <T>(task: () => Promise<T>, attempts = 3): Promise<T> => {
  let lastError: unknown = null

  for (let index = 0; index < attempts; index += 1) {
    try {
      return await task()
    } catch (error) {
      lastError = error

      if (index === attempts - 1) {
        break
      }

      await delay(300 * (index + 1))
    }
  }

  throw lastError
}

interface SocialRuntimeOptions {
  currentUser: UserProfile
  publicAssetIds: string[]
  publicListNames: string[]
  publicHoldings: PublicHoldingSummary[]
  portfolioVisibility: 'public' | 'friends' | 'private'
  tradeJournal: TradeJournalEntry[]
  showcase: ProfileShowcaseSettings
  socialFeaturesEnabled?: boolean
  onHydrateProfile: (profile: {
    username: string
    displayName: string
    bio: string
    avatarDataUrl?: string
    showcase?: ProfileShowcaseSettings
  }) => void
}

const pushInboxNotification = async (
  title: string,
  message: string,
  dedupeKey: string,
  sound: 'message' | 'poke'
): Promise<void> => {
  const store = useTerminalStore.getState()
  const pushed = store.pushNotification({
    title,
    message,
    timestamp: new Date().toISOString(),
    scope: 'social',
    dedupeKey
  })

  if (pushed) {
    await playSocialSound(sound)
    await sendDesktopNotification(title, message)
  }
}

const mergeConversation = (
  current: Record<string, SocialMessage[]>,
  friendId: string,
  nextMessage: SocialMessage
): Record<string, SocialMessage[]> => {
  const existing = current[friendId] ?? []
  const nextMessages = existing.some((message) => message.id === nextMessage.id)
    ? existing.map((message) => (message.id === nextMessage.id ? { ...message, ...nextMessage } : message))
    : [...existing, nextMessage]

  return {
    ...current,
    [friendId]: nextMessages.sort(
      (left, right) => new Date(left.sentAt).getTime() - new Date(right.sentAt).getTime()
    )
  }
}

const isOptimisticMessage = (message: SocialMessage): boolean => message.id.startsWith('optimistic:')

const areEquivalentMessages = (left: SocialMessage, right: SocialMessage): boolean =>
  left.sender === right.sender &&
  left.friendId === right.friendId &&
  left.text === right.text &&
  (left.gifUrl ?? '') === (right.gifUrl ?? '') &&
  (left.imageUrl ?? '') === (right.imageUrl ?? '') &&
  Math.abs(new Date(left.sentAt).getTime() - new Date(right.sentAt).getTime()) <= MESSAGE_MATCH_WINDOW_MS

const normalizeConversationMessages = (messages: SocialMessage[]): SocialMessage[] => {
  const realMessages = messages.filter((message) => !isOptimisticMessage(message))
  const deduped = messages.filter(
    (message) =>
      !isOptimisticMessage(message) ||
      !realMessages.some((realMessage) => areEquivalentMessages(message, realMessage))
  )

  return deduped.map((message) =>
    isOptimisticMessage(message) &&
    message.status === 'sending' &&
    Date.now() - new Date(message.sentAt).getTime() > OPTIMISTIC_MESSAGE_SETTLE_MS
      ? { ...message, status: 'sent' }
      : message
  )
}

const mergeConversationList = (
  currentMessages: SocialMessage[] = [],
  nextMessages: SocialMessage[] = []
): SocialMessage[] => {
  const byId = new Map<string, SocialMessage>()

  ;[...currentMessages, ...nextMessages].forEach((message) => {
    const existing = byId.get(message.id)

    byId.set(message.id, {
      ...(existing ?? {}),
      ...message
    })
  })

  return normalizeConversationMessages([...byId.values()]).sort(
    (left, right) => new Date(left.sentAt).getTime() - new Date(right.sentAt).getTime()
  )
}

const mergeById = <T extends { id: string; createdAt: string }>(
  currentItems: T[] = [],
  nextItems: T[] = []
): T[] => {
  const byId = new Map<string, T>()

  ;[...currentItems, ...nextItems].forEach((item) => {
    byId.set(item.id, item)
  })

  return [...byId.values()].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  )
}

const clearUnread = (
  current: Record<string, number>,
  friendId: string
): Record<string, number> => {
  if (!current[friendId]) {
    return current
  }

  return {
    ...current,
    [friendId]: 0
  }
}

const applyPresenceToProfile = (
  profile: FriendProfile,
  onlineUserIds: Set<string>
): FriendProfile => ({
  ...profile,
  presence: onlineUserIds.has(profile.id) ? 'online' : 'offline'
})

const applyPresenceToProfiles = (
  profiles: FriendProfile[],
  onlineUserIds: Set<string>
): FriendProfile[] => profiles.map((profile) => applyPresenceToProfile(profile, onlineUserIds))

const buildSelfProfile = (
  userId: string,
  currentUser: UserProfile,
  publicAssetIds: string[],
  publicListNames: string[],
  publicHoldings: PublicHoldingSummary[],
  portfolioVisibility: 'public' | 'friends' | 'private',
  tradeJournal: TradeJournalEntry[],
  showcase: ProfileShowcaseSettings,
  onlineUserIds: Set<string>
): FriendProfile => ({
  id: userId,
  username: currentUser.username,
  displayName: currentUser.displayName || currentUser.username || 'AVY kullanıcısı',
  bio: currentUser.bio,
  joinedAt: currentUser.joinedAt,
  avatarDataUrl: currentUser.avatarDataUrl,
  accentColor: '#f6c445',
  presence: onlineUserIds.has(userId) ? 'online' : 'offline',
  portfolioVisibility,
  publicAssetIds,
  publicListNames,
  publicHoldings,
  tradeJournal,
  showcase
})

export const useSocialCloud = ({
  currentUser,
  publicAssetIds,
  publicListNames,
  publicHoldings,
  portfolioVisibility,
  tradeJournal,
  showcase,
  socialFeaturesEnabled = true,
  onHydrateProfile
}: SocialRuntimeOptions) => {
  const hydrateProfileRef = useRef(onHydrateProfile)
  const [activeConfig, setActiveConfig] = useState<SocialRuntimeConfig>(() => getSocialRuntimeConfig())
  const [sessionUserId, setSessionUserId] = useState<string | null>(() => {
    const initialConfig = getSocialRuntimeConfig()

    return isSocialConfigReady(initialConfig) ? getCachedSocialSessionUserId(initialConfig) : null
  })
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [contacts, setContacts] = useState<FriendProfile[]>([])
  const [incomingRequests, setIncomingRequests] = useState<FriendProfile[]>([])
  const [outgoingRequests, setOutgoingRequests] = useState<FriendProfile[]>([])
  const [conversations, setConversations] = useState<Record<string, SocialMessage[]>>({})
  const [selectedFriendId, setSelectedFriendId] = useState('')
  const [viewedProfileSeed, setViewedProfileSeed] = useState<FriendProfile | null>(null)
  const [remoteProfiles, setRemoteProfiles] = useState<Record<string, FriendProfile>>({})
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set())
  const [profilePosts, setProfilePosts] = useState<Record<string, SocialProfilePost[]>>({})
  const [profileComments, setProfileComments] = useState<Record<string, SocialProfileComment[]>>({})
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [pokeHistory, setPokeHistory] = useState<SocialPokeEvent[]>([])
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [isSessionLoading, setIsSessionLoading] = useState(() => {
    const initialConfig = getSocialRuntimeConfig()

    return isSocialConfigReady(initialConfig) && !getCachedSocialSessionUserId(initialConfig)
  })
  const [isHydrated, setIsHydrated] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isProfileFeedLoading, setIsProfileFeedLoading] = useState(false)
  const lastSuccessfulProfileSyncKeyRef = useRef('')
  const profileFeedLoadCountRef = useRef(0)
  const profileFeedRequestsRef = useRef<Record<string, Promise<void> | undefined>>({})
  const conversationRefreshTimersRef = useRef<Record<string, number[]>>({})
  const onlineUserIdsRef = useRef<Set<string>>(new Set())
  const friendGainAlertKeysRef = useRef<Set<string>>(loadFriendGainAlertKeys())
  const contactsRef = useRef<FriendProfile[]>([])
  const incomingRequestsRef = useRef<FriendProfile[]>([])
  const outgoingRequestsRef = useRef<FriendProfile[]>([])
  const selectedFriendIdRef = useRef('')
  const isChatOpenRef = useRef(false)
  const currentUserRef = useRef(currentUser)
  const publicAssetIdsRef = useRef(publicAssetIds)
  const publicListNamesRef = useRef(publicListNames)
  const publicHoldingsRef = useRef(publicHoldings)
  const tradeJournalRef = useRef(tradeJournal)
  const showcaseRef = useRef(showcase)
  const portfolioVisibilityRef = useRef(portfolioVisibility)
  const profilePostsRef = useRef(profilePosts)
  const profileCommentsRef = useRef(profileComments)

  const isConfigured = isSocialConfigReady(activeConfig)
  const client = useMemo(
    () => (isConfigured ? getSocialBackendClient(activeConfig) : null),
    [activeConfig, isConfigured]
  )

  const decorateProfiles = (profiles: FriendProfile[]): FriendProfile[] =>
    applyPresenceToProfiles(profiles, onlineUserIdsRef.current)

  const selectedFriend = contacts.find((friend) => friend.id === selectedFriendId) ?? contacts[0]
  const shareableFriends = useMemo(() => {
    const friendMap = new Map<string, FriendProfile>()

    contacts.forEach((friend) => friendMap.set(friend.id, friend))

    Object.keys(conversations).forEach((friendId) => {
      const profile =
        contacts.find((friend) => friend.id === friendId) ??
        remoteProfiles[friendId] ??
        incomingRequests.find((friend) => friend.id === friendId) ??
        outgoingRequests.find((friend) => friend.id === friendId)

      if (profile && profile.id !== (sessionUserId ?? currentUser.id)) {
        friendMap.set(profile.id, profile)
      }
    })

    return [...friendMap.values()].sort((left, right) =>
      left.displayName.localeCompare(right.displayName, 'tr')
    )
  }, [
    contacts,
    conversations,
    currentUser.id,
    incomingRequests,
    outgoingRequests,
    remoteProfiles,
    sessionUserId
  ])
  const selfProfile = useMemo(
    () =>
      buildSelfProfile(
        sessionUserId ?? currentUser.id,
        currentUser,
        publicAssetIds,
        publicListNames,
        publicHoldings,
        portfolioVisibility,
        tradeJournal,
        showcase,
        onlineUserIds
      ),
    [
      currentUser,
      onlineUserIds,
      portfolioVisibility,
      publicAssetIds,
      publicHoldings,
      publicListNames,
      showcase,
      sessionUserId,
      tradeJournal
    ]
  )
  const viewedProfile = useMemo(() => {
    if (!viewedProfileSeed) {
      return null
    }

    if (viewedProfileSeed.id === (sessionUserId ?? currentUser.id)) {
      return selfProfile
    }

    const remoteProfile = remoteProfiles[viewedProfileSeed.id]
    const knownProfile =
      contacts.find((friend) => friend.id === viewedProfileSeed.id) ??
      incomingRequests.find((friend) => friend.id === viewedProfileSeed.id) ??
      outgoingRequests.find((friend) => friend.id === viewedProfileSeed.id)

    return applyPresenceToProfile(
      remoteProfile ?? knownProfile ?? viewedProfileSeed,
      onlineUserIds
    )
  }, [
    contacts,
    currentUser.id,
    incomingRequests,
    onlineUserIds,
    outgoingRequests,
    remoteProfiles,
    selfProfile,
    sessionUserId,
    viewedProfileSeed
  ])
  const profileSyncKey = useMemo(
    () =>
      JSON.stringify({
        userId: sessionUserId ?? currentUser.id,
        username: currentUser.username.trim(),
        displayName: currentUser.displayName.trim(),
        bio: currentUser.bio.trim(),
        avatarDataUrl: currentUser.avatarDataUrl ?? null,
        publicAssetIds,
        publicListNames,
        publicHoldings,
        portfolioVisibility,
        tradeJournal,
        showcase
      }),
    [
      currentUser.avatarDataUrl,
      currentUser.bio,
      currentUser.displayName,
      currentUser.id,
      currentUser.username,
      portfolioVisibility,
      publicAssetIds,
      publicHoldings,
      publicListNames,
      showcase,
      sessionUserId,
      tradeJournal
    ]
  )

  useEffect(() => {
    hydrateProfileRef.current = onHydrateProfile
  }, [onHydrateProfile])

  useEffect(() => {
    currentUserRef.current = currentUser
    publicAssetIdsRef.current = publicAssetIds
    publicListNamesRef.current = publicListNames
    publicHoldingsRef.current = publicHoldings
    tradeJournalRef.current = tradeJournal
    showcaseRef.current = showcase
    portfolioVisibilityRef.current = portfolioVisibility
    profilePostsRef.current = profilePosts
    profileCommentsRef.current = profileComments
  }, [
    currentUser,
    profileComments,
    profilePosts,
    portfolioVisibility,
    publicAssetIds,
    publicHoldings,
    publicListNames,
    showcase,
    tradeJournal
  ])

  useEffect(() => {
    contactsRef.current = contacts
  }, [contacts])

  useEffect(() => {
    if (socialFeaturesEnabled) {
      return
    }

    setContacts([])
    setIncomingRequests([])
    setOutgoingRequests([])
    setConversations({})
    setRemoteProfiles({})
    setUnreadCounts({})
    setPokeHistory([])
    setViewedProfileSeed(null)
    setSelectedFriendId('')
    setIsChatOpen(false)
    setProfilePosts({})
    setProfileComments({})
    onlineUserIdsRef.current = new Set()
    setOnlineUserIds(new Set())
  }, [socialFeaturesEnabled])

  useEffect(() => {
    const currentDayKey = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Istanbul'
    }).format(new Date())

    contacts.forEach((friend) => {
      friend.publicHoldings.forEach((holding) => {
        const dailyChangePercent = holding.dailyChangePercent ?? 0

        if (dailyChangePercent < 5) {
          return
        }

        const dedupeKey = `social-gain:${currentDayKey}:${friend.id}:${holding.assetId}`

        if (friendGainAlertKeysRef.current.has(dedupeKey)) {
          return
        }

        friendGainAlertKeysRef.current.add(dedupeKey)
        persistFriendGainAlertKeys(friendGainAlertKeysRef.current)

        void pushInboxNotification(
          `${friend.displayName} bugün yükselişte`,
          `${friend.displayName} adlı arkadaşının ${holding.symbol} varlığı bugün %${dailyChangePercent.toFixed(2)} yükseldi. Onu tebrik et.`,
          dedupeKey,
          'message'
        )
      })
    })
  }, [contacts])

  useEffect(() => {
    incomingRequestsRef.current = incomingRequests
  }, [incomingRequests])

  useEffect(() => {
    outgoingRequestsRef.current = outgoingRequests
  }, [outgoingRequests])

  useEffect(() => {
    selectedFriendIdRef.current = selectedFriendId
  }, [selectedFriendId])

  useEffect(() => {
    isChatOpenRef.current = isChatOpen
  }, [isChatOpen])

  useEffect(() => {
    return () => {
      Object.values(conversationRefreshTimersRef.current)
        .flat()
        .forEach((timer) => window.clearTimeout(timer))
    }
  }, [])

  const scheduleConversationRefresh = (friendId: string): void => {
    const activeTimers = conversationRefreshTimersRef.current[friendId] ?? []
    activeTimers.forEach((timer) => window.clearTimeout(timer))

    conversationRefreshTimersRef.current[friendId] = BACKGROUND_REFRESH_DELAYS_MS.map((delayMs) =>
      window.setTimeout(() => {
        void refreshConversation(friendId).catch(() => undefined)
      }, delayMs)
    )
  }

  const refreshConnections = async (): Promise<void> => {
    if (!socialFeaturesEnabled || !client || !sessionUserId) {
      return
    }

    const snapshot = await withRetry(
      () =>
        withTimeout(
          fetchSocialConnections(client, sessionUserId),
          SOCIAL_FETCH_TIMEOUT_MS,
          'Arkadaş listesi yanıtı gecikti.'
        ),
      3
    )
    const nextContacts = decorateProfiles(snapshot.contacts)
    const nextIncomingRequests = decorateProfiles(snapshot.incomingRequests)
    const nextOutgoingRequests = decorateProfiles(snapshot.outgoingRequests)
    const shouldKeepExistingRoster =
      !nextContacts.length &&
      !nextIncomingRequests.length &&
      !nextOutgoingRequests.length &&
      (contactsRef.current.length > 0 ||
        incomingRequestsRef.current.length > 0 ||
        outgoingRequestsRef.current.length > 0)

    if (shouldKeepExistingRoster) {
      return
    }

    setContacts(nextContacts)
    setIncomingRequests(nextIncomingRequests)
    setOutgoingRequests(nextOutgoingRequests)
    setRemoteProfiles((current) => {
      const next = { ...current }
      ;[...nextContacts, ...nextIncomingRequests, ...nextOutgoingRequests].forEach((profile) => {
        next[profile.id] = profile
      })
      return next
    })
    setSelectedFriendId((current) =>
      current && snapshot.contacts.some((friend) => friend.id === current)
        ? current
        : snapshot.contacts[0]?.id ?? ''
    )
  }

  const refreshConversation = async (friendId: string): Promise<void> => {
    if (!socialFeaturesEnabled || !client || !sessionUserId || !friendId) {
      return
    }

    const nextConversation = await withRetry(
      () =>
        withTimeout(
          fetchConversation(client, sessionUserId, friendId),
          SOCIAL_FETCH_TIMEOUT_MS,
          'Sohbet geçmişi yanıtı gecikti.'
        ),
      2
    )
    setConversations((current) => ({
      ...current,
      [friendId]: mergeConversationList(current[friendId], nextConversation)
    }))
  }

  const refreshPokes = async (): Promise<void> => {
    if (!socialFeaturesEnabled || !client || !sessionUserId) {
      return
    }

    const nextPokes = await withRetry(
      () =>
        withTimeout(
          fetchRecentPokes(client, sessionUserId),
          SOCIAL_FETCH_TIMEOUT_MS,
          'Dürtme geçmişi yanıtı gecikti.'
        ),
      2
    )
    setPokeHistory(nextPokes)
  }

  const refreshProfileFeed = async (profileUserId: string): Promise<void> => {
    if (!socialFeaturesEnabled || !client || !sessionUserId || !profileUserId) {
      return
    }

    const inFlightRequest = profileFeedRequestsRef.current[profileUserId]

    if (inFlightRequest) {
      return inFlightRequest
    }

    const request = (async () => {
      profileFeedLoadCountRef.current += 1
      setIsProfileFeedLoading(true)

      try {
        const postsRequest = withRetry(
          () =>
            withTimeout(
              fetchSocialPostsForProfile(client, profileUserId),
              PROFILE_FEED_TIMEOUT_MS,
              'Profil gönderileri geç yanıt veriyor.'
            ),
          1
        ).then((nextPosts) => {
          setProfilePosts((current) => ({
            ...current,
            [profileUserId]: mergeById(current[profileUserId], nextPosts)
          }))
          return nextPosts
        })

        const commentsRequest = withRetry(
          () =>
            withTimeout(
              fetchProfileComments(client, profileUserId),
              PROFILE_FEED_TIMEOUT_MS,
              'Profil yorumları geç yanıt veriyor.'
            ),
          1
        ).then((nextComments) => {
          setProfileComments((current) => ({
            ...current,
            [profileUserId]: mergeById(current[profileUserId], nextComments)
          }))
          return nextComments
        })

        const [postsResult, commentsResult] = await Promise.allSettled([postsRequest, commentsRequest])
        const hasCachedPosts = Boolean(profilePostsRef.current[profileUserId]?.length)
        const hasCachedComments = Boolean(profileCommentsRef.current[profileUserId]?.length)

        const feedError =
          postsResult.status === 'rejected'
            ? postsResult.reason
            : commentsResult.status === 'rejected'
              ? commentsResult.reason
              : null

        if (feedError) {
          const formatted = formatSocialBackendError(feedError)

          if (hasCachedPosts || hasCachedComments) {
            setStatusMessage(formatted)
          } else {
            setErrorMessage(formatted)
          }
        } else {
          setStatusMessage('')
          setErrorMessage('')
        }
      } finally {
        delete profileFeedRequestsRef.current[profileUserId]
        profileFeedLoadCountRef.current = Math.max(0, profileFeedLoadCountRef.current - 1)
        setIsProfileFeedLoading(profileFeedLoadCountRef.current > 0)
      }
    })()

    profileFeedRequestsRef.current[profileUserId] = request
    return request
  }

  const refreshRemoteProfile = async (profileUserId: string): Promise<FriendProfile | null> => {
    if (!client || !profileUserId) {
      return null
    }

    try {
      const nextProfile = await withRetry(
        () =>
          withTimeout(
            fetchSocialProfile(client, profileUserId),
            SOCIAL_FETCH_TIMEOUT_MS,
            'Profil bilgisi geç yanıt veriyor.'
          ),
        3
      )

      if (nextProfile) {
        const decorated = applyPresenceToProfile(nextProfile, onlineUserIdsRef.current)
        setRemoteProfiles((current) => ({
          ...current,
          [profileUserId]: decorated
        }))
        return decorated
      }
    } catch (error) {
      setErrorMessage(formatSocialBackendError(error))
    }

    return null
  }

  const saveConfig = (config: SocialRuntimeConfig): void => {
    saveSocialRuntimeConfig(config)
    setActiveConfig(config)
    setStatusMessage('Bulut bağlantısı kaydedildi.')
    setErrorMessage('')
  }

  const clearConfig = (): void => {
    clearSocialRuntimeConfig()
    const cleared = { supabaseUrl: '', supabaseAnonKey: '' }
    setActiveConfig(cleared)
    setStatusMessage('Bulut bağlantısı temizlendi.')
    setErrorMessage('')
  }

  const openChat = (friendId: string): void => {
    setSelectedFriendId(friendId)
    setIsChatOpen(true)
    setUnreadCounts((current) => clearUnread(current, friendId))

    const knownProfile =
      contacts.find((friend) => friend.id === friendId) ??
      incomingRequests.find((friend) => friend.id === friendId) ??
      outgoingRequests.find((friend) => friend.id === friendId)

    if (knownProfile) {
      setViewedProfileSeed(knownProfile)
    }
  }

  const closeChat = (): void => {
    setIsChatOpen(false)
  }

  const openProfile = (profile: FriendProfile): void => {
    setViewedProfileSeed(applyPresenceToProfile(profile, onlineUserIdsRef.current))
    void refreshRemoteProfile(profile.id)
    void refreshProfileFeed(profile.id)
  }

  const clearViewedProfile = (): void => {
    setViewedProfileSeed(null)
  }

  const openOwnProfile = (): void => {
    setViewedProfileSeed(selfProfile)
    if (sessionUserId) {
      void refreshRemoteProfile(sessionUserId)
    }
    void refreshProfileFeed(selfProfile.id)
  }

  const authenticate = async (authMode: SocialAuthMode, authForm: SocialAuthFormInput): Promise<void> => {
    if (!client) {
      setErrorMessage('Giriş servisi şu an hazır değil. Uygulamayı yeniden açıp tekrar dene.')
      return
    }

    const email = authForm.email.trim()
    const password = authForm.password
    const username = authForm.username.trim()
    const displayName = authForm.displayName.trim()

    if (!email) {
      setErrorMessage('Lütfen e-posta adresini gir.')
      return
    }

    if (!password) {
      setErrorMessage('Lütfen şifreni gir.')
      return
    }

    if (authMode === 'register' && !username) {
      setErrorMessage('Kayıt olmak için bir kullanıcı adı gerekli.')
      return
    }

    setIsBusy(true)
    setErrorMessage('')
    setStatusMessage(authMode === 'register' ? 'Hesap oluşturuluyor...' : 'Giriş yapılıyor...')

    try {
      if (authMode === 'register') {
        const response = await withTimeout(
          signUpToSocialCloud(client, {
            email,
            password,
            username,
            displayName: displayName || username
          }),
          SOCIAL_AUTH_TIMEOUT_MS,
          'Kayıt isteği zaman aşımına uğradı. Birazdan tekrar dene.'
        )

        setStatusMessage(
          response.needsEmailConfirmation
            ? 'Kayıt oluşturuldu. E-postana doğrulama bağlantısı veya kodu gönderildi. Onayladıktan sonra giriş yapabilirsin.'
            : 'Kayıt oluşturuldu ve oturum açıldı.'
        )

        if (!response.needsEmailConfirmation) {
          const session = await withTimeout(
            getSocialSession(client),
            5000,
            'Oturum doğrulaması beklenenden uzun sürdü.'
          )
          setSessionUserId(session?.user.id ?? null)
          setSessionEmail(session?.user.email?.trim().toLowerCase() ?? null)
        }
      } else {
        await withTimeout(
          signInToSocialCloud(client, {
            email,
            password
          }),
          SOCIAL_AUTH_TIMEOUT_MS,
          'Giriş isteği zaman aşımına uğradı. Birazdan tekrar dene.'
        )

        const session = await withTimeout(
          getSocialSession(client),
          5000,
          'Oturum bilgisi alınamadı. Tekrar dene.'
        )

        if (!session?.user?.id) {
          throw new Error('Giriş tamamlandı ama oturum açılamadı. Tekrar dene.')
        }

        setSessionUserId(session.user.id)
        setSessionEmail(session.user.email?.trim().toLowerCase() ?? null)

        setStatusMessage('Oturum açıldı.')
      }
    } catch (error) {
      setErrorMessage(formatSocialAuthError(error))
    } finally {
      setIsBusy(false)
    }
  }

  const signOut = async (): Promise<void> => {
    if (!client) {
      return
    }

    await signOutFromSocialCloud(client)
    setContacts([])
    setIncomingRequests([])
    setOutgoingRequests([])
    setConversations({})
    setPokeHistory([])
    setProfilePosts({})
    setProfileComments({})
    setRemoteProfiles({})
    setUnreadCounts({})
    setSessionEmail(null)
    setSelectedFriendId('')
    setViewedProfileSeed(null)
    setIsChatOpen(false)
  }

  const sendFriendRequest = async (friendId: string): Promise<void> => {
    if (!client || !sessionUserId) {
      return
    }

    setIsBusy(true)
    setErrorMessage('')

    try {
      await addSocialContact(client, sessionUserId, friendId)
      await refreshConnections()
      setStatusMessage('Arkadaş isteği gönderildi.')
    } catch (error) {
      setErrorMessage(formatSocialAuthError(error))
    } finally {
      setIsBusy(false)
    }
  }

  const acceptFriendRequest = async (friendId: string): Promise<void> => {
    if (!client || !sessionUserId) {
      return
    }

    setIsBusy(true)
    setErrorMessage('')

    try {
      await acceptSocialContact(client, sessionUserId, friendId)
      await refreshConnections()
      openChat(friendId)
      setStatusMessage('Arkadaş isteği kabul edildi.')
    } catch (error) {
      setErrorMessage(formatSocialAuthError(error))
    } finally {
      setIsBusy(false)
    }
  }

  const sendMessageToFriend = async (
    friendId: string,
    input: SocialComposerInput | string
  ): Promise<void> => {
    const normalizedInput = normalizeComposerInput(input)
    const text = normalizedInput.text?.trim() ?? ''
    const gifUrl = normalizedInput.gifUrl?.trim() ?? ''
    const imageUrl = normalizedInput.imageUrl?.trim() ?? ''

    if (!client || !sessionUserId || !friendId || (!text && !gifUrl && !imageUrl)) {
      return
    }
    setErrorMessage('')

    const optimisticMessage: SocialMessage = {
      id: `optimistic:${friendId}:${Date.now()}`,
      friendId,
      sender: 'self',
      text,
      gifUrl: gifUrl || undefined,
      imageUrl: imageUrl || undefined,
      sentAt: new Date().toISOString(),
      read: true,
      status: 'sending'
    }

    setConversations((current) => mergeConversation(current, friendId, optimisticMessage))
    setUnreadCounts((current) => clearUnread(current, friendId))
    scheduleConversationRefresh(friendId)

    try {
      const message = await withTimeout(
        sendSocialMessage(client, sessionUserId, friendId, {
          text,
          gifUrl: gifUrl || undefined,
          imageUrl: imageUrl || undefined
        }),
        SOCIAL_SEND_TIMEOUT_MS,
        'Mesaj sunucuya iletilirken gecikme yaşanıyor.'
      )
      setConversations((current) => ({
        ...current,
        [friendId]: mergeConversationList(
          (current[friendId] ?? []).filter((item) => item.id !== optimisticMessage.id),
          [{ ...message, status: 'delivered' }]
        )
      }))
      setUnreadCounts((current) => clearUnread(current, friendId))
      scheduleConversationRefresh(friendId)
      await playAudioFeedback('message_sent')
    } catch (error) {
      const nextError =
        error instanceof Error ? error : new Error('Mesaj gönderilemedi.')

      if (nextError.message.includes('gecikme')) {
        setConversations((current) => ({
          ...current,
          [friendId]: (current[friendId] ?? []).map((message) =>
            message.id === optimisticMessage.id ? { ...message, status: 'sent' } : message
          )
        }))
        setStatusMessage('Mesaj gecikmeli iletildi; arka planda doğrulama sürüyor.')
        scheduleConversationRefresh(friendId)
        return
      }

      setConversations((current) => ({
        ...current,
        [friendId]: (current[friendId] ?? []).filter((item) => item.id !== optimisticMessage.id)
      }))
      setErrorMessage(nextError.message)
    }
  }

  const sendPokeToFriend = async (friendId: string): Promise<void> => {
    if (!client || !sessionUserId || !friendId) {
      return
    }

    setIsBusy(true)
    setErrorMessage('')

    try {
      await sendSocialPoke(client, sessionUserId, friendId)
      await refreshPokes()
      setStatusMessage('Dürtme gönderildi.')
    } catch (error) {
      setErrorMessage(formatSocialAuthError(error))
    } finally {
      setIsBusy(false)
    }
  }

  const publishProfilePost = async (input: {
    type: SocialProfilePost['type']
    assetId?: string
    assetSymbol?: string
    title: string
    body: string
    snapshotDataUrl?: string
  }): Promise<void> => {
    if (!client || !sessionUserId) {
      return
    }

    setIsBusy(true)
    setErrorMessage('')

    try {
      const nextPost = await withTimeout(
        createSocialPost(client, sessionUserId, input),
        SOCIAL_SEND_TIMEOUT_MS,
        'Gönderi sunucuya iletilirken gecikme yaşanıyor.'
      )
      setProfilePosts((current) => ({
        ...current,
        [sessionUserId]: [nextPost, ...(current[sessionUserId] ?? [])]
      }))
      window.setTimeout(() => {
        void refreshProfileFeed(sessionUserId)
      }, 600)
      setStatusMessage('Profil gönderisi yayına alındı.')
    } catch (error) {
      const nextError = new Error(formatSocialBackendError(error) || 'Profil gönderisi yayınlanamadı.')

      if (nextError.message.includes('gecikme')) {
        setStatusMessage('Gönderi gecikmeli işleniyor; profil akışı arka planda yenilenecek.')
        void refreshProfileFeed(sessionUserId)
        return
      }

      setErrorMessage(nextError.message)
      throw nextError
    } finally {
      setIsBusy(false)
    }
  }

  const sendProfileComment = async (
    profileUserId: string,
    input: SocialComposerInput | string
  ): Promise<void> => {
    const normalizedInput = normalizeComposerInput(input)
    const body = normalizedInput.text?.trim() ?? ''
    const gifUrl = normalizedInput.gifUrl?.trim() ?? ''

    if (!client || !sessionUserId || !profileUserId || (!body && !gifUrl)) {
      return
    }
    setErrorMessage('')

    try {
      const nextComment = await withTimeout(
        createProfileComment(client, profileUserId, sessionUserId, {
          body,
          gifUrl: gifUrl || undefined
        }),
        SOCIAL_SEND_TIMEOUT_MS,
        'Profil yorumu sunucuya iletilirken gecikme yaşanıyor.'
      )
      setProfileComments((current) => ({
        ...current,
        [profileUserId]: mergeById(current[profileUserId], [nextComment])
      }))
      window.setTimeout(() => {
        void refreshProfileFeed(profileUserId)
      }, 900)
      setStatusMessage('Profil yorumu paylaşıldı.')
    } catch (error) {
      const nextError = new Error(formatSocialBackendError(error) || 'Profil yorumu gönderilemedi.')

      if (nextError.message.includes('gecikme')) {
        setStatusMessage('Profil yorumu gecikmeli işleniyor; akış arka planda yenilenecek.')
        void refreshProfileFeed(profileUserId)
        return
      }

      setErrorMessage(nextError.message)
      throw nextError
    }
  }

  const searchProfiles = async (term: string): Promise<FriendProfile[]> => {
    if (!socialFeaturesEnabled || !client || !sessionUserId || !term.trim()) {
      return []
    }

    return decorateProfiles(await searchProfilesByIdentifier(client, term.trim(), sessionUserId))
  }

  useEffect(() => {
    if (!client) {
      setSessionUserId(null)
      setSessionEmail(null)
      setIsSessionLoading(false)
      setContacts([])
      setIncomingRequests([])
      setOutgoingRequests([])
      setConversations({})
      setPokeHistory([])
      setProfilePosts({})
      setProfileComments({})
      setRemoteProfiles({})
      setUnreadCounts({})
      onlineUserIdsRef.current = new Set()
      setOnlineUserIds(new Set())
      setViewedProfileSeed(null)
      return
    }

    let active = true
    const cachedSessionUserId = getCachedSocialSessionUserId(activeConfig)

    if (cachedSessionUserId) {
      setSessionUserId(cachedSessionUserId)
      setErrorMessage('')
      setIsSessionLoading(false)
    } else {
      setIsSessionLoading(true)
    }

    const failSafeTimer = cachedSessionUserId
      ? 0
      : window.setTimeout(() => {
          if (!active) {
            return
          }

          setIsSessionLoading(false)
          setSessionUserId(null)
          setErrorMessage('Oturum kontrolü zaman aşımına uğradı. Giriş ekranı açıldı.')
        }, 12000)

    const loadSession = async (): Promise<void> => {
      try {
        const session = await withTimeout(
          getSocialSession(client),
          cachedSessionUserId ? 15000 : 8000,
          cachedSessionUserId
            ? 'Önceki oturum doğrulanırken bağlantı beklenenden uzun sürdü.'
            : 'Oturum doğrulaması beklenenden uzun sürdü.'
        )

        if (!active) {
          return
        }

        if (session?.user.id) {
          setSessionUserId(session.user.id)
          setSessionEmail(session.user.email?.trim().toLowerCase() ?? null)
          setErrorMessage('')
        } else if (!cachedSessionUserId) {
          setSessionUserId(null)
          setSessionEmail(null)
        }
      } catch (error) {
        if (!active) {
          return
        }

        if (!cachedSessionUserId) {
          setSessionUserId(null)
          setErrorMessage(error instanceof Error ? error.message : 'Sosyal oturum yüklenemedi.')
        }
      } finally {
        if (active) {
          setIsSessionLoading(false)
        }
      }
    }

    void loadSession()

    const unsubscribe = onSocialAuthChange(client, (_event, session) => {
      setSessionUserId(session?.user.id ?? null)
      setSessionEmail(session?.user.email?.trim().toLowerCase() ?? null)
      setIsSessionLoading(false)
      setStatusMessage('')
      setErrorMessage('')
    })

    return () => {
      active = false
      if (failSafeTimer) {
        window.clearTimeout(failSafeTimer)
      }
      unsubscribe()
    }
  }, [activeConfig, client])

  useEffect(() => {
    if (!socialFeaturesEnabled) {
      setIsHydrated(true)
      return
    }

    if (!client || !sessionUserId) {
      setIsHydrated(false)
      return
    }

    let active = true

    const hydrate = async (): Promise<void> => {
      try {
        let remoteProfile = await fetchSocialProfile(client, sessionUserId)

        if (!active) {
          return
        }

        if (!remoteProfile) {
          const session = await getSocialSession(client)
          const metadata = session?.user.user_metadata ?? {}
          const fallbackUser = currentUserRef.current

          await upsertSocialProfile(
            client,
            sessionUserId,
            {
              id: sessionUserId,
              username:
                typeof metadata.username === 'string' && metadata.username.trim()
                  ? metadata.username.trim()
                  : fallbackUser.username,
              displayName:
                typeof metadata.display_name === 'string' && metadata.display_name.trim()
                  ? metadata.display_name.trim()
                  : fallbackUser.displayName,
              bio:
                typeof metadata.bio === 'string'
                  ? metadata.bio
                  : fallbackUser.bio,
              avatarDataUrl: fallbackUser.avatarDataUrl,
              joinedAt: fallbackUser.joinedAt
            },
            publicAssetIdsRef.current,
            publicListNamesRef.current,
            publicHoldingsRef.current,
            tradeJournalRef.current,
            portfolioVisibilityRef.current,
            showcaseRef.current,
            session?.user.email?.trim().toLowerCase() ?? sessionEmail ?? undefined
          )

          remoteProfile = await fetchSocialProfile(client, sessionUserId)
        }

        if (remoteProfile) {
          setRemoteProfiles((current) => ({
            ...current,
            [sessionUserId]: applyPresenceToProfile(remoteProfile, onlineUserIdsRef.current)
          }))
          const currentLocalUser = currentUserRef.current
          const localShowcase = showcaseRef.current
          const shouldHydrateProfile =
            currentLocalUser.username !== remoteProfile.username ||
            currentLocalUser.displayName !== remoteProfile.displayName ||
            currentLocalUser.bio !== remoteProfile.bio ||
            (currentLocalUser.avatarDataUrl ?? null) !== (remoteProfile.avatarDataUrl ?? null) ||
            localShowcase.wallpaperId !== remoteProfile.showcase.wallpaperId ||
            localShowcase.backgroundPresetId !== remoteProfile.showcase.backgroundPresetId

          if (shouldHydrateProfile) {
            hydrateProfileRef.current({
              username: remoteProfile.username,
              displayName: remoteProfile.displayName,
              bio: remoteProfile.bio,
              avatarDataUrl: remoteProfile.avatarDataUrl,
              showcase: remoteProfile.showcase
            })
          }
          lastSuccessfulProfileSyncKeyRef.current = JSON.stringify({
            userId: sessionUserId,
            username: remoteProfile.username.trim(),
            displayName: remoteProfile.displayName.trim(),
            bio: remoteProfile.bio.trim(),
            avatarDataUrl: remoteProfile.avatarDataUrl ?? null,
            publicAssetIds: remoteProfile.publicAssetIds,
            publicListNames: remoteProfile.publicListNames,
            publicHoldings: remoteProfile.publicHoldings,
            portfolioVisibility: remoteProfile.portfolioVisibility,
            tradeJournal: remoteProfile.tradeJournal,
            showcase: remoteProfile.showcase
          })
        }

        await Promise.all([refreshConnections(), refreshPokes()])
        setIsHydrated(true)
      } catch (error) {
        if (!active) {
          return
        }

        setErrorMessage(formatSocialBackendError(error) || 'Profil senkronu başarısız oldu.')
      }
    }

    void hydrate()

    return () => {
      active = false
    }
  }, [client, sessionEmail, sessionUserId, socialFeaturesEnabled])

  useEffect(() => {
    if (!socialFeaturesEnabled || !client || !sessionUserId || !isHydrated || !currentUser.username.trim()) {
      return
    }

    if (lastSuccessfulProfileSyncKeyRef.current === profileSyncKey) {
      return
    }

    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          await upsertSocialProfile(
            client,
            sessionUserId,
            currentUser,
            publicAssetIds,
            publicListNames,
            publicHoldings,
            tradeJournal,
            portfolioVisibility,
            showcase,
            sessionEmail ?? undefined
          )
          lastSuccessfulProfileSyncKeyRef.current = profileSyncKey
          setErrorMessage('')
        } catch (error) {
          setErrorMessage(formatSocialBackendError(error) || 'Bulut profil güncellenemedi.')
        }
      })()
    }, 350)

    return () => window.clearTimeout(timeout)
  }, [
    client,
    currentUser,
    isHydrated,
    portfolioVisibility,
    publicAssetIds,
    publicHoldings,
    publicListNames,
    profileSyncKey,
    showcase,
    sessionEmail,
    sessionUserId,
    socialFeaturesEnabled,
    tradeJournal
  ])

  useEffect(() => {
    if (!socialFeaturesEnabled || !client || !sessionUserId) {
      return
    }

    return subscribeToSocialEvents(client, sessionUserId, {
      onIncomingMessage: ({ id, friendId, text, gifUrl, imageUrl, sentAt }) => {
        const friend =
          contactsRef.current.find((item) => item.id === friendId) ??
          incomingRequestsRef.current.find((item) => item.id === friendId) ??
          outgoingRequestsRef.current.find((item) => item.id === friendId)
        const title = `${friend?.displayName ?? 'AVY kullanıcısı'} mesaj gönderdi`
        const activeFriendId = selectedFriendIdRef.current || contactsRef.current[0]?.id
        const isActiveConversation = isChatOpenRef.current && friendId === activeFriendId

        setConversations((current) =>
          mergeConversation(current, friendId, {
            id,
            friendId,
            sender: 'friend',
            text,
            gifUrl,
            imageUrl,
            sentAt,
            read: isActiveConversation,
            status: 'delivered'
          })
        )

        if (isActiveConversation) {
          setUnreadCounts((current) => clearUnread(current, friendId))
        } else {
          setUnreadCounts((current) => ({
            ...current,
            [friendId]: (current[friendId] ?? 0) + 1
          }))
        }

        void pushInboxNotification(
          title,
          text || 'Bir GIF gönderdi.',
          `social-message:${id}`,
          'message'
        )
      },
      onIncomingPoke: ({ id, friendId, sentAt }) => {
        const friend =
          contactsRef.current.find((item) => item.id === friendId) ??
          incomingRequestsRef.current.find((item) => item.id === friendId) ??
          outgoingRequestsRef.current.find((item) => item.id === friendId)

        setPokeHistory((current) => [
          {
            id,
            friendId,
            direction: 'incoming',
            sentAt
          },
          ...current.filter((poke) => poke.id !== id)
        ].slice(0, 24))

        void pushInboxNotification(
          `${friend?.displayName ?? 'AVY kullanıcısı'} seni dürttü`,
          'Sohbet kutucuğunu açıp cevap verebilirsin.',
          `social-poke:${id}`,
          'poke'
        )
      }
    })
  }, [client, sessionUserId, socialFeaturesEnabled])

  useEffect(() => {
    if (!socialFeaturesEnabled || !client || !sessionUserId) {
      onlineUserIdsRef.current = new Set()
      setOnlineUserIds(new Set())
      return
    }

    const presenceChannel = client.channel('avy-social-presence', {
      config: {
        presence: {
          key: sessionUserId
        }
      }
    })

    const syncPresence = (): void => {
      const presenceState = presenceChannel.presenceState<PresencePayload>()
      const nextOnlineUserIds = new Set(Object.keys(presenceState))
      nextOnlineUserIds.add(sessionUserId)
      onlineUserIdsRef.current = nextOnlineUserIds
      setOnlineUserIds(nextOnlineUserIds)
      setContacts((current) => applyPresenceToProfiles(current, nextOnlineUserIds))
      setIncomingRequests((current) => applyPresenceToProfiles(current, nextOnlineUserIds))
      setOutgoingRequests((current) => applyPresenceToProfiles(current, nextOnlineUserIds))
    }

    presenceChannel.on('presence', { event: 'sync' }, syncPresence)
    presenceChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        void presenceChannel.track({
          onlineAt: new Date().toISOString()
        })
      }
    })

    return () => {
      void presenceChannel.untrack().catch(() => undefined)
      void client.removeChannel(presenceChannel)
    }
  }, [client, sessionUserId, socialFeaturesEnabled])

  useEffect(() => {
    if (!socialFeaturesEnabled || !client || !sessionUserId) {
      return
    }

    return subscribeToSocialRoster(client, sessionUserId, () => {
      void refreshConnections().catch((error) => {
        setErrorMessage(formatSocialAuthError(error))
      })
    })
  }, [client, sessionUserId, socialFeaturesEnabled])

  useEffect(() => {
    if (!socialFeaturesEnabled || !viewedProfile?.id) {
      return
    }

    void refreshProfileFeed(viewedProfile.id)
  }, [viewedProfile?.id, socialFeaturesEnabled])

  useEffect(() => {
    if (!socialFeaturesEnabled || !client || !viewedProfile?.id) {
      return
    }

    return subscribeToProfileFeed(client, viewedProfile.id, {
      onPostInserted: () => {
        void refreshProfileFeed(viewedProfile.id)
      },
      onCommentInserted: () => {
        void refreshProfileFeed(viewedProfile.id)
      }
    })
  }, [client, viewedProfile?.id, socialFeaturesEnabled])

  useEffect(() => {
    if (!socialFeaturesEnabled || !client || !viewedProfile?.id) {
      return
    }

    return subscribeToProfileUpdates(client, viewedProfile.id, () => {
      void refreshRemoteProfile(viewedProfile.id)
    })
  }, [client, viewedProfile?.id, socialFeaturesEnabled])

  useEffect(() => {
    if (!socialFeaturesEnabled || !client || !sessionUserId) {
      return
    }

    const interval = window.setInterval(() => {
      void refreshConnections().catch(() => undefined)
    }, 10_000)

    return () => window.clearInterval(interval)
  }, [client, sessionUserId, socialFeaturesEnabled])

  useEffect(() => {
    if (!socialFeaturesEnabled || !client || !sessionUserId) {
      return
    }

    const runRefresh = () => {
      void refreshConnections().catch(() => undefined)
      void refreshPokes().catch(() => undefined)

      if (selectedFriendIdRef.current) {
        void refreshConversation(selectedFriendIdRef.current).catch(() => undefined)
      }

      if (viewedProfileSeed?.id) {
        void refreshRemoteProfile(viewedProfileSeed.id).catch(() => undefined)
        void refreshProfileFeed(viewedProfileSeed.id).catch(() => undefined)
      }
    }

    const handleFocus = () => runRefresh()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        runRefresh()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [client, sessionUserId, socialFeaturesEnabled, viewedProfileSeed?.id])

  useEffect(() => {
    if (!socialFeaturesEnabled || !client || !sessionUserId || !isHydrated || contacts.length) {
      return
    }

    const retryDelays = [900, 2500, 6000]
    const timers = retryDelays.map((delayMs) =>
      window.setTimeout(() => {
        void refreshConnections().catch(() => undefined)
      }, delayMs)
    )

    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [client, contacts.length, isHydrated, sessionUserId, socialFeaturesEnabled])

  useEffect(() => {
    if (!socialFeaturesEnabled || !selectedFriend?.id || !client || !sessionUserId) {
      return
    }

    void refreshConversation(selectedFriend.id).catch((error) => {
      setErrorMessage(formatSocialAuthError(error))
    })
  }, [client, selectedFriend?.id, sessionUserId, socialFeaturesEnabled])

  useEffect(() => {
    if (!socialFeaturesEnabled || !selectedFriend?.id || !isChatOpen) {
      return
    }

    setUnreadCounts((current) => clearUnread(current, selectedFriend.id))
  }, [isChatOpen, selectedFriend?.id, socialFeaturesEnabled])

  return {
    activeConfig,
    client,
    contacts,
    shareableFriends,
    incomingRequests,
    outgoingRequests,
    conversations,
    profilePosts,
    profileComments,
    selectedFriend,
    selfProfile,
    viewedProfile,
    selectedFriendId,
    sessionUserId,
    unreadCounts,
    pokeHistory,
    statusMessage,
    errorMessage,
    isBusy,
    isChatOpen,
    isConfigured,
    isSessionLoading,
    isHydrated,
    isProfileFeedLoading,
    saveConfig,
    clearConfig,
    setStatusMessage,
    setErrorMessage,
    setSelectedFriendId,
    openChat,
    openProfile,
    openOwnProfile,
    clearViewedProfile,
    closeChat,
    setIsChatOpen,
    authenticate,
    signOut,
    searchProfiles,
    sendFriendRequest,
    acceptFriendRequest,
    sendMessageToFriend,
    sendPokeToFriend,
    publishProfilePost,
    sendProfileComment,
    refreshConnections,
    refreshConversation,
    refreshPokes,
    refreshProfileFeed
  }
}

