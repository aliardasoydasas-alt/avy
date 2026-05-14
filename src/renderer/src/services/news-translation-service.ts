const PHRASE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bwhat(?:'s| is) happening this week in economics\??/gi, 'Bu hafta ekonomide neler oluyor?'],
  [/\bwhat to watch(?: this week)?\b/gi, 'Bu hafta izlenecek basliklar'],
  [/\bwhat you need to know\b/gi, 'Bilmeniz gerekenler'],
  [/\bwhy it matters\b/gi, 'Neden onemli'],
  [/\blive updates?\b/gi, 'Canli gelismeler'],
  [/\blatest updates?\b/gi, 'Son gelismeler'],
  [/\bglobal markets\b/gi, 'kuresel piyasalar'],
  [/\bstock markets\b/gi, 'hisse piyasalari'],
  [/\bmarket analysis\b/gi, 'piyasa analizi'],
  [/\bmarket commentary\b/gi, 'piyasa yorumu'],
  [/\boil market report\b/gi, 'petrol piyasasi raporu'],
  [/\binterest rates\b/gi, 'faiz oranlari'],
  [/\bfederal reserve\b/gi, 'Fed'],
  [/\bUS-Iran\b/gi, 'ABD-Iran'],
  [/\bU\.S\.\b/gi, 'ABD'],
  [/\bUS\b/gi, 'ABD'],
  [/\bgeopolitical\b/gi, 'jeopolitik'],
  [/\bgeopolitics\b/gi, 'jeopolitik'],
  [/\bwall street\b/gi, 'Wall Street'],
  [/\bpeak fear and sell-off\b/gi, 'zirve korku ve satis baskisi'],
  [/\bfrom panic to pricing in\b/gi, 'panikten fiyatlamaya gecis']
]

const WORD_REPLACEMENTS: Record<string, string> = {
  ahead: 'oncesinde',
  after: 'sonrasinda',
  aftershock: 'artci etki',
  amid: 'ortaminda',
  around: 'cevresinde',
  asia: 'Asya',
  "asia's": "Asya'nin",
  bank: 'banka',
  banks: 'bankalar',
  before: 'oncesinde',
  bounce: 'tepki yukselisi',
  bullish: 'pozitif',
  bearish: 'negatif',
  bond: 'tahvil',
  bonds: 'tahviller',
  breaking: 'son dakika',
  china: 'Cin',
  commodities: 'emtialar',
  commodity: 'emtia',
  concern: 'endise',
  concerns: 'endiseler',
  data: 'veri',
  deal: 'anlasma',
  deals: 'anlasmalar',
  dollar: 'dolar',
  earnings: 'bilanco',
  global: 'kuresel',
  gains: 'kazanc',
  gain: 'yukselis',
  higher: 'daha yuksek',
  lower: 'daha dusuk',
  investors: 'yatirimcilar',
  investor: 'yatirimci',
  latest: 'son',
  live: 'canli',
  markets: 'piyasalar',
  market: 'piyasa',
  minutes: 'tutanaklar',
  meeting: 'toplanti',
  meetings: 'toplantilar',
  misses: 'karsilayamiyor',
  miss: 'karsilayamiyor',
  outlook: 'gorunum',
  pressure: 'baski',
  pressures: 'baskilar',
  rebound: 'toparlanma',
  report: 'raporu',
  reports: 'raporlar',
  risk: 'risk',
  risks: 'riskler',
  shares: 'hisseler',
  signal: 'sinyal',
  signals: 'sinyaller',
  strategist: 'stratejist',
  strategists: 'stratejistler',
  stocks: 'hisseler',
  stock: 'hisse',
  traders: 'yatirimcilar',
  trader: 'yatirimci',
  treasury: 'hazine',
  update: 'guncelleme',
  updates: 'guncellemeler',
  weekly: 'haftalik',
  why: 'neden',
  oil: 'petrol',
  economy: 'ekonomi',
  economics: 'ekonomi',
  inflation: 'enflasyon',
  tariff: 'tarife',
  tariffs: 'tarifeler',
  rates: 'faizler',
  futures: 'vadeliler',
  prices: 'fiyatlar',
  price: 'fiyat',
  talks: 'gorusmeleri',
  rally: 'ralli',
  rallies: 'yukseliyor',
  rallied: 'yukseldi',
  surge: 'sicrama',
  surges: 'yukseliyor',
  surged: 'yukseldi',
  falls: 'dusuyor',
  fall: 'dusuyor',
  fell: 'dustu',
  drop: 'dusuyor',
  drops: 'dusuyor',
  dropped: 'dustu',
  slip: 'geriliyor',
  slips: 'geriliyor',
  slipped: 'geriledi',
  hit: 'ulasti',
  hits: 'ulasiyor',
  record: 'rekor',
  records: 'rekorlar',
  steadies: 'denge buluyor',
  steady: 'dengeli',
  reopened: 'yeniden acildi',
  reopens: 'yeniden aciliyor',
  warns: 'uyariyor',
  brace: 'hazirlaniyor',
  looms: 'yaklasiyor',
  fuels: 'tetikliyor',
  fears: 'endiseleri',
  hopes: 'umutlari',
  says: 'diyor',
  happening: 'oluyor',
  week: 'hafta',
  this: 'bu',
  today: 'bugun',
  tomorrow: 'yarin',
  watch: 'izle',
  weighs: 'degerlendiriyor',
  weigh: 'degerlendiriyor',
  while: 'olurken',
  yield: 'getiri',
  yields: 'getiriler',
  commentary: 'yorumu',
  analysis: 'analizi',
  historic: 'tarihi',
  shock: 'sok',
  disruption: 'aksama',
  persists: 'suruyor',
  return: 'geri donuyor',
  reopen: 'yeniden acilma',
  world: 'dunya',
  war: 'savas',
  ceasefire: 'ateskes',
  deadline: 'son tarih',
  tension: 'gerilim',
  tensions: 'gerilim',
  conflict: 'catisma',
  fed: 'Fed',
  ecb: 'ECB'
}

