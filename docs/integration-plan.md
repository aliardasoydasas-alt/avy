# AVY Çoklu Cihaz Senkronu ve Akıllı Portföy Genişletme Planı

Bu belge mevcut Electron + React + TypeScript yapısını bozmadan, hesabına bağlı veri senkronizasyonu ve yeni portföy/AI ekranlarını aşamalı şekilde entegre etmek için hazırlandı.

## Ürün Kararları

- Yeni proje kurulmayacak; mevcut mimari genişletilecek.
- Tüm kişisel veriler kullanıcı hesabına bağlı saklanacak.
- Local storage yalnızca cache ve hızlı açılış için kullanılacak.
- Asıl veri Supabase tarafındaki kullanıcıya ait bulut kayıtlarında tutulacak.
- AI metinleri yüzeysel değil, gerçek portföy ve piyasa verisine bağlı olacak.
- UI sade, modern ve premium hissini koruyacak.

## Mevcut Mimariye Uyum

Korunacak ana katmanlar:

- `App.tsx`: ekran bileşimi ve ana veri akışı
- `features/*`: ekran ve panel bileşenleri
- `hooks/*`: veri akışı, sosyal oturum ve piyasa sorguları
- `services/*`: analiz, portföy, AI ve backend erişimi
- `store/*`: local cache ve UI state
- `shared/types/*`: tip güvenliği

Yeni geliştirme bu yapının üstüne kurulacak. Yeni veri omurgası local store'ları kaldırmayacak; onları bulut state ile çift yönlü senkronize edecek.

## Fazlar

### Faz 1: Hesap bazlı veri senkronizasyonu

Hedef:

- Aynı hesapla farklı cihazdan giriş yapıldığında verilerin otomatik gelmesi

Buluta taşınacak alanlar:

- `Varlıklarım`
- portföy geçmişi
- izleme listeleri
- alarmlar
- grafik çizimleri
- AI sohbet geçmişi
- ayarlar
- bildirim tercihleri
- sosyal vitrin ayarları
- trade journal
- AI bildirim geçmişi

Teknik yapı:

- `public.user_app_state` tablosu
- `use-cloud-account-sync.ts` hook'u
- store hydration aksiyonları
- realtime subscription ile cihazlar arası güncel kalma
- `loading / saving / synced / offline / error` durum modeli

Etkilenecek dosyalar:

- `supabase/social-schema.sql`
- `src/shared/types/cloud-sync.ts`
- `src/renderer/src/hooks/use-cloud-account-sync.ts`
- `src/renderer/src/services/social-backend.ts`
- `src/renderer/src/store/use-portfolio-store.ts`
- `src/renderer/src/store/use-terminal-store.ts`
- `src/renderer/src/store/use-settings-store.ts`
- `src/renderer/src/store/use-asset-chat-store.ts`
- `src/renderer/src/store/use-social-profile-store.ts`
- `src/renderer/src/store/use-ai-hub-store.ts`
- `src/renderer/src/App.tsx`

Test:

1. PC1'de varlık ekle.
2. Aynı hesapla PC2'de giriş yap.
3. `Varlıklarım`, çizimler, watchlist ve alarmlar otomatik gelmeli.
4. İnternet kapalıyken `Çevrimdışı` durumu görünmeli.
5. İnternet geri geldiğinde `Hazır` durumuna dönmeli.

### Faz 2: AI portföy yorumu görsel geliştirmesi

Hedef:

- AI portföy yorumunu daha güçlü ve görsel hale getirmek

İçerik:

- pasta / donut dağılım grafiği
- hover ile varlık adı, payı, TL değeri ve günlük değişim
- teknik yoğunluk yorumu
- kripto / hisse oranı vurgusu
- fazla yoğunlaşan varlıkların belirgin gösterimi

Etkilenecek dosyalar:

- `src/renderer/src/features/ai/ai-portfolio-panel.tsx`
- `src/renderer/src/features/profile/portfolio-allocation-chart.tsx`
- `src/renderer/src/services/ai-hub-service.ts`
- `src/renderer/src/styles/app.css`

Test:

1. AI sekmesine gir.
2. Portföy dağılım grafiğinde hover çalışmalı.
3. Varlık adı, yüzde payı, TL karşılığı ve günlük değişim görünmeli.
4. AI yorumu portföy dağılımına göre değişmeli.

### Faz 3: Günlük boğa / ayı durum kartı

Hedef:

- Portföy ekranına günlük yön hissi veren şık bir durum kartı eklemek

İçerik:

- pozitif günde boğa ikonu
- negatif günde ayı ikonu
- günlük yüzde ve kısa metin

Test:

1. Günlük değişim pozitifken boğa görünmeli.
2. Negatif veride ayı görünmeli.
3. Metin günlük yüzdeyle uyumlu olmalı.

### Faz 4: 4 saatlik AI önizleme

Hedef:

- Sadece 4 saatlik grafikte görünen `Önizleme` butonu
- son 6 mum için AI destekli geçici senaryo üretimi

İçerik:

- geçici preview candle katmanı
- 5 saniye sonra otomatik geri dönüş
- yükleniyor ve hata durumu
- kısa AI açıklaması

Etkilenecek dosyalar:

- `src/renderer/src/features/asset/chart-panel.tsx`
- `src/renderer/src/services/asset-ai-chat-service.ts`
- `src/shared/types/chart.ts`

Test:

1. 4 saatlik grafikte buton görünmeli.
2. Diğer timeframe'lerde görünmemeli.
3. Butona basınca 6 preview mum gelmeli.
4. 5 saniye sonra temizlenmeli.

### Faz 5: Grafik türü seçimleri

Hedef:

- Ana grafik alanına alternatif görünüm modları eklemek

Modlar:

- Main
- Hacim
- Momentum
- Volatilite
- RSI
- MACD

Kurallar:

- çizim araçları yalnızca `Main` modda aktif kalacak
- diğer modlar hızlı geçişle görüntülenecek

### Faz 6: Yatırımcılar sayfası

Hedef:

- Güvenilir kaynağa dayanan yatırımcı inceleme ekranı

İçerik:

- yatırımcı listesi
- yatırımcı detay sayfası
- portföy dağılımı
- pozisyon tablosu
- veri kaynağı ve son güncelleme tarihi
- bilinmeyen alanlarda `veri yok`
- AI profil analizi

Beklenen veri yaklaşımı:

- kamuya açık ve gecikmeli kaynaklar
- maliyet bilgisi yoksa uydurulmayacak

## Teknik Notlar

- Store'lar local cache olarak yaşamaya devam edecek.
- Bulut kayıtları hydrate edildikten sonra local state güncellenecek.
- Realtime subscription'lar her `useEffect` içinde cleanup ile kapanacak.
- Ağ kesintisi ve timeout durumları açık mesajlarla gösterilecek.
- Çok büyük state yazımları debounce ile yapılacak.

## Bu Turun Hedefi

Bu geliştirme turunda öncelik:

1. Faz 1'i çalışan hale getirmek
2. Faz 2'yi kullanıcıya görünür şekilde başlatmak
3. Faz 3'ü portföy ekranına eklemek

Sonraki turda mantıklı devam sırası:

1. Faz 4
2. Faz 5
3. Faz 6
