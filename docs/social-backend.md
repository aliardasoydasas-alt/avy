# AVY Sosyal Altyapi Kurulumu

Bu kurulum tamamlandiginda AVY'yi indiren arkadaslar ayni sosyal ag uzerinde:

- hesap acabilir
- kullanici adiyla birbirini bulabilir
- arkadas listesine ekleyebilir
- mesajlasabilir
- durtebilir
- herkese acik takip ettigi varliklari ve liste isimlerini gorebilir

## 1. Supabase projesi olustur

1. Tek bir Supabase projesi ac.
2. `SQL Editor` alanina [social-schema.sql](/C:/Users/makina1/Documents/Codex/2026-04-19-uyglama-yapmaya-ba-l-cam-seninle/supabase/social-schema.sql) dosyasinin tamamini yapistir ve calistir.
3. `Authentication > Providers` icinde e-posta ile girisi aktif tut.

## 2. Uygulamaya bagla

Iki yontem var:

1. Derleme oncesi `.env` icine `VITE_SUPABASE_URL` ve `VITE_SUPABASE_PUBLISHABLE_KEY` yaz.
2. Ya da uygulama icindeki `Sosyal` ekraninda ayni bilgileri gir ve kaydet.

## 3. Arkadaslar nasil baglanacak

Arkadaslarin da ayni `Supabase URL` ve `publishable key` ile baglanacak. Supabase eski projelerde buna `anon key` de diyebilir. Bu ikisi paylasilabilir istemci bilgileri oldugu icin masaustu uygulamasinda kullanilabilir.

## 4. Profil senkronu

Profil ekraninda yazdigin:

- kullanici adi
- gorunen ad
- bio
- profil resmi

ve uygulamadaki:

- favori varliklar
- izleme listesi isimleri

sosyal buluta senkronlanir. Boylece arkadaslarin seni arayip profilinde bunlari gorebilir.

## 5. Dikkat

Gercek anlamda cok kullanicili mesajlasma icin tum cihazlarin ayni Supabase projesine baglanmasi gerekir. Farkli projeler kullanan cihazlar birbirini goremez.
