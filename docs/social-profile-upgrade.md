# Sosyal Profil Yukseltmesi

Instagram benzeri sosyal profil, profil yorumlari ve analiz gonderileri icin `supabase/social-schema.sql` dosyasini mevcut Supabase projesinde bir kez daha calistir.

Bu ikinci calistirma guvenlidir:
- mevcut tablolar korunur
- sadece eksik kolonlar eklenir
- yeni `social_posts` ve `profile_comments` tablolari olusturulur

Kisa adim:
1. Supabase projesini ac
2. `SQL Editor` bolumune gir
3. [social-schema.sql](/C:/Users/makina1/Documents/Codex/2026-04-19-uyglama-yapmaya-ba-l-cam-seninle/supabase/social-schema.sql) dosyasinin guncel icerigini yapistir
4. `Run` calistir

Bu adimdan sonra:
- profil ziyaretleri tam feed mantiginda calisir
- profil duvar yorumlari herkes tarafindan gorunur
- analiz / trade / not gonderileri profilde listelenir
