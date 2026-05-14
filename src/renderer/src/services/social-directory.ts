import type { FriendProfile } from '@shared/types/social'

const communityProfiles: FriendProfile[] = [
  {
    id: 'friend-deniz',
    username: 'denizakyol',
    displayName: 'Deniz Akyol',
    bio: 'Savunma ve ulasim hisselerinde orta vade takip yapar. Grafik ustunde hacim teyidi ve trend kirilimlarini sever.',
    joinedAt: '2026-02-18T09:15:00.000Z',
    location: 'Istanbul',
    accentColor: '#f6c445',
    presence: 'online',
    publicAssetIds: ['midas-bist:ASELS', 'midas-bist:THYAO', 'binance:BTCUSDT'],
    publicListNames: ['BIST liderler', 'Gun ici teyit']
  },
  {
    id: 'friend-lina',
    username: 'linaeren',
    displayName: 'Lina Eren',
    bio: 'ABD buyume hisseleri ve makro akis bir aradaysa dikkat kesilir. Bilanco ve merkez bankasi etkisini birlikte izler.',
    joinedAt: '2026-01-29T14:40:00.000Z',
    location: 'Ankara',
    accentColor: '#f05d5e',
    presence: 'busy',
    publicAssetIds: ['midas-us:NVDA', 'midas-us:MSFT', 'midas-us:SPY'],
    publicListNames: ['AI liderleri', 'Makro radar']
  },
  {
    id: 'friend-yigit',
    username: 'yigitkaraca',
    displayName: 'Yigit Karaca',
    bio: 'Altcoin momentumunu ve formasyon kirmalarini sever. Kisa vade hareketli piyasada yasiyor.',
    joinedAt: '2026-03-07T18:05:00.000Z',
    location: 'Izmir',
    accentColor: '#4dd27c',
    presence: 'away',
    publicAssetIds: ['binance:SOLUSDT', 'binance:ARPAUSDT', 'binance:OGUSDT'],
    publicListNames: ['Altcoin hizli radar', 'Breakout takip']
  },
  {
    id: 'friend-selin',
    username: 'selinoz',
    displayName: 'Selin Oz',
    bio: 'Temettuye ve duzenli nakit akisi olan sirketlere bakar. Daha sakin ama temiz bir portfoy yapisini tercih eder.',
    joinedAt: '2026-02-02T11:20:00.000Z',
    location: 'Bursa',
    accentColor: '#64b5f6',
    presence: 'online',
    publicAssetIds: ['midas-bist:BIMAS', 'midas-us:AAPL', 'midas-us:MSFT'],
    publicListNames: ['Defansif buyume', 'Temettu odakli']
  }
]

const normalizeSearch = (value: string): string =>
  value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

export const getSocialDirectory = (): FriendProfile[] => communityProfiles

export const getFriendById = (friendId: string): FriendProfile | undefined =>
  communityProfiles.find((friend) => friend.id === friendId)

export const searchCommunityProfiles = (
  directory: FriendProfile[],
  term: string,
  excludedIds: string[] = []
): FriendProfile[] => {
  const normalizedTerm = normalizeSearch(term)

  if (!normalizedTerm) {
    return []
  }

  return directory
    .filter((friend) => !excludedIds.includes(friend.id))
    .map((friend) => {
      const haystack = normalizeSearch(
        `${friend.username} ${friend.displayName} ${friend.bio} ${friend.location ?? ''}`
      )

      let score = 0

      if (normalizeSearch(friend.username) === normalizedTerm) {
        score += 100
      } else if (normalizeSearch(friend.username).startsWith(normalizedTerm)) {
        score += 75
      } else if (normalizeSearch(friend.username).includes(normalizedTerm)) {
        score += 45
      }

      if (normalizeSearch(friend.displayName).includes(normalizedTerm)) {
        score += 20
      }

      if (haystack.includes(normalizedTerm)) {
        score += 5
      }

      return { friend, score }
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((item) => item.friend)
}

