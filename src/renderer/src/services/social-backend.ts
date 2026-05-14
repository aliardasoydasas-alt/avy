import {
  createClient,
  type AuthChangeEvent,
  type Session,
  type SupabaseClient
} from '@supabase/supabase-js'
import type { SocialRuntimeConfig } from '@renderer/services/social-runtime-config'
import { composeSocialRichBody, parseSocialRichBody } from '@renderer/services/social-rich-content'
import type { CloudAppStatePayload } from '@shared/types/cloud-sync'
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
import type { PortfolioVisibility } from '@shared/types/user'

type BackendClient = SupabaseClient

interface BackendProfileRow {
  id: string
  username: string
  display_name: string
  bio: string | null
  avatar_data_url: string | null
  contact_email?: string | null
  portfolio_visibility?: PortfolioVisibility | null
  public_asset_ids?: string[] | null
  public_list_names?: string[] | null
  public_holdings?: PublicHoldingSummary[] | null
  trade_journal?: TradeJournalEntry[] | null
  wallpaper_id?: string | null
  background_preset_id?: string | null
  joined_at: string | null
  updated_at?: string | null
}

interface BackendContactRow {
  user_id: string
  friend_user_id: string
}

interface BackendMessageRow {
  id: string
  sender_id: string
  recipient_id: string
  body: string
  created_at: string
}

interface BackendPokeRow {
  id: string
  sender_id: string
  recipient_id: string
  created_at: string
}

interface BackendSocialPostRow {
  id: string
  user_id: string
  post_type: 'analysis' | 'trade' | 'note'
  asset_id: string | null
  asset_symbol: string | null
  title: string
  body: string
  snapshot_data_url: string | null
  created_at: string
}

interface BackendProfileCommentRow {
  id: string
  profile_user_id: string
  author_user_id: string
  body: string
  created_at: string
}

interface BackendUserAppStateRow {
  user_id: string
  payload: CloudAppStatePayload | null
  updated_at: string
}

const LEGACY_SOCIAL_AUTH_STORAGE_KEY = 'supabase.auth.token'
const SOCIAL_AUTH_STORAGE_KEY_PREFIX = 'avy.social.auth'
const PROFILE_SELECT_BASIC = 'id, username, display_name, bio, avatar_data_url, joined_at'
const PROFILE_SELECT_CONTACT = `${PROFILE_SELECT_BASIC}, portfolio_visibility, public_asset_ids, public_holdings, wallpaper_id, background_preset_id`
const PROFILE_SELECT_FULL = `${PROFILE_SELECT_CONTACT}, public_list_names, trade_journal`
const PROFILE_LOOKUP_BATCH_SIZE = 24

export interface SocialConnectionsSnapshot {
  contacts: FriendProfile[]
  incomingRequests: FriendProfile[]
  outgoingRequests: FriendProfile[]
}

let socialClient: BackendClient | null = null
let socialClientKey = ''
const unsupportedProfileColumnsByProject = new Map<string, Set<string>>()
const unsupportedSocialTablesByProject = new Map<string, Set<string>>()
const cachedProfilesByProject = new Map<string, Map<string, FriendProfile>>()

const buildClientKey = (config: SocialRuntimeConfig): string =>
  `${config.supabaseUrl.trim()}|${config.supabaseAnonKey.trim()}`

const getSocialProjectRef = (config: SocialRuntimeConfig): string => {
  try {
    const hostname = new URL(config.supabaseUrl).hostname
    return hostname.split('.')[0] || 'default'
  } catch {
    return 'default'
  }
}

export const getSocialAuthStorageKey = (config: SocialRuntimeConfig): string =>
  `${SOCIAL_AUTH_STORAGE_KEY_PREFIX}:${getSocialProjectRef(config)}`

