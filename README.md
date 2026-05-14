# AY Terminal

AY Terminal is a dark-first desktop investment terminal for tracking crypto and stocks from a single workspace. The current build uses live Binance spot data for crypto and official Midas public market pages for US and BIST stock coverage.

## Why this stack

- Electron: native desktop shell, window management and notification support.
- React + TypeScript: fast UI iteration with strict type safety.
- electron-vite: clean build pipeline for Electron main, preload and renderer.
- lightweight-charts: lightweight, professional-grade chart rendering. No TradingView data source is used.
- Zustand + React Query: clear split between cached async data and persisted user state.

## Current MVP scope

- Search, favorites, recent assets and multi-watchlist sidebar.
- Asset detail workspace with chart, timeframe switcher and core metrics.
- Technical summary panel with RSI, MACD, EMA, SMA, Bollinger, support/resistance and trend bias.
- Alert builder, alert trigger history and notification center.
- Pattern detection service for TOBO, OBO, cup-handle and flag structures.
- Desktop notifications routed through Electron IPC.
- Binance live REST + websocket market data.
- Midas US and BIST universe discovery and quote parsing from official public pages.

## Folder structure

```text
.
|-- docs/
|-- src/
|   |-- main/
|   |-- preload/
|   |-- renderer/
|   |   `-- src/
|   |       |-- app/
|   |       |-- components/
|   |       |-- features/
|   |       |-- hooks/
|   |       |-- services/
|   |       |-- store/
|   |       `-- utils/
|   `-- shared/
|       `-- types/
|-- .env.example
|-- electron.vite.config.ts
|-- package.json
`-- tsconfig.json
```

## Environment

Copy `.env.example` to `.env` and keep:

```bash
VITE_DATA_MODE=live
VITE_ENABLE_DESKTOP_NOTIFICATIONS=true
```

Provider notes:

- Crypto: official Binance Spot API and websocket streams.
- Stocks: official Midas public market pages. Public pages can be delayed, so Midas-backed charts are shown as derived previews until a direct broker or market-data API is added.
- No TradingView market data is used in the current build.
- Extra provider keys are still listed in `.env.example` for the next phase.

## Install

You need Node.js LTS with npm available in `PATH`.

```bash
npm install
```

## Run in development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Auto-update

AVY can be built with in-app update support for installed Windows users.

1. Set `AVY_UPDATE_URL` in `.env` or the shell before packaging.
2. Run `npm run dist`.
3. Upload the generated Windows artifacts and update metadata from `release/<version>/` to that URL.

Notes:

- Use the `AVY-Setup-<version>.exe` installer for users who should receive in-app updates.
- Portable builds are convenient, but the installed NSIS build is the recommended update path.
- When `AVY_UPDATE_URL` is omitted, packaging still works, but automatic update checks remain disabled for that build.

## Tests

```bash
npm run test
```

## Next integration steps

1. Add a direct stock market-data API for full historical candles and lower-latency quotes.
2. Move pattern scanning into a worker when the universe expands beyond the current watchlist.
3. Add portfolio and authentication slices using the existing `shared` and `store` boundaries.
