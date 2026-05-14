const toValidDate = (value: string | number | Date): Date | null => {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export const formatCurrency = (
  value: number,
  currency = 'USD',
  maximumFractionDigits =
    value >= 1000
      ? 0
      : value >= 100
        ? 2
        : value >= 1
          ? 2
          : value >= 0.1
            ? 4
            : value >= 0.01
              ? 5
              : 6
): string => {
  try {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency,
      minimumFractionDigits: value < 1 ? Math.min(maximumFractionDigits, 4) : 0,
      maximumFractionDigits
    }).format(value)
  } catch {
    return `${new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: value < 1 ? Math.min(maximumFractionDigits, 4) : 0,
      maximumFractionDigits: Math.min(maximumFractionDigits, 6)
    }).format(value)} ${currency}`
  }
}

export const formatPercent = (value: number): string => {
  const sign = value > 0 ? '+' : ''
  return `${sign}${new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)}%`
}

export const formatCompactNumber = (value: number): string =>
  new Intl.NumberFormat('tr-TR', {
    notation: 'compact',
    maximumFractionDigits: 2
  }).format(value)

export const formatVolume = (value: number): string => `${formatCompactNumber(value)} hacim`

export const formatRelativeTime = (value: string): string => {
  const date = toValidDate(value)
  if (!date) {
    return 'zaman bilgisi yok'
  }
  const now = Date.now()
  const diffSeconds = Math.round((date.getTime() - now) / 1000)
  const formatter = new Intl.RelativeTimeFormat('tr-TR', { numeric: 'auto' })

  const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60]
  ]

  for (const [unit, secondsPerUnit] of steps) {
    if (Math.abs(diffSeconds) >= secondsPerUnit || unit === 'minute') {
      return formatter.format(Math.round(diffSeconds / secondsPerUnit), unit)
    }
  }

  return 'az once'
}

export const formatDateTime = (value: string): string =>
  (() => {
    const date = toValidDate(value)

    if (!date) {
      return 'zaman bilgisi yok'
    }

    return new Intl.DateTimeFormat('tr-TR', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date)
  })()

export const formatEditableNumber = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '0'
  }

  if (value >= 1000) {
    return value.toFixed(0)
  }

  if (value >= 1) {
    return value.toFixed(2)
  }

  if (value >= 0.1) {
    return value.toFixed(4)
  }

  if (value >= 0.01) {
    return value.toFixed(5)
  }

  return value.toFixed(6)
}

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)