const getBrowserStorage = (): Storage | null => {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

const parseStoredValue = (raw: string | null): unknown => {
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

const removeStoredAuthArtifacts = (storage: Storage, storageKey: string): void => {
  storage.removeItem(storageKey)
  storage.removeItem(`${storageKey}-user`)
  storage.removeItem(`${storageKey}-code-verifier`)
}

const copyStoredAuthArtifacts = (
  storage: Storage,
  sourceStorageKey: string,
  targetStorageKey: string
): void => {
  ;['', '-user', '-code-verifier'].forEach((suffix) => {
    const raw = storage.getItem(`${sourceStorageKey}${suffix}`)

    if (raw) {
      storage.setItem(`${targetStorageKey}${suffix}`, raw)
    }
  })
}

const migrateLegacySocialAuthStorage = (config: SocialRuntimeConfig): void => {
  const storage = getBrowserStorage()

  if (!storage) {
    return
  }

  const nextStorageKey = getSocialAuthStorageKey(config)

  if (storage.getItem(nextStorageKey)) {
    return
  }

  if (!storage.getItem(LEGACY_SOCIAL_AUTH_STORAGE_KEY)) {
    return
  }

  copyStoredAuthArtifacts(storage, LEGACY_SOCIAL_AUTH_STORAGE_KEY, nextStorageKey)
  removeStoredAuthArtifacts(storage, LEGACY_SOCIAL_AUTH_STORAGE_KEY)
}

const extractUserIdFromPayload = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const candidate = payload as {
    user?: { id?: unknown }
    currentSession?: { user?: { id?: unknown } }
    session?: { user?: { id?: unknown } }
  }

  const directUserId =
    typeof candidate.user?.id === 'string'
      ? candidate.user.id
      : typeof candidate.currentSession?.user?.id === 'string'
        ? candidate.currentSession.user.id
        : typeof candidate.session?.user?.id === 'string'
          ? candidate.session.user.id
          : null

  return directUserId?.trim() ? directUserId : null
}

export const getCachedSocialSessionUserId = (config: SocialRuntimeConfig): string | null => {
  migrateLegacySocialAuthStorage(config)

  const storage = getBrowserStorage()

  if (!storage) {
    return null
  }

  const storageKeyCandidates = [getSocialAuthStorageKey(config), LEGACY_SOCIAL_AUTH_STORAGE_KEY]

  for (const storageKey of storageKeyCandidates) {
    const sessionPayload = parseStoredValue(storage.getItem(storageKey))
    const userPayload = parseStoredValue(storage.getItem(`${storageKey}-user`))
    const userId = extractUserIdFromPayload(sessionPayload) ?? extractUserIdFromPayload(userPayload)

    if (userId) {
      return userId
    }
  }

  return null
}

const getUnsupportedProfileColumns = (client: BackendClient): Set<string> => {
  const projectUrl = client.supabaseUrl
  const existing = unsupportedProfileColumnsByProject.get(projectUrl)

  if (existing) {
    return existing
  }

  const next = new Set<string>()
  unsupportedProfileColumnsByProject.set(projectUrl, next)
  return next
}

const getUnsupportedSocialTables = (client: BackendClient): Set<string> => {
  const projectUrl = client.supabaseUrl
  const existing = unsupportedSocialTablesByProject.get(projectUrl)

  if (existing) {
    return existing
  }

  const next = new Set<string>()
  unsupportedSocialTablesByProject.set(projectUrl, next)
  return next
}

const getCachedProfiles = (client: BackendClient): Map<string, FriendProfile> => {
  const projectUrl = client.supabaseUrl
  const existing = cachedProfilesByProject.get(projectUrl)

  if (existing) {
    return existing
  }

  const next = new Map<string, FriendProfile>()
  cachedProfilesByProject.set(projectUrl, next)
  return next
}

const extractMissingColumnName = (error: unknown): string | null => {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : ''

  const match = message.match(/Could not find the '([^']+)' column/i)
  return match?.[1] ?? null
}

const extractMissingTableName = (error: unknown): string | null => {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : ''

  const match = message.match(/Could not find the table 'public\.([^']+)'/i)
  return match?.[1] ?? null
}

const normalizeJsonStringArray = (items: string[]): string[] =>
  Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)))

const normalizePublicHoldings = (holdings: PublicHoldingSummary[]): PublicHoldingSummary[] =>
  holdings
    .filter((holding) => Boolean(holding?.assetId && holding?.symbol && holding?.name))
    .slice(0, 24)
    .map((holding) => ({
      assetId: holding.assetId.trim(),
      symbol: holding.symbol.trim().toUpperCase(),
      name: holding.name.trim(),
      amount: Number.isFinite(holding.amount) ? holding.amount : 0,
      totalValueTry:
        typeof holding.totalValueTry === 'number' && Number.isFinite(holding.totalValueTry)
          ? holding.totalValueTry
          : undefined,
      dailyChangePercent:
        typeof holding.dailyChangePercent === 'number' && Number.isFinite(holding.dailyChangePercent)
          ? holding.dailyChangePercent
          : undefined
    }))
    .filter((holding) => holding.amount > 0)

const normalizeTradeJournal = (entries: TradeJournalEntry[]): TradeJournalEntry[] =>
  entries
    .filter((entry) => Boolean(entry?.assetSymbol && entry?.note))
    .slice(0, 40)
    .map((entry) => ({
      id: entry.id,
      assetId: entry.assetId?.trim() || undefined,
      assetSymbol: entry.assetSymbol.trim().toUpperCase(),
      note: entry.note.trim(),
      outcome:
        entry.outcome === 'positive' || entry.outcome === 'negative' ? entry.outcome : 'neutral',
      createdAt: entry.createdAt
    }))
    .filter((entry) => entry.note.length > 0)

