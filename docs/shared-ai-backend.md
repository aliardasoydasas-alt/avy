# AVY Ortak AI Backend

AVY AI artik kullanici bazli API key istemek yerine ortak Supabase Edge Function katmanina gore tasarlandi.

Amac:
- uygulamayi indiren herkesin AI sohbeti direkt kullanabilmesi
- OpenAI anahtarinin istemciye gomulmemesi
- sahibi tarafinda tek seferlik kurulumla tum kullanicilarin hazir deneyim almesi

## Mimari

1. Masaustu uygulamasi Supabase oturumuyla `asset-ai-chat` fonksiyonunu cagirir.
2. Fonksiyon kullanicinin JWT oturumunu dogrular.
3. OpenAI istegi sadece sunucu tarafinda yapilir.
4. Sonuc tekrar uygulamaya doner.

Boylece:
- arkadaslarin API key girmez
- OpenAI key uygulama icinden okunamaz
- tek noktadan model ve reasoning ayari yonetilir

## Tek seferlik owner kurulumu

Asagidaki adimlar sadece proje sahibi icindir:

1. Supabase projesinde `OPENAI_API_KEY` secret ekle.
2. Istersen `OPENAI_MODEL` ve `OPENAI_REASONING_EFFORT` secretlerini de ekle.
3. `supabase/functions/asset-ai-chat/index.ts` fonksiyonunu deploy et.

Ornek secret isimleri:
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_REASONING_EFFORT`

Varsayilanlar:
- model: `gpt-5.2`
- reasoning: `medium`

## Uygulama davranisi

- Kullanici tarafinda AI icin ayar ekrani yoktur.
- Fonksiyon yayinda degilse sohbet paneli durumu Turkce ve acik bir hata ile bildirir.
- Ag veya fonksiyon sorunu varsa yerel yedek AI yorumu gosterilmeye devam eder.
