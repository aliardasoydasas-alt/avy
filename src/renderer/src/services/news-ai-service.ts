import type { NewsAICommentary } from '@shared/types/news'

const positiveKeywords = [
  'beat',
  'beats',
  'approval',
  'approves',
  'deal',
  'launch',
  'growth',
  'record',
  'surge',
  'partnership',
  'buyback',
  'upgrade',
  'rebound'
]

const negativeKeywords = [
  'miss',
  'misses',
  'downgrade',
  'lawsuit',
  'tariff',
  'war',
  'conflict',
  'probe',
  'hack',
  'delay',
  'layoffs',
  'fall',
  'drop',
  'slump',
  'selloff'
]

const detectTone = (text: string): NewsAICommentary['tone'] => {
  const normalized = text.toLowerCase()
  const positiveScore = positiveKeywords.filter((keyword) => normalized.includes(keyword)).length
  const negativeScore = negativeKeywords.filter((keyword) => normalized.includes(keyword)).length

  if (positiveScore > negativeScore) {
    return 'positive'
  }

  if (negativeScore > positiveScore) {
    return 'negative'
  }

  return 'neutral'
}

const buildHeadlineHook = (title: string): string => {
  const normalized = title.replace(/\s+/g, ' ').trim()

  if (!normalized) {
    return 'Başlıkta net bir olay akışı görünmüyor.'
  }

  const shortTitle = normalized.split(' ').slice(0, 10).join(' ')
  return `"${shortTitle}${normalized.split(' ').length > 10 ? '…' : ''}" başlığı öne çıkıyor.`
}

export const buildAssetNewsCommentary = (
  symbol: string,
  title: string,
  summary: string
): NewsAICommentary => {
  const text = `${title} ${summary}`
  const tone = detectTone(text)
  const headlineHook = buildHeadlineHook(title)

  if (tone === 'positive') {
    return {
      tone,
      summary: `${headlineHook} ${symbol} tarafında haber akışı olumlu bir katalizöre işaret ediyor.`,
      impact: 'Beklentiler teyit edilirse momentum, hacim ve kısa vadeli ilgi tarafında destekleyici etki yaratabilir.'
    }
  }

  if (tone === 'negative') {
    return {
      tone,
      summary: `${headlineHook} ${symbol} için bu haber temkinli okunmalı; risk algısını artırabilecek bir unsur taşıyor.`,
      impact: 'Olumsuz detaylar derinleşirse satış baskısı, yükselen oynaklık veya zayıf açılış görülebilir.'
    }
  }

  return {
    tone,
    summary: `${headlineHook} ${symbol} için haber akışının etkisi şimdilik dengeli görünüyor.`,
    impact: 'Net yön oluşması için fiyat hareketi, hacim ve ek haber akışının birlikte izlenmesi gerekir.'
  }
}