const normalizeJoinedAt = (value?: string): string => {
  if (typeof value !== 'string') {
    return new Date().toISOString()
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

const buildProfilePayload = (
  userId: string,
  profile: UserProfile | (Pick<UserProfile, 'username' | 'displayName' | 'bio' | 'avatarDataUrl' | 'joinedAt'> & { id?: string }),
  publicAssetIds: string[],
  publicListNames: string[],
  publicHoldings: PublicHoldingSummary[],
  tradeJournal: TradeJournalEntry[],
  portfolioVisibility: PortfolioVisibility,
  showcase?: ProfileShowcaseSettings,
  contactEmail?: string
) => ({
  id: userId,
  username: profile.username.trim(),
  display_name: profile.displayName.trim() || profile.username.trim(),
  bio: profile.bio.trim(),
  avatar_data_url: profile.avatarDataUrl ?? null,
  contact_email: contactEmail?.trim().toLowerCase() || null,
  portfolio_visibility: portfolioVisibility,
  public_asset_ids: normalizeJsonStringArray(publicAssetIds),
  public_list_names: normalizeJsonStringArray(publicListNames),
  public_holdings: normalizePublicHoldings(publicHoldings),
  trade_journal: normalizeTradeJournal(tradeJournal),
  wallpaper_id: showcase?.wallpaperId ?? 'aurora-desk',
  background_preset_id: showcase?.backgroundPresetId ?? 'golden-orbit',
  joined_at: normalizeJoinedAt(profile.joinedAt),
  updated_at: new Date().toISOString()
})

export const formatSocialBackendError = (error: unknown): string => {
  if (typeof error === 'object' && error !== null) {
    const knownError = error as {
      message?: unknown
      code?: unknown
      details?: unknown
    }

    const message = typeof knownError.message === 'string' ? knownError.message : ''
    const details = typeof knownError.details === 'string' ? knownError.details : ''
    const missingTable = extractMissingTableName(error)

    if (message.toLowerCase().includes('statement timeout')) {
      return 'Sosyal akış bu isteğe geç yanıt verdi. Lütfen tekrar dene.'
    }

    if (knownError.code === '23505' && /username/i.test(`${message} ${details}`)) {
      return 'Bu kullanıcı adı başka biri tarafından kullanılıyor.'
    }

    if (missingTable === 'profile_comments') {
      return 'Sosyal veritabanı güncel değil: profil yorum altyapısı eksik. Supabase panelinde güncel social-schema.sql dosyasını tekrar çalıştır.'
    }

    if (missingTable === 'social_posts') {
      return 'Sosyal veritabanı güncel değil: profil gönderileri altyapısı eksik. Supabase panelinde güncel social-schema.sql dosyasını tekrar çalıştır.'
    }

    if (message) {
      return message
    }
  }

  return 'Sosyal işlem şu anda tamamlanamadı.'
}

export const formatSocialAuthError = (error: unknown): string => {
  if (typeof error === 'object' && error !== null) {
    const knownError = error as {
      message?: unknown
      code?: unknown
      status?: unknown
    }

    const rawMessage = typeof knownError.message === 'string' ? knownError.message : ''
    const message = rawMessage.toLowerCase()
    const code = typeof knownError.code === 'string' ? knownError.code.toLowerCase() : ''

    if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
      return 'E-posta veya şifre hatalı görünüyor.'
    }

    if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
      return 'E-posta doğrulaman tamamlanmamış. Mail kutundaki doğrulama adımını bitirip tekrar dene.'
    }

    if (code === 'email_exists' || message.includes('user already registered')) {
      return 'Bu e-posta adresiyle zaten bir hesap bulunuyor.'
    }

    if (code === 'email_provider_disabled' || message.includes('signup is disabled')) {
      return 'E-posta ile kayıt şu anda kapalı görünüyor.'
    }

    if (message.includes('network') || message.includes('fetch')) {
      return 'Sunucuya ulaşılamadı. İnternet bağlantını kontrol edip tekrar dene.'
    }

    if (rawMessage) {
      return rawMessage
    }
  }

  return 'Giriş işlemi şu anda tamamlanamadı.'
}

export const getSocialBackendClient = (config: SocialRuntimeConfig): BackendClient => {
  const nextKey = buildClientKey(config)

  if (!socialClient || socialClientKey !== nextKey) {
    migrateLegacySocialAuthStorage(config)
    socialClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        storageKey: getSocialAuthStorageKey(config)
      }
    })
    socialClientKey = nextKey
  }

  return socialClient
}

export const getSocialSession = async (client: BackendClient): Promise<Session | null> => {
  const { data, error } = await client.auth.getSession()

  if (error) {
    throw error
  }

  return data.session
}

export const fetchUserAppState = async (
  client: BackendClient,
  userId: string
): Promise<{ payload: CloudAppStatePayload | null; updatedAt?: string }> => {
  const { data, error } = await client
    .from('user_app_state')
    .select('user_id, payload, updated_at')
    .eq('user_id', userId)
    .maybeSingle<BackendUserAppStateRow>()

  if (error) {
    throw error
  }

  return {
    payload: data?.payload ?? null,
    updatedAt: data?.updated_at
  }
}

