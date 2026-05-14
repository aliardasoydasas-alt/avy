import type { CSSProperties } from 'react'
import type { ProfileShowcaseSettings } from '@shared/types/social'

export interface ShowcasePreset {
  id: string
  title: string
  description: string
}

export const WALLPAPER_PRESETS: ShowcasePreset[] = [
  {
    id: 'aurora-desk',
    title: 'Aurora Desk',
    description: 'Yumuşak altın ve mavi geçişler'
  },
  {
    id: 'market-grid',
    title: 'Market Grid',
    description: 'Terminal hissi veren çizgisel katman'
  },
  {
    id: 'sunset-liquidity',
    title: 'Sunset Liquidity',
    description: 'Turuncu-kırmızı ışımalı görünüm'
  },
  {
    id: 'night-engine',
    title: 'Night Engine',
    description: 'Derin lacivert ve yeşil piyasa tonu'
  }
]

export const BACKGROUND_PRESETS: ShowcasePreset[] = [
  {
    id: 'golden-orbit',
    title: 'Golden Orbit',
    description: 'Altın halka hareketi'
  },
  {
    id: 'bull-pulse',
    title: 'Bull Pulse',
    description: 'Akışkan yukarı yönlü enerji'
  },
  {
    id: 'calm-depth',
    title: 'Calm Depth',
    description: 'Dingin ve premium görünüm'
  },
  {
    id: 'signal-wave',
    title: 'Signal Wave',
    description: 'Yavaş dalgalı teknik zemin'
  }
]

export const DEFAULT_PROFILE_SHOWCASE: ProfileShowcaseSettings = {
  wallpaperId: WALLPAPER_PRESETS[0].id,
  backgroundPresetId: BACKGROUND_PRESETS[0].id
}

export const isCustomWallpaperId = (wallpaperId?: string | null): wallpaperId is string =>
  typeof wallpaperId === 'string' && wallpaperId.startsWith('data:image/')

export const normalizeProfileShowcase = (
  showcase?: Partial<ProfileShowcaseSettings> | null
): ProfileShowcaseSettings => ({
  wallpaperId:
    (isCustomWallpaperId(showcase?.wallpaperId)
      ? showcase?.wallpaperId
      : WALLPAPER_PRESETS.find((preset) => preset.id === showcase?.wallpaperId)?.id) ??
    DEFAULT_PROFILE_SHOWCASE.wallpaperId,
  backgroundPresetId:
    BACKGROUND_PRESETS.find((preset) => preset.id === showcase?.backgroundPresetId)?.id ??
    DEFAULT_PROFILE_SHOWCASE.backgroundPresetId
})

const wallpaperStyles: Record<string, CSSProperties> = {
  'aurora-desk': {
    background:
      'radial-gradient(circle at 15% 20%, rgba(246,196,69,0.45), transparent 28%), radial-gradient(circle at 78% 30%, rgba(74,144,226,0.35), transparent 24%), linear-gradient(135deg, #13263e 0%, #0b1526 50%, #1c2d2b 100%)'
  },
  'market-grid': {
    background:
      'linear-gradient(135deg, rgba(12,23,40,0.96), rgba(5,11,18,0.92)), linear-gradient(90deg, rgba(246,196,69,0.12) 1px, transparent 1px), linear-gradient(rgba(123,215,196,0.08) 1px, transparent 1px)',
    backgroundSize: 'cover, 36px 36px, 36px 36px'
  },
  'sunset-liquidity': {
    background:
      'radial-gradient(circle at 25% 20%, rgba(255,173,87,0.5), transparent 24%), radial-gradient(circle at 80% 25%, rgba(255,96,96,0.34), transparent 24%), linear-gradient(140deg, #2b1214 0%, #151e33 58%, #11161f 100%)'
  },
  'night-engine': {
    background:
      'radial-gradient(circle at 20% 25%, rgba(59,130,246,0.24), transparent 26%), radial-gradient(circle at 75% 20%, rgba(34,197,94,0.2), transparent 24%), linear-gradient(135deg, #09111d 0%, #0e1b2e 45%, #132319 100%)'
  }
}

const overlayStyles: Record<string, CSSProperties> = {
  'golden-orbit': {
    background:
      'radial-gradient(circle at center, rgba(246,196,69,0.18), transparent 35%), conic-gradient(from 0deg, rgba(246,196,69,0.05), rgba(255,255,255,0.02), rgba(246,196,69,0.08), rgba(255,255,255,0.01), rgba(246,196,69,0.05))'
  },
  'bull-pulse': {
    background:
      'radial-gradient(circle at 30% 65%, rgba(34,197,94,0.16), transparent 22%), radial-gradient(circle at 70% 30%, rgba(246,196,69,0.18), transparent 25%), linear-gradient(120deg, rgba(255,255,255,0.04), rgba(255,255,255,0))'
  },
  'calm-depth': {
    background:
      'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0)), radial-gradient(circle at 50% 10%, rgba(123,215,196,0.09), transparent 25%)'
  },
  'signal-wave': {
    background:
      'radial-gradient(circle at 15% 35%, rgba(74,144,226,0.16), transparent 25%), radial-gradient(circle at 85% 65%, rgba(123,215,196,0.12), transparent 22%), linear-gradient(140deg, rgba(246,196,69,0.06), rgba(255,255,255,0))'
  }
}

export const getWallpaperPreviewStyle = (wallpaperId: string): CSSProperties => {
  if (isCustomWallpaperId(wallpaperId)) {
    return {
      backgroundImage: `linear-gradient(180deg, rgba(9, 13, 22, 0.08), rgba(9, 13, 22, 0.3)), url("${wallpaperId}")`,
      backgroundPosition: 'center',
      backgroundSize: 'cover',
      backgroundRepeat: 'no-repeat'
    }
  }

  return wallpaperStyles[wallpaperId] ?? wallpaperStyles[DEFAULT_PROFILE_SHOWCASE.wallpaperId]
}

export const getBackgroundPreviewStyle = (backgroundPresetId: string): CSSProperties =>
  overlayStyles[backgroundPresetId] ?? overlayStyles[DEFAULT_PROFILE_SHOWCASE.backgroundPresetId]

export const getProfileShowcaseStyle = (
  showcase?: Partial<ProfileShowcaseSettings> | null
): CSSProperties => {
  const normalized = normalizeProfileShowcase(showcase)

  return {
    ...getWallpaperPreviewStyle(normalized.wallpaperId),
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)'
  }
}

export const getProfileShowcaseOverlayStyle = (
  showcase?: Partial<ProfileShowcaseSettings> | null
): CSSProperties => {
  const normalized = normalizeProfileShowcase(showcase)

  return getBackgroundPreviewStyle(normalized.backgroundPresetId)
}

