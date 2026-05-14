import type { HomeNewsInsight } from '@shared/types/home'

const positiveKeywords = [
  'deal',
  'pause',
  'cut',
  'stimulus',
  'eases',
  'progress',
  'growth',
  'rebound',
  'optimism',
  'support'
]

const negativeKeywords = [
  'inflation',
  'tariff',
  'war',
  'conflict',
  'sanction',
  'selloff',
  'recession',
  'tightening',
  'hawkish',
  'oil spike',
  'uncertainty',
  'default'
]

export const buildHomeNewsInsight = (title: string, summary: string): HomeNewsInsight => {
  const text = `${title} ${summary}`.toLowerCase()
  const positiveScore = positiveKeywords.filter((keyword) => text.includes(keyword)).length
  const negativeScore = negativeKeywords.filter((keyword) => text.includes(keyword)).length

  const tone =
    positiveScore > negativeScore
      ? 'positive'
      : negativeScore > positiveScore
        ? 'negative'
        : 'neutral'

  if (tone === 'positive') {
    return {
      tone,
      summary: 'Beklentilerden iyi bir tablo cikarsa risk istahi desteklenebilir ve endekslerde yukari yonlu hareket guclenebilir.',
      positiveCase: 'Ozellikle buyume ve faiz hassasiyeti yuksek varliklarda toparlanma hizi artabilir.',
      negativeCase: 'Beklentiler karsilanmazsa bu iyimserlik hizla geri verilebilir.'
    }
  }

  if (tone === 'negative') {
    return {
      tone,
      summary: 'Baslik, piyasada temkinli durusu ve oynakligi artirabilecek bir risk unsuru tasiyor.',
      positiveCase: 'Risk basligi hizla yatisirsa tepki alimi gelebilir ve baski hafifleyebilir.',
      negativeCase: 'Konu derinlesirse hisse ve kripto tarafinda satis baskisi artabilir.'
    }
  }

  return {
    tone,
    summary: 'Basligin etkisi veri akisina bagli. Piyasa net yon icin yeni teyit arayabilir.',
    positiveCase: 'Sonraki aciklamalar olumlu gelirse fiyatlama hizla daha iyimser tarafa donebilir.',
    negativeCase: 'Beklentileri bozan ek detaylar gelirse fiyatlama daha temkinli yone kayabilir.'
  }
}
