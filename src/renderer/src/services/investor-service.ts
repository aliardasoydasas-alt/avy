import { formatCurrency } from '@renderer/utils/format'
import type { MarketOverviewItem } from '@shared/types/market'
import type { InvestorHolding, InvestorProfile } from '@shared/types/investors'

const investors: InvestorProfile[] = [
  {
    id: 'warren-buffett',
    name: 'Warren Buffett',
    photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Warren_Buffett_KU_Visit.jpg',
    shortDescription:
      'Değer yatırımı yaklaşımının en güçlü temsilcilerinden biri; güçlü nakit akışı ve kalıcı marka etkisi arıyor.',
    investmentStyle: 'value',
    firm: 'Berkshire Hathaway',
    trackedHoldingCount: 5,
    lastUpdated: '2025-12-31',
    source: {
      label: 'Berkshire Hathaway / SEC 13F',
      url: 'https://www.berkshirehathaway.com/',
      updatedAt: '2025-12-31',
      note: 'Pozisyonlar kamuya açık bildirimlerden gelir ve doğal olarak gecikmelidir.'
    },
    aiSummary:
      'Portföyün çekirdeği büyük ölçekli ABD hisselerinde. Kaliteli bilanço, serbest nakit akışı ve dayanıklı rekabet avantajı öne çıkıyor.',
    holdings: [
      { id: 'buffett-aapl', assetId: 'midas-us:AAPL', symbol: 'AAPL', name: 'Apple', assetClass: 'stock', weightPercent: 24.4 },
      { id: 'buffett-axp', assetId: 'midas-us:AXP', symbol: 'AXP', name: 'American Express', assetClass: 'stock', weightPercent: 15.1 },
      { id: 'buffett-bac', assetId: 'midas-us:BAC', symbol: 'BAC', name: 'Bank of America', assetClass: 'stock', weightPercent: 10.7 },
      { id: 'buffett-ko', assetId: 'midas-us:KO', symbol: 'KO', name: 'Coca-Cola', assetClass: 'stock', weightPercent: 9.6 },
      { id: 'buffett-cvx', assetId: 'midas-us:CVX', symbol: 'CVX', name: 'Chevron', assetClass: 'stock', weightPercent: 7.1 }
    ]
  },
  {
    id: 'bill-ackman',
    name: 'Bill Ackman',
    photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/72/Bill_Ackman_2016.jpg',
    shortDescription:
      'Az sayıda, yüksek inançlı pozisyona odaklanan aktivist yatırımcı; portföy yoğunlaşmasını bilinçli kullanıyor.',
    investmentStyle: 'hedge-fund',
    firm: 'Pershing Square',
    trackedHoldingCount: 5,
    lastUpdated: '2025-12-31',
    source: {
      label: 'Pershing Square public materials',
      url: 'https://www.pershingsquareholdings.com/portfolio/',
      updatedAt: '2025-12-31',
      note: 'Ağırlıklar her raporda aynı ayrıntıyla yayımlanmayabilir; görünüm kamu materyallerinden türetilir.'
    },
    aiSummary:
      'Portföy kalitesi yüksek, bilançosu güçlü ve marka etkisi olan işletmelere yoğunlaşıyor. Pozisyon sayısı sınırlı, fikir yoğunluğu yüksek.',
    holdings: [
      { id: 'ackman-uber', assetId: 'midas-us:UBER', symbol: 'UBER', name: 'Uber', assetClass: 'stock', sourceNote: 'Ağırlık kamu özetinde net paylaşılmadı.' },
      { id: 'ackman-googl', assetId: 'midas-us:GOOGL', symbol: 'GOOGL', name: 'Alphabet', assetClass: 'stock', sourceNote: 'Ağırlık kamu özetinde net paylaşılmadı.' },
      { id: 'ackman-hlt', assetId: 'midas-us:HLT', symbol: 'HLT', name: 'Hilton', assetClass: 'stock', sourceNote: 'Ağırlık kamu özetinde net paylaşılmadı.' },
      { id: 'ackman-qsr', assetId: 'midas-us:QSR', symbol: 'QSR', name: 'Restaurant Brands', assetClass: 'stock', sourceNote: 'Ağırlık kamu özetinde net paylaşılmadı.' },
      { id: 'ackman-cmg', assetId: 'midas-us:CMG', symbol: 'CMG', name: 'Chipotle', assetClass: 'stock', sourceNote: 'Ağırlık kamu özetinde net paylaşılmadı.' }
    ]
  },
  {
    id: 'cathie-wood',
    name: 'Cathie Wood',
    photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/8f/Cathie_Wood_2023.jpg',
    shortDescription:
      'Yenilikçi teknoloji, yüksek büyüme ve tematik dönüşüm odaklı portföyleriyle bilinen fon yöneticisi.',
    investmentStyle: 'technology',
    firm: 'ARK Invest',
    trackedHoldingCount: 5,
    lastUpdated: '2026-04-28',
    source: {
      label: 'ARK Invest public holdings',
      url: 'https://www.ark-funds.com/funds/arkk/',
      updatedAt: '2026-04-28',
      note: 'ARK düzenli portföy paylaşımı yapar; veriler yine de kısa gecikmeli olabilir.'
    },
    aiSummary:
      'Portföy yüksek büyüme ve teknoloji dönüşümü ekseninde toplanıyor. Oynaklık yüksek, tema korelasyonu da güçlü.',
    holdings: [
      { id: 'wood-tsla', assetId: 'midas-us:TSLA', symbol: 'TSLA', name: 'Tesla', assetClass: 'stock', weightPercent: 9.8 },
      { id: 'wood-coin', assetId: 'midas-us:COIN', symbol: 'COIN', name: 'Coinbase', assetClass: 'stock', weightPercent: 8.3 },
      { id: 'wood-roku', assetId: 'midas-us:ROKU', symbol: 'ROKU', name: 'Roku', assetClass: 'stock', weightPercent: 7.1 },
      { id: 'wood-hood', assetId: 'midas-us:HOOD', symbol: 'HOOD', name: 'Robinhood', assetClass: 'stock', weightPercent: 6.4 },
      { id: 'wood-crsp', assetId: 'midas-us:CRSP', symbol: 'CRSP', name: 'CRISPR Therapeutics', assetClass: 'stock', weightPercent: 5.2 }
    ]
  },
  {
    id: 'terry-smith',
    name: 'Terry Smith',
    photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Terry_Smith_2019.jpg',
    shortDescription:
      'Kaliteli iş modeli, yüksek marj ve uzun vadeli bileşik getiri odağıyla bilinen yatırımcı.',
    investmentStyle: 'long-term',
    firm: 'Fundsmith',
    trackedHoldingCount: 5,
    lastUpdated: '2025-12-31',
    source: {
      label: 'Fundsmith public factsheet',
      url: 'https://www.fundsmith.co.uk/',
      updatedAt: '2025-12-31',
      note: 'Fon raporlarındaki kamuya açık büyük pozisyonlardan türetilir.'
    },
    aiSummary:
      'Portföy kaliteli, tekrarlayan gelir profiline sahip küresel şirketlere yoğunlaşıyor. Defansif büyüme yaklaşımı belirgin.',
    holdings: [
      { id: 'smith-msft', assetId: 'midas-us:MSFT', symbol: 'MSFT', name: 'Microsoft', assetClass: 'stock', weightPercent: 8.2 },
      { id: 'smith-meta', assetId: 'midas-us:META', symbol: 'META', name: 'Meta Platforms', assetClass: 'stock', weightPercent: 7.4 },
      { id: 'smith-v', assetId: 'midas-us:V', symbol: 'V', name: 'Visa', assetClass: 'stock', weightPercent: 6.9 },
      { id: 'smith-sbux', assetId: 'midas-us:SBUX', symbol: 'SBUX', name: 'Starbucks', assetClass: 'stock', weightPercent: 5.8 },
      { id: 'smith-mco', assetId: 'midas-us:MCO', symbol: 'MCO', name: 'Moody’s', assetClass: 'stock', weightPercent: 5.6 }
    ]
  },
  {
    id: 'stanley-druckenmiller',
    name: 'Stanley Druckenmiller',
    photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/73/Stanley_Druckenmiller_2019.jpg',
    shortDescription:
      'Makro ve büyüme temalarını bir arada kullanabilen esnek yaklaşımıyla tanınan hedge fund efsanesi.',
    investmentStyle: 'hedge-fund',
    firm: 'Duquesne Family Office',
    trackedHoldingCount: 5,
    lastUpdated: '2025-12-31',
    source: {
      label: 'SEC 13F / Duquesne Family Office',
      url: 'https://www.sec.gov/edgar/search/',
      updatedAt: '2025-12-31',
      note: 'Pozisyon listesi kamuya açık 13F bildirimlerinden derlenir.'
    },
    aiSummary:
      'Portföy daha esnek; büyüme, yapay zekâ altyapısı ve makro döngüden faydalanabilecek isimler birlikte yer alabiliyor.',
    holdings: [
      { id: 'druck-nvda', assetId: 'midas-us:NVDA', symbol: 'NVDA', name: 'NVIDIA', assetClass: 'stock', sourceNote: 'Ağırlık kamu verisinde sınırlı.' },
      { id: 'druck-amzn', assetId: 'midas-us:AMZN', symbol: 'AMZN', name: 'Amazon', assetClass: 'stock', sourceNote: 'Ağırlık kamu verisinde sınırlı.' },
      { id: 'druck-msft', assetId: 'midas-us:MSFT', symbol: 'MSFT', name: 'Microsoft', assetClass: 'stock', sourceNote: 'Ağırlık kamu verisinde sınırlı.' },
      { id: 'druck-teck', assetId: 'midas-us:TECK', symbol: 'TECK', name: 'Teck Resources', assetClass: 'stock', sourceNote: 'Ağırlık kamu verisinde sınırlı.' },
      { id: 'druck-coupang', assetId: 'midas-us:CPNG', symbol: 'CPNG', name: 'Coupang', assetClass: 'stock', sourceNote: 'Ağırlık kamu verisinde sınırlı.' }
    ]
  },
  {
    id: 'michael-burry',
    name: 'Michael Burry',
    photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/2a/Michael_Burry_2010.jpg',
    shortDescription:
      'Kontraryen bakış açısı ve asimetrik fırsat arayışıyla öne çıkan yatırımcı; yoğun ama değişken portföyler kurabiliyor.',
    investmentStyle: 'value',
    firm: 'Scion Asset Management',
    trackedHoldingCount: 5,
    lastUpdated: '2025-12-31',
    source: {
      label: 'SEC 13F / Scion Asset Management',
      url: 'https://www.sec.gov/edgar/search/',
      updatedAt: '2025-12-31',
      note: 'Portföy görünümü 13F verisi nedeniyle gecikmelidir ve kısa vadeli işlem niyetini göstermeyebilir.'
    },
    aiSummary:
      'Portföy dönemsel olarak sert yön değiştiriyor; fırsat odaklı ve kontraryen seçimler dikkat çekiyor.',
    holdings: [
      { id: 'burry-baba', assetId: 'midas-us:BABA', symbol: 'BABA', name: 'Alibaba', assetClass: 'stock', sourceNote: 'Pozisyon büyüklüğü güncel rapora göre değişebilir.' },
      { id: 'burry-jd', assetId: 'midas-us:JD', symbol: 'JD', name: 'JD.com', assetClass: 'stock', sourceNote: 'Pozisyon büyüklüğü güncel rapora göre değişebilir.' },
      { id: 'burry-googl', assetId: 'midas-us:GOOGL', symbol: 'GOOGL', name: 'Alphabet', assetClass: 'stock', sourceNote: 'Pozisyon büyüklüğü güncel rapora göre değişebilir.' },
      { id: 'burry-cvs', assetId: 'midas-us:CVS', symbol: 'CVS', name: 'CVS Health', assetClass: 'stock', sourceNote: 'Pozisyon büyüklüğü güncel rapora göre değişebilir.' },
      { id: 'burry-brk', assetId: 'midas-us:BRK.B', symbol: 'BRK.B', name: 'Berkshire Hathaway B', assetClass: 'stock', sourceNote: 'Pozisyon büyüklüğü güncel rapora göre değişebilir.' }
    ]
  },
  {
    id: 'david-tepper',
    name: 'David Tepper',
    photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/38/David_Tepper_2019.jpg',
    shortDescription:
      'Makro duyarlılık ile hisse seçimini birleştiren agresif ama disiplinli hedge fund yatırımcısı.',
    investmentStyle: 'hedge-fund',
    firm: 'Appaloosa',
    trackedHoldingCount: 5,
    lastUpdated: '2025-12-31',
    source: {
      label: 'SEC 13F / Appaloosa',
      url: 'https://www.sec.gov/edgar/search/',
      updatedAt: '2025-12-31',
      note: 'Portföy verileri 13F bildirimlerinden geldiği için gecikmeli görünür.'
    },
    aiSummary:
      'Portföy teknoloji ve döngüsel fırsatlar arasında esneyebiliyor. Piyasa rejimi değişimlerine hızlı uyum arayışı var.',
    holdings: [
      { id: 'tepper-amzn', assetId: 'midas-us:AMZN', symbol: 'AMZN', name: 'Amazon', assetClass: 'stock', sourceNote: 'Ağırlık kamu raporuna göre değişebilir.' },
      { id: 'tepper-meta', assetId: 'midas-us:META', symbol: 'META', name: 'Meta Platforms', assetClass: 'stock', sourceNote: 'Ağırlık kamu raporuna göre değişebilir.' },
      { id: 'tepper-nvda', assetId: 'midas-us:NVDA', symbol: 'NVDA', name: 'NVIDIA', assetClass: 'stock', sourceNote: 'Ağırlık kamu raporuna göre değişebilir.' },
      { id: 'tepper-googl', assetId: 'midas-us:GOOGL', symbol: 'GOOGL', name: 'Alphabet', assetClass: 'stock', sourceNote: 'Ağırlık kamu raporuna göre değişebilir.' },
      { id: 'tepper-msft', assetId: 'midas-us:MSFT', symbol: 'MSFT', name: 'Microsoft', assetClass: 'stock', sourceNote: 'Ağırlık kamu raporuna göre değişebilir.' }
    ]
  },
  {
    id: 'bill-gates',
    name: 'Bill Gates Foundation',
    photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Bill_Gates_2018.jpg',
    shortDescription:
      'Kamuya açık vakıf portföyü daha uzun vadeli ve daha seçici bir yapı sunar; kalite ve kalıcı işletmeler öne çıkar.',
    investmentStyle: 'long-term',
    firm: 'Bill & Melinda Gates Foundation Trust',
    trackedHoldingCount: 5,
    lastUpdated: '2025-12-31',
    source: {
      label: 'SEC 13F / Gates Foundation Trust',
      url: 'https://www.gatesfoundation.org/',
      updatedAt: '2025-12-31',
      note: 'Veriler kamuya açık vakıf bildirimlerinden gelir ve gecikmelidir.'
    },
    aiSummary:
      'Portföyde kalite ve dayanıklılık ön planda. Geniş hendekli, nakit üretimi güçlü işletmeler tercih ediliyor.',
    holdings: [
      { id: 'gates-msft', assetId: 'midas-us:MSFT', symbol: 'MSFT', name: 'Microsoft', assetClass: 'stock', sourceNote: 'Tarihsel olarak en bilinen büyük pozisyonlardan biridir.' },
      { id: 'gates-brk', assetId: 'midas-us:BRK.B', symbol: 'BRK.B', name: 'Berkshire Hathaway B', assetClass: 'stock', sourceNote: 'Ağırlık rapora göre değişebilir.' },
      { id: 'gates-wm', assetId: 'midas-us:WM', symbol: 'WM', name: 'Waste Management', assetClass: 'stock', sourceNote: 'Ağırlık rapora göre değişebilir.' },
      { id: 'gates-cni', assetId: 'midas-us:CNI', symbol: 'CNI', name: 'Canadian National Railway', assetClass: 'stock', sourceNote: 'Ağırlık rapora göre değişebilir.' },
      { id: 'gates-cat', assetId: 'midas-us:CAT', symbol: 'CAT', name: 'Caterpillar', assetClass: 'stock', sourceNote: 'Ağırlık rapora göre değişebilir.' }
    ]
  }
]

