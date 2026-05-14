export interface TryFxRates {
  usdTry: number
  eurTry: number
  source: 'live' | 'fallback'
  updatedAt: string
}

const FALLBACK_RATES: TryFxRates = {
  usdTry: 38,
  eurTry: 41.5,
  source: 'fallback',
  updatedAt: new Date().toISOString()
}

interface FrankfurterResponse {
  amount: number
  base: string
  date: string
  rates: {
    TRY?: number
    EUR?: number
  }
}

export const getTryFxRates = async (): Promise<TryFxRates> => {
  try {
    const response = await fetch('https://api.frankfurter.app/latest?from=USD&to=TRY,EUR')

    if (!response.ok) {
      throw new Error('Kur verisi alinamadi')
    }

    const payload = (await response.json()) as FrankfurterResponse

    if (!payload.rates.TRY || !payload.rates.EUR) {
      throw new Error('TRY kuru eksik')
    }

    return {
      usdTry: payload.rates.TRY,
      eurTry: payload.rates.TRY / payload.rates.EUR,
      source: 'live',
      updatedAt: new Date().toISOString()
    }
  } catch {
    return FALLBACK_RATES
  }
}