export const upsertUserAppState = async (
  client: BackendClient,
  userId: string,
  payload: CloudAppStatePayload
): Promise<void> => {
  const { error } = await client.from('user_app_state').upsert(
    {
      user_id: userId,
      payload,
      updated_at: new Date().toISOString()
    },
    {
      onConflict: 'user_id'
    }
  )

  if (error) {
    throw error
  }
}

export const onSocialAuthChange = (
  client: BackendClient,
  callback: (event: AuthChangeEvent, session: Session | null) => void
): (() => void) => {
  const { data } = client.auth.onAuthStateChange(callback)
  return () => data.subscription.unsubscribe()
}

const mapProfileRow = (row: BackendProfileRow): FriendProfile => ({
  id: row.id,
  username: row.username,
  displayName: row.display_name,
  bio: row.bio ?? '',
  avatarDataUrl: row.avatar_data_url ?? undefined,
  accentColor: '#f6c445',
  presence: 'offline',
  portfolioVisibility: row.portfolio_visibility ?? 'friends',
  publicAssetIds: row.public_asset_ids ?? [],
  publicListNames: row.public_list_names ?? [],
  publicHoldings: row.public_holdings ?? [],
  tradeJournal: row.trade_journal ?? [],
  showcase: {
    wallpaperId: row.wallpaper_id ?? 'aurora-desk',
    backgroundPresetId: row.background_preset_id ?? 'golden-orbit'
  },
  joinedAt: row.joined_at ?? new Date().toISOString()
})

const mapPostRow = (row: BackendSocialPostRow): SocialProfilePost => ({
  id: row.id,
  userId: row.user_id,
  type: row.post_type,
  assetId: row.asset_id ?? undefined,
  assetSymbol: row.asset_symbol ?? undefined,
  title: row.title,
  body: row.body,
  snapshotDataUrl: row.snapshot_data_url ?? undefined,
  createdAt: row.created_at
})

const mapCommentRow = (
  row: BackendProfileCommentRow,
  authorProfile?: FriendProfile
): SocialProfileComment => {
  const content = parseSocialRichBody(row.body)

  return {
    id: row.id,
    profileUserId: row.profile_user_id,
    authorId: row.author_user_id,
    authorUsername: authorProfile?.username ?? 'kullanıcı',
    authorDisplayName: authorProfile?.displayName ?? 'AVY kullanıcısı',
    authorAvatarDataUrl: authorProfile?.avatarDataUrl ?? undefined,
    body: content.text,
    gifUrl: content.gifUrl,
    createdAt: row.created_at
  }
}

const sortProfiles = (profiles: FriendProfile[]): FriendProfile[] =>
  [...profiles].sort((left, right) => left.username.localeCompare(right.username))

const fetchProfilesByIds = async (
  client: BackendClient,
  ids: string[],
  selectFields = PROFILE_SELECT_CONTACT
): Promise<Map<string, FriendProfile>> => {
  if (!ids.length) {
    return new Map()
  }

  const cache = getCachedProfiles(client)
  const uniqueIds = Array.from(new Set(ids))
  const missingIds =
    selectFields === PROFILE_SELECT_BASIC ? uniqueIds.filter((id) => !cache.has(id)) : uniqueIds
  const rows: BackendProfileRow[] = []

  for (let index = 0; index < missingIds.length; index += PROFILE_LOOKUP_BATCH_SIZE) {
    const chunk = missingIds.slice(index, index + PROFILE_LOOKUP_BATCH_SIZE)
    const { data, error } = await client.from('profiles').select(selectFields).in('id', chunk)

    if (error) {
      throw error
    }

    rows.push(...(((data as BackendProfileRow[] | null) ?? [])))
  }

  rows.forEach((row) => {
    const profile = mapProfileRow(row)
    cache.set(profile.id, profile)
  })

  return new Map(
    uniqueIds
      .map((id) => {
        const profile = cache.get(id)
        return profile ? ([profile.id, profile] as const) : null
      })
      .filter((entry): entry is readonly [string, FriendProfile] => Boolean(entry))
  )
}

export const signUpToSocialCloud = async (
  client: BackendClient,
  input: {
    email: string
    password: string
    username: string
    displayName: string
  }
): Promise<{ needsEmailConfirmation: boolean }> => {
  const { data, error } = await client.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        username: input.username.trim(),
        display_name: input.displayName.trim() || input.username.trim(),
        bio: ''
      }
    }
  })

  if (error) {
    throw error
  }

  if (data.user && data.session) {
    await upsertSocialProfile(client, data.user.id, {
      id: data.user.id,
      username: input.username,
      displayName: input.displayName,
      bio: '',
      joinedAt: new Date().toISOString()
    }, [], [], [], [], 'friends', undefined, input.email)
  }

  return {
    needsEmailConfirmation: !data.session
  }
}

export const signInToSocialCloud = async (
  client: BackendClient,
  input: {
    email: string
    password: string
  }
): Promise<void> => {
  const { error } = await client.auth.signInWithPassword({
    email: input.email,
    password: input.password
  })

  if (error) {
    throw error
  }
}

