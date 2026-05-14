import type { AssetProfile } from '@shared/types/market'

interface MarketSchedule {
  timeZone: string
  openMinutes: number
  closeMinutes: number
}

const MARKET_SCHEDULES: Record<string, MarketSchedule> = {
  bist: {
    timeZone: 'Europe/Istanbul',
    openMinutes: 10 * 60,
    closeMinutes: 18 * 60
  },
  us: {
    timeZone: 'America/New_York',
    openMinutes: 9 * 60 + 30,
    closeMinutes: 16 * 60
  }
}

const resolveMarketKey = (profile: AssetProfile): keyof typeof MARKET_SCHEDULES | null => {
  const market = (profile.market ?? '').toLowerCase()
  const exchange = profile.exchange.toLowerCase()

  if (market === 'bist' || exchange.includes('bist')) {
    return 'bist'
  }

  if (
    market === 'us' ||
    exchange.includes('nasdaq') ||
    exchange.includes('nyse') ||
    exchange.includes('amex')
  ) {
    return 'us'
  }

  return null
}

const getClockParts = (date: Date, timeZone: string): { weekday: string; minutes: number } => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })

  const parts = formatter.formatToParts(date)
  const weekday = parts.find((part) => part.type === 'weekday')?.value ?? 'Mon'
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0')

  return {
    weekday,
    minutes: hour * 60 + minute
  }
}

export const isMarketClosedForProfile = (profile: AssetProfile, now = new Date()): boolean => {
  if (profile.class !== 'stock') {
    return false
  }

  const marketKey = resolveMarketKey(profile)

  if (!marketKey) {
    return false
  }

  const schedule = MARKET_SCHEDULES[marketKey]
  const clock = getClockParts(now, schedule.timeZone)

  if (clock.weekday === 'Sat' || clock.weekday === 'Sun') {
    return true
  }

  return clock.minutes < schedule.openMinutes || clock.minutes >= schedule.closeMinutes
}

export const getMarketStatusLabel = (profile: AssetProfile, now = new Date()): string | null =>
  isMarketClosedForProfile(profile, now) ? 'Piyasa kapalı' : null
