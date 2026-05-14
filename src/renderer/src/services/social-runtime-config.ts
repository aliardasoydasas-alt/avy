export interface SocialRuntimeConfig {
  supabaseUrl: string
  supabaseAnonKey: string
}

const STORAGE_KEY = 'avy-social-runtime-config'

const readEnvConfig = (): SocialRuntimeConfig => ({
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey:
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    import.meta.env.VITE_SUPABASE_ANON_KEY ??
    ''
})

export const getSocialRuntimeConfig = (): SocialRuntimeConfig => {
  const envConfig = readEnvConfig()

  try {
    const raw = localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return envConfig
    }

    const parsed = JSON.parse(raw) as Partial<SocialRuntimeConfig>

    return {
      supabaseUrl: parsed.supabaseUrl ?? envConfig.supabaseUrl,
      supabaseAnonKey: parsed.supabaseAnonKey ?? envConfig.supabaseAnonKey
    }
  } catch {
    return envConfig
  }
}

export const saveSocialRuntimeConfig = (config: SocialRuntimeConfig): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export const clearSocialRuntimeConfig = (): void => {
  localStorage.removeItem(STORAGE_KEY)
}

export const isSocialConfigReady = (config: SocialRuntimeConfig): boolean =>
  Boolean(config.supabaseUrl.trim() && config.supabaseAnonKey.trim())
