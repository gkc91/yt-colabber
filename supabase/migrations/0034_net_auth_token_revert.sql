-- 0034 — 0033'ün yetki jetonu değişikliğini geri al. Depo canlıyla aynı hizaya gelsin.
--
-- NE OLDU (2026-09-28, canlı): 0033 `net_auth_token()`'ı ayrı bir `net_shared_secret`
-- döndürecek şekilde değiştirdi. Yayınlandıktan sonra dört cron işi de 401 almaya başladı
-- ve 09:19 ile 10:54 arasında çalışmadı — bildirimler gitmedi, yeni yüklemeler taranmadı.
--
-- NEDEN: bu dört Edge Function `verify_jwt = true` ile çalışıyor. O açıkken Supabase ağ
-- geçidi `Authorization` başlığındaki değeri JWT OLARAK DOĞRULUYOR ve fonksiyonun kodu hiç
-- çalışmadan reddediyor. Eski service_role anahtarı imzalı bir JWT olduğu için bu hiç fark
-- edilmemişti; `token_urlsafe` ile üretilen paylaşılan sır JWT değil.
--
-- 0033'e koyduğum "iki taraf da eski anahtarı kabul eder" yedeği bu yüzden işe yaramadı:
-- yedek bizim kodumuzdaydı, o kod hiç çalışmıyordu. Ders, yedeğin nerede durduğu:
-- kendi katmanının ALTINDA bir katman varsa yedek orada değil, orada da olmalı.
--
-- Jeton yeniden eski anahtar. Bu, 0033 öncesi duruma dönüş: anahtar tekrar
-- `net.http_request_queue.headers` içinde duruyor. Bugün okunabilir değil (Supabase `net`'i
-- Data API'den açmıyor, `anon`/`authenticated` NOLOGIN), yani acil bir açık değil —
-- kapatılmamış bir borç. `net_shared_secret` hem Vault'ta hem fonksiyon ortamında duruyor,
-- doğru çözüm yazıldığında hazır. Nasıl yazılacağı `docs/TASKS.md` S1'de.

create or replace function net_auth_token() returns text
language sql stable security definer set search_path = public as $fn$
  select (select decrypted_secret from vault.decrypted_secrets
           where name = 'service_role_key');
$fn$;

revoke execute on function net_auth_token from public, anon, authenticated;