const ENGLISH_SIGNAL_WORDS = [
  'a',
  'an',
  'about',
  'ahead',
  'after',
  'amid',
  'analysis',
  'and',
  'are',
  'as',
  'at',
  'before',
  'but',
  'by',
  'commentary',
  'could',
  'for',
  'from',
  'how',
  'in',
  'into',
  'investors',
  'is',
  'it',
  'its',
  'latest',
  'live',
  'the',
  'with',
  'after',
  'latest',
  'live',
  'markets',
  'market',
  'news',
  'of',
  'stocks',
  'oil',
  'on',
  'outlook',
  'prices',
  'price',
  'rates',
  'report',
  'reports',
  'summary',
  'talks',
  'this',
  'to',
  'update',
  'updates',
  'war',
  'watch',
  'week',
  'what',
  'why',
  'will',
  'with',
  'war',
  'inflation',
  'record',
  'rally',
  'surge'
]

const ALLOWED_LATIN_TOKENS = new Set([
  'abd',
  'asya',
  'avrupa',
  'bitcoin',
  'btc',
  'cnbc',
  'ecb',
  'fed',
  'iran',
  'israil',
  'opec',
  'reuters',
  'sp',
  'wall',
  'street',
  'trump'
])

const normalizeApostrophes = (value: string): string => value.replace(/[\u2019]/g, "'")

const preserveCapitalization = (original: string, translated: string): string => {
  if (!original) {
    return translated
  }

  if (original === original.toUpperCase()) {
    return translated.toUpperCase()
  }

  if (original[0] === original[0].toUpperCase()) {
    return translated.charAt(0).toUpperCase() + translated.slice(1)
  }

  return translated
}

