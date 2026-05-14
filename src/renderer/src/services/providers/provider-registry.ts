import type { MarketDataProvider } from './market-provider'
import { liveMarketProvider } from './live-market-provider'
import { mockMarketProvider } from './mock-market-provider'

const dataMode = import.meta.env.VITE_DATA_MODE ?? 'live'

export const marketProvider: MarketDataProvider = (() => {
  if (dataMode === 'mock') {
    return mockMarketProvider
  }

  if (dataMode === 'live') {
    return liveMarketProvider
  }

  throw new Error(`Unsupported data mode: ${dataMode}. Use VITE_DATA_MODE=live or mock.`)
})()