export const signOutFromSocialCloud = async (client: BackendClient): Promise<void> => {
  const { error } = await client.auth.signOut()

  if (error) {
    throw error
  }

  const storage = getBrowserStorage()

  if (storage) {
    removeStoredAuthArtifacts(storage, LEGACY_SOCIAL_AUTH_STORAGE_KEY)
  }
}

export const fetchSocialProfile = async (
  client: BackendClient,
  userId: string
): Promise<FriendProfile | null> => {
  const { data, error } = await client
    .from('profiles')
    .select(PROFILE_SELECT_FULL)
    .eq('id', userId)
    .maybeSingle<BackendProfileRow>()

  if (error) {
    throw error
  }

  if (!data) {
    return null
  }

  const profile = mapProfileRow(data)
  getCachedProfiles(client).set(profile.id, profile)
  return profile
}

export const upsertSocialProfile = async (
  client: BackendClient,
  userId: string,
  profile: UserProfile | (Pick<UserProfile, 'username' | 'displayName' | 'bio' | 'avatarDataUrl' | 'joinedAt'> & { id?: string }),
  publicAssetIds: string[] = [],
  publicListNames: string[] = [],
  publicHoldings: PublicHoldingSummary[] = [],
  tradeJournal: TradeJournalEntry[] = [],
  portfolioVisibility: PortfolioVisibility = 'friends',
  showcase?: ProfileShowcaseSettings,
  contactEmail?: string
): Promise<void> => {
  const unsupportedColumns = getUnsupportedProfileColumns(client)
  const basePayload = buildProfilePayload(
    userId,
    profile,
    publicAssetIds,
    publicListNames,
    publicHoldings,
    tradeJournal,
    portfolioVisibility,
    showcase,
    contactEmail
  )
  const payload = Object.fromEntries(
    Object.entries(basePayload).filter(([key]) => !unsupportedColumns.has(key))
  )

  let lastError: unknown = null

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { error } = await client.from('profiles').upsert(payload, {
      onConflict: 'id'
    })

    if (!error) {
      return
    }

    lastError = error
    const missingColumn = extractMissingColumnName(error)

    if (!missingColumn) {
      throw error
    }

    unsupportedColumns.add(missingColumn)
    delete payload[missingColumn as keyof typeof payload]
  }

  throw lastError
}

const isUuidLike = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

const escapeIlikeTerm = (value: string): string =>
  value.replace(/[%_,]/g, ' ').replace(/\s+/g, ' ').trim()

const buildSearchScore = (profile: FriendProfile, normalizedTerm: string): number => {
  const username = profile.username.toLowerCase()
  const displayName = profile.displayName.toLowerCase()
  const profileId = profile.id.toLowerCase()

  let score = 0

  if (username === normalizedTerm) {
    score += 120
  } else if (username.startsWith(normalizedTerm)) {
    score += 80
  } else if (username.includes(normalizedTerm)) {
    score += 40
  }

  if (displayName === normalizedTerm) {
    score += 70
  } else if (displayName.startsWith(normalizedTerm)) {
    score += 45
  } else if (displayName.includes(normalizedTerm)) {
    score += 20
  }

  if (profileId === normalizedTerm) {
    score += 160
  }

  return score
}

const searchProfiles = async (
  client: BackendClient,
  selectFields: string,
  filter: string,
  currentUserId: string,
  limit: number
): Promise<BackendProfileRow[]> => {
  const { data, error } = await client
    .from('profiles')
    .select(selectFields)
    .or(filter)
    .neq('id', currentUserId)
    .limit(limit)

  if (error) {
    throw error
  }

  return (data as BackendProfileRow[] | null) ?? []
}

export const searchProfilesByIdentifier = async (
  client: BackendClient,
  term: string,
  currentUserId: string
): Promise<FriendProfile[]> => {
  const normalizedTerm = term.trim().toLowerCase()

  if (!normalizedTerm) {
    return []
  }

  const escapedTerm = escapeIlikeTerm(normalizedTerm)
  const unsupportedColumns = getUnsupportedProfileColumns(client)
  const selectFields = unsupportedColumns.has('contact_email')
    ? PROFILE_SELECT_CONTACT
    : `${PROFILE_SELECT_CONTACT}, contact_email`
  const filters = [
    `username.ilike.%${escapedTerm}%`,
    `display_name.ilike.%${escapedTerm}%`
  ]

  if (isUuidLike(normalizedTerm)) {
    filters.unshift(`id.eq.${normalizedTerm}`)
  }

  if (normalizedTerm.includes('@') && !unsupportedColumns.has('contact_email')) {
    filters.unshift(`contact_email.ilike.%${escapedTerm}%`)
  }

  try {
    const rows = await searchProfiles(client, selectFields, filters.join(','), currentUserId, 12)

    return rows
      .map(mapProfileRow)
      .sort((left, right) => buildSearchScore(right, normalizedTerm) - buildSearchScore(left, normalizedTerm))
  } catch (error) {
    const missingColumn = extractMissingColumnName(error)

    if (missingColumn !== 'contact_email') {
      throw error
    }

    unsupportedColumns.add(missingColumn)
    const rows = await searchProfiles(
      client,
      PROFILE_SELECT_CONTACT,
      filters.filter((filter) => !filter.startsWith('contact_email.')).join(','),
      currentUserId,
      12
    )

    return rows
      .map(mapProfileRow)
      .sort((left, right) => buildSearchScore(right, normalizedTerm) - buildSearchScore(left, normalizedTerm))
  }
}

