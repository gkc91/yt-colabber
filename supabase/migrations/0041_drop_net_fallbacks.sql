-- 0041 — pg_net yetkilendirmesindeki geçiş yedeklerini kaldır (TASKS S1b).
--
-- 0037 iki jetonu da `coalesce(<yeni sır>, service_role_key)` olarak yazmıştı. Amaç
-- yayın sırasını önemsiz kılmaktı: sırlar Vault'a konmadan migration yayınlansa bile
-- cron işleri çalışmaya devam etsin. O dönem bitti — `anon_key` ve `net_shared_secret`
-- ikisi de yerinde ve 2026-09-29'da canlıda doğrulandı (giden başlıkta service_role yok,
-- `Authorization` anon JWT taşıyor, yetki `x-internal-secret`'te).
--
-- Yedek artık koruma değil, risk: bir gün `net_shared_secret` silinirse ya da Vault'tan
-- okunamazsa sistem sessizce service_role anahtarına düşer ve 0037'de kapattığımız şeyi
-- geri açar. Sessiz geri dönüş, gürültülü arızadan kötüdür — jeton yoksa çağrı hiç
-- yapılmasın, tetikleyiciler zaten null jetonda erken dönüyor.
--
-- DOĞRULAMANIN SINIRI, dürüstlük payı: dört cron işinden üçü yeni başlıklarla çalışırken
-- görüldü (refresh-niche-cache 1136 satır tazeledi, screen-media gerçek bir yüklemeyi
-- taradı, cleanup-media elle tetiklenip 200 döndü). `notify` bekleyen bildirim olmadığı
-- için hiç çalışmadı. Yine de kaldırılıyor: dördü de AYNI `net_headers()` fonksiyonunu ve
-- aynı `isInternalCall` kodunu paylaşıyor, fonksiyona özel bir yetki yolu yok.

create or replace function net_gateway_token() returns text
language sql stable security definer set search_path = public as $fn$
  select decrypted_secret from vault.decrypted_secrets where name = 'anon_key';
$fn$;

revoke execute on function net_gateway_token from public, anon, authenticated;

create or replace function net_auth_token() returns text
language sql stable security definer set search_path = public as $fn$
  select decrypted_secret from vault.decrypted_secrets where name = 'net_shared_secret';
$fn$;

revoke execute on function net_auth_token from public, anon, authenticated;