const replaceWord = (token: string): string => {
  const match = token.match(/^([^A-Za-z]*)([A-Za-z.'-]+)([^A-Za-z]*)$/)

  if (!match) {
    return token
  }

  const [, prefix, word, suffix] = match
  const normalizedWord = word
    .replace(/[\u2019']/g, "'")
    .replace(/'s$/i, '')
    .toLowerCase()

  const translatedWord = WORD_REPLACEMENTS[normalizedWord]

  if (!translatedWord) {
    return token
  }

  return `${prefix}${preserveCapitalization(word, translatedWord)}${suffix}`
}

const cleanupText = (value: string): string =>
  value
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s+-\s+/g, ' - ')
    .trim()

const countEnglishSignals = (value: string): number => {
  const tokens = normalizeApostrophes(value)
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean)

  return tokens.filter((token) => ENGLISH_SIGNAL_WORDS.includes(token)).length
}

const countResidualLatinWords = (value: string): number =>
  normalizeApostrophes(value)
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((token) => token.length >= 3)
    .filter((token) => !ALLOWED_LATIN_TOKENS.has(token))
    .filter((token) => ENGLISH_SIGNAL_WORDS.includes(token) || !(token in WORD_REPLACEMENTS)).length

const buildTurkishHeadlineFallback = (title: string, summary?: string): string => {
  const text = `${title} ${summary ?? ''}`.toLowerCase()

  if (text.includes('oil') && (text.includes('drop') || text.includes('fall'))) {
    return 'Petrol fiyatlarindaki geri cekilme kuresel piyasalari destekliyor'
  }

  if (text.includes('oil') && (text.includes('surge') || text.includes('spike') || text.includes('rise'))) {
    return 'Petrol fiyatlarindaki yukselis kuresel piyasalarda baski yariyor'
  }

  if (text.includes('fed') || text.includes('federal reserve') || text.includes('ecb') || text.includes('inflation')) {
    return 'Faiz ve enflasyon gundemi piyasalarda belirleyici oluyor'
  }

  if (text.includes('iran') || text.includes('war') || text.includes('geopolitic') || text.includes('conflict')) {
    return 'Jeopolitik gelismeler kuresel piyasalarda oynaklik yaratiyor'
  }

  if (text.includes('stock') || text.includes('market') || text.includes('record') || text.includes('rally')) {
    return 'Kuresel piyasalarda dikkat ceken bir hareketlilik izleniyor'
  }

  return 'Kuresel piyasalari etkileyebilecek onemli bir gelisme izleniyor'
}

const buildTurkishSummaryFallback = (title: string, summary: string): string => {
  const text = `${title} ${summary}`.toLowerCase()
  const details: string[] = []

  if (text.includes('oil') && (text.includes('drop') || text.includes('fall'))) {
    details.push('Petrol fiyatlarindaki gerileme risk istahini destekleyebilir.')
  } else if (text.includes('oil')) {
    details.push('Petrol fiyatlarindaki oynaklik enflasyon beklentileri uzerinde etkili olabilir.')
  }

  if (text.includes('fed') || text.includes('federal reserve') || text.includes('ecb') || text.includes('inflation') || text.includes('rates')) {
    details.push('Merkez bankasi ve enflasyon basliklari varlik fiyatlari icin kritik olmaya devam ediyor.')
  }

  if (text.includes('iran') || text.includes('war') || text.includes('geopolitic') || text.includes('conflict')) {
    details.push('Jeopolitik riskler hisse, emtia ve kripto tarafinda oynakligi artirabilir.')
  }

  if (text.includes('record') || text.includes('rally') || text.includes('surge')) {
    details.push('Piyasa fiyatlamasinda yukari yonlu momentum one cikiyor.')
  }

  if (!details.length) {
    details.push('Baslik, kuresel piyasalar acisindan takip edilmesi gereken bir gelismeye isaret ediyor.')
  }

  return details.join(' ')
}

export const translateFinancialNewsText = (value: string): string => {
  if (!value.trim()) {
    return value
  }

  let translated = normalizeApostrophes(value).replace(/Asia's/gi, "Asya'nin")

  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    translated = translated.replace(pattern, replacement)
  }

  translated = translated
    .split(/\s+/)
    .map(replaceWord)
    .join(' ')

  translated = cleanupText(translated)

  return translated.charAt(0).toUpperCase() + translated.slice(1)
}

export const localizeFinancialNewsHeadline = (title: string, summary = ''): string => {
  const translated = translateFinancialNewsText(title)

  return countEnglishSignals(translated) >= 2 || countResidualLatinWords(translated) >= 2
    ? buildTurkishHeadlineFallback(title, summary)
    : translated
}

export const localizeFinancialNewsSummary = (summary: string, title = ''): string => {
  const translated = translateFinancialNewsText(summary)

  return countEnglishSignals(translated) >= 3 || countResidualLatinWords(translated) >= 3
    ? buildTurkishSummaryFallback(title, summary)
    : translated
}
