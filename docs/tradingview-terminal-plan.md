# TradingView Benzeri Terminal Planı

## Root Cause Analizi

Mevcut yapıda performansı aşağı çeken ana noktalar:

1. `App.tsx` içinde çok fazla veri türetimi aynı seviyede yapılıyor.
   Varlık listeleri, AI verileri, öne çıkanlar ve chart çevresi aynı render zincirinde birleşiyor.

2. Watchlist tarafı sanallaştırılmamış.
   Sağa taşınacak uzun listeler her fiyat güncellemesinde tam render maliyeti üretiyor.

3. Chart çevresindeki yardımcı paneller ve shell layout’u chart ile birlikte yeniden boyanıyor.

4. Canlı fiyat güncellemeleri doğrudan üst seviye state’leri tetiklediğinde ana grafik dışındaki UI de gereksiz iş alıyor.

5. Eski kabukta sol rail, orta içerik ve sağ analiz alanı terminal hissi yerine dashboard hissi veriyor.

## Değişecek Ana Dosyalar

- `src/renderer/src/App.tsx`
- `src/renderer/src/styles/app.css`
- `src/renderer/src/features/asset/chart-panel.tsx`
- `src/renderer/src/hooks/use-market-data.ts`
- `src/renderer/src/features/ai/ai-dashboard.tsx`
- `src/renderer/src/features/highlights/highlights-dashboard.tsx`
- `src/renderer/src/features/investors/investors-dashboard.tsx`
- `src/renderer/src/features/profile/profile-dashboard.tsx` (korunacak, sadece shell entegrasyonu)

## Yeni Eklenecek Dosyalar

- `src/renderer/src/features/shell/terminal-icon-rail.tsx`
- `src/renderer/src/features/watchlist/market-watchlist-panel.tsx`
- `src/renderer/src/features/asset/terminal-asset-bar.tsx`

## Fazlar

### Faz 1
- Performans omurgası
- Sağ watchlist paneli için virtualized liste
- `home` ve `asset` ekranlarını ortak terminal shell’e toplama
- Sol ikon rail

### Faz 2
- Sağ scroll panel içinde seçili varlık özeti, indikatör ve AI kartları
- Asset header yerine kompakt üst kontrol barı
- Snap davranışını kapatma

### Faz 3
- AI, Öne Çıkanlar ve Yatırımcılar ekranlarını yeni terminal tasarımına uyarlama
- Sağ panel liste sekmeleri ve kullanıcı listeleri polish

### Faz 4
- Chart overlay/render pipeline için daha sert optimizasyon
- Gerekirse canvas tabanlı overlay geçişi
