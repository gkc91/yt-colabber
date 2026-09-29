-- 027_internal_secret_header.sql — giden başlıkta service_role anahtarı durmasın (0037).
--
-- Elimizdeki tek kontrol bu: `net.http_request_queue` başlıkları saklıyor ve o tablonun
-- izinlerini geri alamıyoruz (hibeleri `supabase_admin` verdi).
--
-- İkinci iddia en az birincisi kadar önemli: 0033 tam da burada battı. Sır `Authorization`'a
-- konunca ağ geçidi (verify_jwt) onu JWT olarak doğrulayıp reddetti ve dört cron 95 dakika
-- durdu. O yüzden `Authorization`'ın GEÇERLİ BİR JWT taşıdığı da sınanıyor.
--
-- `trigger_cleanup_clips` seçildi çünkü ön koşulu yok; dördü de `net_headers()` kullanıyor.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- ---------- arrange ----------
select vault.create_secret('https://proje.test', 'project_url');
select vault.create_secret('SERVICE-ROLE-ANAHTARI-GIZLI', 'service_role_key');

-- ---------- test_a_missing_secret_produces_no_token_at_all ----------
-- Geçiş yedeği 0041'de kaldırıldı. Artık sır yoksa jeton NULL: tetikleyiciler null
-- jetonda erken dönüyor, yani çağrı hiç yapılmıyor. Sessizce service_role'a düşmek
-- 0037'de kapattığımız şeyi geri açardı — ve sessiz geri dönüş, gürültülü arızadan kötü.
-- Vault'ta service_role_key DURUYOR (yukarıda kuruldu): düşmediğini kanıtlayan da bu.
select is(net_gateway_token(), null,
  'anon_key yokken ağ geçidi jetonu yok — eski anahtara DÜŞMEZ');
select is(net_auth_token(), null,
  'net_shared_secret yokken yetki jetonu yok — eski anahtara DÜŞMEZ');

-- ---------- act ----------
-- Anon anahtarı JWT biçiminde: ağ geçidi bunu doğruluyor, bu yüzden biçimi testin konusu.
select vault.create_secret('eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.imza', 'anon_key');
select vault.create_secret('NET-PAYLASILAN-SIR', 'net_shared_secret');

select trigger_cleanup_clips();

-- ---------- test_the_service_role_key_never_leaves_the_database ----------
select is(
  (select count(*)::int from net.http_request_queue
    where url like '%cleanup-media%' and headers::text like '%SERVICE-ROLE-ANAHTARI-GIZLI%'),
  0, 'saklanan başlıkta service_role anahtarı YOK');

-- ---------- test_authorization_still_carries_a_jwt ----------
-- 0033'ün hatası buydu: JWT olmayan bir değer konunca ağ geçidi 401 döndü.
select is(
  (select headers->>'Authorization' from net.http_request_queue
    where url like '%cleanup-media%' limit 1),
  'Bearer eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.imza',
  'Authorization anon anahtarını taşıyor — ağ geçidinin doğrulayabileceği bir JWT');

-- ---------- test_the_real_authority_travels_in_its_own_header ----------
select is(
  (select headers->>'x-internal-secret' from net.http_request_queue
    where url like '%cleanup-media%' limit 1),
  'NET-PAYLASILAN-SIR',
  'gerçek yetki ayrı başlıkta gidiyor');

select is(
  (select headers->>'Content-Type' from net.http_request_queue
    where url like '%cleanup-media%' limit 1),
  'application/json', 'içerik türü korunuyor');

-- ---------- test_the_request_was_actually_queued ----------
select isnt(
  (select count(*)::int from net.http_request_queue where url like '%cleanup-media%'),
  0, 'istek gerçekten kuyruğa girdi');

select * from finish();
rollback;
