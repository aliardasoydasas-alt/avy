import { useEffect, useMemo, useState } from 'react'
import type { AssetProfile } from '@shared/types/market'

interface AssetLogoProps {
  profile: AssetProfile
  size?: 'sm' | 'md'
}

const stockDomainMap: Record<string, string> = {
  AAPL: 'apple.com',
  NVDA: 'nvidia.com',
  TSLA: 'tesla.com',
  MSFT: 'microsoft.com',
  GOOGL: 'google.com',
  GOOG: 'google.com',
  AMZN: 'amazon.com',
  META: 'meta.com',
  THYAO: 'thy.com',
  ASELS: 'aselsan.com.tr',
  BIMAS: 'bim.com.tr',
  TUPRS: 'tupras.com.tr',
  TAVHL: 'tavhavalimanlari.com.tr',
  KCHOL: 'koc.com.tr',
  EREGL: 'erdemir.com.tr',
  AKBNK: 'akbank.com',
  GARAN: 'garantibbva.com.tr',
  FROTO: 'fordotosan.com.tr'
}

const getCryptoLogoSymbol = (symbol: string): string => {
  const normalized = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const quoteSuffixes = ['USDT', 'USDC', 'BUSD', 'USD', 'TRY', 'EUR', 'BTC', 'ETH']

  for (const suffix of quoteSuffixes) {
    if (normalized.endsWith(suffix) && normalized.length > suffix.length) {
      return normalized.slice(0, -suffix.length).toLowerCase()
    }
  }

  return normalized.toLowerCase()
}

const buildLogoCandidates = (profile: AssetProfile): string[] => {
  if (profile.class === 'crypto') {
    const symbol = getCryptoLogoSymbol(profile.symbol)
    return [
      `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/${symbol}.png`,
      `https://assets.coincap.io/assets/icons/${symbol}@2x.png`,
      'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/generic.png'
    ]
  }

  const candidates: string[] = []
  const symbol = profile.symbol.toUpperCase()
  const market = (profile.market ?? '').toLowerCase()
  const mappedDomain = stockDomainMap[symbol]

  if (market === 'us') {
    candidates.push(`https://eodhd.com/img/logos/US/${symbol}.png`)
    candidates.push(`https://companiesmarketcap.com/img/company-logos/64/${symbol}.png`)
  }

  if (market === 'bist') {
    candidates.push(`https://eodhd.com/img/logos/TR/${symbol}.png`)
  }

  if (mappedDomain) {
    candidates.push(`https://logo.clearbit.com/${mappedDomain}`)
    candidates.push(`https://www.google.com/s2/favicons?sz=64&domain=${mappedDomain}`)
  }

  const rawUrls = [profile.sourceUrl, profile.detailUrl].filter(Boolean)
  rawUrls.forEach((url) => {
    try {
      const domain = new URL(url!).hostname
      candidates.push(`https://logo.clearbit.com/${domain}`)
      candidates.push(`https://www.google.com/s2/favicons?sz=64&domain=${domain}`)
    } catch {
      return
    }
  })

  return Array.from(new Set(candidates.filter(Boolean)))
}

export const AssetLogo = ({ profile, size = 'sm' }: AssetLogoProps) => {
  const logoCandidates = useMemo(() => buildLogoCandidates(profile), [profile])
  const [candidateIndex, setCandidateIndex] = useState(0)
  const initials = profile.symbol.slice(0, 2).toUpperCase()
  const logoUrl = logoCandidates[candidateIndex] ?? null

  useEffect(() => {
    setCandidateIndex(0)
  }, [profile.id, logoCandidates.length])

  return (
    <div className={size === 'md' ? 'asset-logo asset-logo--md' : 'asset-logo'}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={profile.symbol}
          loading="lazy"
          onError={() => {
            setCandidateIndex((current) =>
              current < logoCandidates.length - 1 ? current + 1 : logoCandidates.length
            )
          }}
        />
      ) : (
        <strong>{initials}</strong>
      )}
    </div>
  )
}