export const getInvestors = (): InvestorProfile[] => investors

export const getInvestorById = (investorId: string): InvestorProfile | undefined =>
  investors.find((investor) => investor.id === investorId)

const sumKnownWeights = (holdings: InvestorHolding[]): number =>
  holdings.reduce((sum, holding) => sum + (holding.weightPercent ?? 0), 0)

export const buildInvestorCoverageNote = (holdings: InvestorHolding[]): string => {
  const knownWeight = sumKnownWeights(holdings)

  if (!knownWeight) {
    return 'Kaynak listesi pozisyon adlarını veriyor, ancak güvenilir ağırlık dağılımı paylaşmıyor.'
  }

  if (knownWeight < 95) {
    return `Grafik yalnızca en büyük bilinen pozisyonları kapsıyor. Görünebilen toplam ağırlık yaklaşık %${knownWeight.toFixed(1)}.`
  }

  return 'Grafik, kamuya açık en büyük bilinen pozisyonların dağılımını gösteriyor.'
}

export const buildInvestorPerformanceSummary = (
  holdings: InvestorHolding[],
  overviewLookup: Map<string, MarketOverviewItem>
): string[] => {
  const enriched = holdings
    .map((holding) => ({
      holding,
      asset: holding.assetId ? overviewLookup.get(holding.assetId) : undefined
    }))
    .filter((entry) => Boolean(entry.asset))

  if (!enriched.length) {
    return ['Canlı fiyat eşleşmesi alınamadığı için performans özeti şu an üretilemiyor.']
  }

  const sortedByMove = [...enriched].sort(
    (left, right) => (right.asset?.quote.changePercent ?? 0) - (left.asset?.quote.changePercent ?? 0)
  )
  const best = sortedByMove[0]
  const worst = sortedByMove[sortedByMove.length - 1]
  const heaviest = [...holdings]
    .filter((holding) => typeof holding.weightPercent === 'number')
    .sort((left, right) => (right.weightPercent ?? 0) - (left.weightPercent ?? 0))[0]

  const bullets: string[] = []

  if (heaviest?.weightPercent) {
    bullets.push(
      `En büyük bilinen ağırlık ${heaviest.symbol} tarafında ve yaklaşık %${heaviest.weightPercent.toFixed(1)} seviyesinde.`
    )
  }

  if (best?.asset) {
    bullets.push(
      `Canlı akışta en güçlü gün içi hareket ${best.holding.symbol} tarafında ${best.asset.quote.changePercent >= 0 ? '+' : ''}${best.asset.quote.changePercent.toFixed(2)}%.`
    )
  }

  if (worst?.asset) {
    bullets.push(
      `Bugün en zayıf halka ${worst.holding.symbol} ve gün içi değişim ${worst.asset.quote.changePercent >= 0 ? '+' : ''}${worst.asset.quote.changePercent.toFixed(2)}%.`
    )
  }

  return bullets
}

export const formatHoldingCost = (holding: InvestorHolding): string =>
  typeof holding.averageCost === 'number' && holding.averageCostCurrency
    ? formatCurrency(holding.averageCost, holding.averageCostCurrency)
    : 'Bilinmiyor'