export const fetchSocialConnections = async (
  client: BackendClient,
  userId: string
): Promise<SocialConnectionsSnapshot> => {
  const [outgoingResult, incomingResult] = await Promise.all([
    client
      .from('contacts')
      .select('user_id, friend_user_id')
      .eq('user_id', userId),
    client
      .from('contacts')
      .select('user_id, friend_user_id')
      .eq('friend_user_id', userId)
  ])

  if (outgoingResult.error) {
    throw outgoingResult.error
  }

  if (incomingResult.error) {
    throw incomingResult.error
  }

  const outgoingRows = (outgoingResult.data as BackendContactRow[] | null) ?? []
  const incomingRows = (incomingResult.data as BackendContactRow[] | null) ?? []
  const outgoingIds = outgoingRows.map((row) => row.friend_user_id)
  const incomingIds = incomingRows.map((row) => row.user_id)

  const outgoingSet = new Set(outgoingIds)
  const incomingSet = new Set(incomingIds)
  const contactIds = outgoingIds.filter((friendId) => incomingSet.has(friendId))
  const outgoingRequestIds = outgoingIds.filter((friendId) => !incomingSet.has(friendId))
  const incomingRequestIds = incomingIds.filter((friendId) => !outgoingSet.has(friendId))
  const allIds = Array.from(new Set([...contactIds, ...incomingRequestIds, ...outgoingRequestIds]))
  const profilesById = await fetchProfilesByIds(client, allIds, PROFILE_SELECT_CONTACT)

  return {
    contacts: sortProfiles(contactIds.map((id) => profilesById.get(id)).filter((profile): profile is FriendProfile => Boolean(profile))),
    incomingRequests: sortProfiles(
      incomingRequestIds.map((id) => profilesById.get(id)).filter((profile): profile is FriendProfile => Boolean(profile))
    ),
    outgoingRequests: sortProfiles(
      outgoingRequestIds.map((id) => profilesById.get(id)).filter((profile): profile is FriendProfile => Boolean(profile))
    )
  }
}

export const fetchMyContacts = async (
  client: BackendClient,
  userId: string
): Promise<FriendProfile[]> => {
  const snapshot = await fetchSocialConnections(client, userId)
  return snapshot.contacts
}

export const addSocialContact = async (
  client: BackendClient,
  userId: string,
  friendId: string
): Promise<void> => {
  const { error } = await client.from('contacts').upsert(
    {
      user_id: userId,
      friend_user_id: friendId
    },
    {
      onConflict: 'user_id,friend_user_id'
    }
  )

  if (error) {
    throw error
  }
}

export const acceptSocialContact = async (
  client: BackendClient,
  userId: string,
  friendId: string
): Promise<void> => {
  await addSocialContact(client, userId, friendId)
}

export const fetchPendingFriendRequests = async (
  client: BackendClient,
  userId: string
): Promise<SocialConnectionsSnapshot> => {
  return fetchSocialConnections(client, userId)
}

export const fetchMyContactsLegacy = async (
  client: BackendClient,
  userId: string
): Promise<FriendProfile[]> => {
  const { data: contacts, error: contactsError } = await client
    .from('contacts')
    .select('user_id, friend_user_id')
    .eq('user_id', userId)

  if (contactsError) {
    throw contactsError
  }

  const contactRows = (contacts as BackendContactRow[] | null) ?? []

  if (!contactRows.length) {
    return []
  }

  const friendIds = contactRows.map((row) => row.friend_user_id)
  const { data: profiles, error: profilesError } = await client
    .from('profiles')
    .select(PROFILE_SELECT_CONTACT)
    .in('id', friendIds)

  if (profilesError) {
    throw profilesError
  }

  return ((profiles as BackendProfileRow[] | null) ?? [])
    .map(mapProfileRow)
    .sort((left, right) => left.username.localeCompare(right.username))
}

