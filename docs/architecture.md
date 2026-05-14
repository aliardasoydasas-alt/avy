# AY Terminal Architecture

## Stack selection

- Electron: native desktop shell, notifications and future packaging path.
- React + TypeScript: fast UI iteration with type-safe feature modules.
- electron-vite: lean dev/build pipeline for Electron main, preload and renderer.
- lightweight-charts: lightweight professional chart rendering without introducing a separate market-data dependency.
- Zustand: lightweight local product state for watchlists, alerts and notification center.
- React Query: async data caching and error/loading management.

## Layers

- `src/main`: Electron main process, window lifecycle and native IPC.
- `src/preload`: secure renderer bridge for notifications and external links.
- `src/shared`: cross-process contracts and domain types.
- `src/renderer/src/services`: provider abstraction, alert engine, indicator engine and pattern detection.
- `src/renderer/src/store`: persisted user state and preferences.
- `src/renderer/src/features`: product-facing modules such as watchlists, chart, alerts and news.

## Live data strategy

- Binance crypto coverage uses official Spot REST endpoints and websocket ticker streams.
- Midas stock coverage uses official public US and BIST market pages for universe discovery and quotes.
- Midas public pages do not provide the same historical candle depth as a direct market-data API, so stock charts currently use derived candles around the latest public quote until a fuller stock feed is connected.
- No TradingView market data is used; Binance and Midas are the only active providers in this MVP.

## Growth path

- Replace mock providers with live providers behind the same `MarketDataProvider` contract.
- Add portfolio and auth modules as new feature slices without reworking renderer layout.
- Expand pattern detection into worker threads when scanning larger universes.