export const fetchConversation = async (
  client: BackendClient,
  userId: string,
  friendId: string
): Promise<SocialMessage[]> => {
  const [sentResult, receivedResult] = await Promise.all([
    client
      .from('messages')
      .select('*')
      .eq('sender_id', userId)
      .eq('recipient_id', friendId)
      .order('created_at', { ascending: true }),
    client
      .from('messages')
      .select('*')
      .eq('sender_id', friendId)
      .eq('recipient_id', userId)
      .order('created_at', { ascending: true })
  ])

  if (sentResult.error) {
    throw sentResult.error
  }

  if (receivedResult.error) {
    throw receivedResult.error
  }

  const rows = [
    ...((sentResult.data as BackendMessageRow[] | null) ?? []),
    ...((receivedResult.data as BackendMessageRow[] | null) ?? [])
  ].sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime())

  return rows.map((row) => {
    const content = parseSocialRichBody(row.body)

    return {
      id: row.id,
      friendId,
      sender: row.sender_id === userId ? 'self' : 'friend',
      text: content.text,
      gifUrl: content.gifUrl,
      imageUrl: content.imageUrl,
      sentAt: row.created_at,
      read: true,
      status: row.sender_id === userId ? 'sent' : 'delivered'
    }
  })
}

export const sendSocialMessage = async (
  client: BackendClient,
  userId: string,
  friendId: string,
  input: {
    text: string
    gifUrl?: string
    imageUrl?: string
  }
): Promise<SocialMessage> => {
  const content = composeSocialRichBody(input.text, input.gifUrl, input.imageUrl)
  const { data, error } = await client
    .from('messages')
    .insert({
      sender_id: userId,
      recipient_id: friendId,
      body: content
    })
    .select('*')
    .single()

  if (error) {
    throw error
  }

  const row = data as BackendMessageRow
  const parsedContent = parseSocialRichBody(row.body)

  return {
    id: row.id,
    friendId,
    sender: 'self',
    text: parsedContent.text,
    gifUrl: parsedContent.gifUrl,
    imageUrl: parsedContent.imageUrl,
    sentAt: row.created_at,
    read: true,
    status: 'sent'
  }
}

export const fetchRecentPokes = async (
  client: BackendClient,
  userId: string
): Promise<SocialPokeEvent[]> => {
  const [sentResult, receivedResult] = await Promise.all([
    client
      .from('pokes')
      .select('*')
      .eq('sender_id', userId)
      .order('created_at', { ascending: false })
      .limit(10),
    client
      .from('pokes')
      .select('*')
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)
  ])

  if (sentResult.error) {
    throw sentResult.error
  }

  if (receivedResult.error) {
    throw receivedResult.error
  }

  const rows = [
    ...((sentResult.data as BackendPokeRow[] | null) ?? []),
    ...((receivedResult.data as BackendPokeRow[] | null) ?? [])
  ]
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, 12)

  return rows.map((row) => ({
    id: row.id,
    friendId: row.sender_id === userId ? row.recipient_id : row.sender_id,
    direction: row.sender_id === userId ? 'outgoing' : 'incoming',
    sentAt: row.created_at
  }))
}

export const sendSocialPoke = async (
  client: BackendClient,
  userId: string,
  friendId: string
): Promise<void> => {
  const { error } = await client.from('pokes').insert({
    sender_id: userId,
    recipient_id: friendId
  })

  if (error) {
    throw error
  }
}

export const fetchSocialPostsForProfile = async (
  client: BackendClient,
  profileUserId: string
): Promise<SocialProfilePost[]> => {
  const unsupportedTables = getUnsupportedSocialTables(client)

  if (unsupportedTables.has('social_posts')) {
    return []
  }

  const { data, error } = await client
    .from('social_posts')
    .select('*')
    .eq('user_id', profileUserId)
    .order('created_at', { ascending: false })
    .limit(12)

  if (error) {
    if (extractMissingTableName(error) === 'social_posts') {
      unsupportedTables.add('social_posts')
      return []
    }

    throw error
  }

  return ((data as BackendSocialPostRow[] | null) ?? []).map(mapPostRow)
}

export const createSocialPost = async (
  client: BackendClient,
  userId: string,
  input: {
    type: SocialProfilePost['type']
    assetId?: string
    assetSymbol?: string
    title: string
    body: string
    snapshotDataUrl?: string
  }
): Promise<SocialProfilePost> => {
  const unsupportedTables = getUnsupportedSocialTables(client)

  if (unsupportedTables.has('social_posts')) {
    throw new Error(formatSocialBackendError({ message: "Could not find the table 'public.social_posts' in the schema cache" }))
  }

  const { data, error } = await client
    .from('social_posts')
    .insert({
      user_id: userId,
      post_type: input.type,
      asset_id: input.assetId ?? null,
      asset_symbol: input.assetSymbol ?? null,
      title: input.title.trim(),
      body: input.body.trim(),
      snapshot_data_url: input.snapshotDataUrl ?? null
    })
    .select('*')
    .single()

  if (error) {
    const missingTable = extractMissingTableName(error)

    if (missingTable === 'social_posts') {
      unsupportedTables.add(missingTable)
    }

    throw error
  }

  return mapPostRow(data as BackendSocialPostRow)
}

export const fetchProfileComments = async (
  client: BackendClient,
  profileUserId: string
): Promise<SocialProfileComment[]> => {
  const unsupportedTables = getUnsupportedSocialTables(client)

  if (unsupportedTables.has('profile_comments')) {
    return []
  }

  const { data, error } = await client
    .from('profile_comments')
    .select('*')
    .eq('profile_user_id', profileUserId)
    .order('created_at', { ascending: false })
    .limit(12)

  if (error) {
    if (extractMissingTableName(error) === 'profile_comments') {
      unsupportedTables.add('profile_comments')
      return []
    }

    throw error
  }

  const commentRows = (data as BackendProfileCommentRow[] | null) ?? []
  const authorIds = Array.from(new Set(commentRows.map((row) => row.author_user_id)))
  const authorProfilesById = await fetchProfilesByIds(client, authorIds, PROFILE_SELECT_BASIC)

  return commentRows.map((row) => {
    const authorProfile = authorProfilesById.get(row.author_user_id)

    return mapCommentRow(row, authorProfile)
  })
}

export const createProfileComment = async (
  client: BackendClient,
  profileUserId: string,
  authorUserId: string,
  input: {
    body: string
    gifUrl?: string
  }
): Promise<SocialProfileComment> => {
  const unsupportedTables = getUnsupportedSocialTables(client)

  if (unsupportedTables.has('profile_comments')) {
    throw new Error(
      formatSocialBackendError({ message: "Could not find the table 'public.profile_comments' in the schema cache" })
    )
  }

  const content = composeSocialRichBody(input.body, input.gifUrl)
  const { data, error } = await client
    .from('profile_comments')
    .insert({
      profile_user_id: profileUserId,
      author_user_id: authorUserId,
      body: content
    })
    .select('*')
    .single()

  if (error) {
    const missingTable = extractMissingTableName(error)

    if (missingTable === 'profile_comments') {
      unsupportedTables.add(missingTable)
    }

    throw error
  }

  const authorProfile = await fetchSocialProfile(client, authorUserId)
  return mapCommentRow(data as BackendProfileCommentRow, authorProfile ?? undefined)
}

export const subscribeToUserAppState = (
  client: BackendClient,
  userId: string,
  onStateChanged: (payload: CloudAppStatePayload) => void
): (() => void) => {
  const channel = client
    .channel(`avy-user-app-state-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_app_state',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        const nextPayload = (payload.new as BackendUserAppStateRow | null)?.payload

        if (nextPayload) {
          onStateChanged(nextPayload)
        }
      }
    )
    .subscribe()

  return () => {
    void client.removeChannel(channel)
  }
}

export const subscribeToProfileFeed = (
  client: BackendClient,
  profileUserId: string,
  handlers: {
    onPostInserted: () => void
    onCommentInserted: () => void
  }
): (() => void) => {
  const channel = client
    .channel(`avy-profile-feed-${profileUserId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'social_posts',
        filter: `user_id=eq.${profileUserId}`
      },
      () => {
        handlers.onPostInserted()
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'profile_comments',
        filter: `profile_user_id=eq.${profileUserId}`
      },
      () => {
        handlers.onCommentInserted()
      }
    )
    .subscribe()

  return () => {
    void client.removeChannel(channel)
  }
}

export const subscribeToSocialRoster = (
  client: BackendClient,
  userId: string,
  onRosterChanged: () => void
): (() => void) => {
  const channel = client
    .channel(`avy-social-roster-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'contacts',
        filter: `user_id=eq.${userId}`
      },
      onRosterChanged
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'contacts',
        filter: `friend_user_id=eq.${userId}`
      },
      onRosterChanged
    )
    .subscribe()

  return () => {
    void client.removeChannel(channel)
  }
}

export const subscribeToProfileUpdates = (
  client: BackendClient,
  profileUserId: string,
  onProfileChanged: () => void
): (() => void) => {
  const channel = client
    .channel(`avy-profile-updates-${profileUserId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${profileUserId}`
      },
      onProfileChanged
    )
    .subscribe()

  return () => {
    void client.removeChannel(channel)
  }
}

export const subscribeToSocialEvents = (
  client: BackendClient,
  userId: string,
  handlers: {
    onIncomingMessage: (payload: { id: string; friendId: string; text: string; gifUrl?: string; imageUrl?: string; sentAt: string }) => void
    onIncomingPoke: (payload: { id: string; friendId: string; sentAt: string }) => void
  }
): (() => void) => {
  const channel = client
    .channel(`avy-social-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `recipient_id=eq.${userId}`
      },
      (payload) => {
        const row = payload.new as BackendMessageRow
        const content = parseSocialRichBody(row.body)
        handlers.onIncomingMessage({
          id: row.id,
          friendId: row.sender_id,
          text: content.text,
          gifUrl: content.gifUrl,
          imageUrl: content.imageUrl,
          sentAt: row.created_at
        })
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'pokes',
        filter: `recipient_id=eq.${userId}`
      },
      (payload) => {
        const row = payload.new as BackendPokeRow
        handlers.onIncomingPoke({
          id: row.id,
          friendId: row.sender_id,
          sentAt: row.created_at
        })
      }
    )
    .subscribe()

  return () => {
    void client.removeChannel(channel)
  }
}
