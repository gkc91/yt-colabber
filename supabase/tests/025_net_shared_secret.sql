-- 025_net_shared_secret.sql — pg_net kuyruğunda service_role anahtarı durmasın (0033).
--
-- Neden bu test var: `net.http_request_queue` giden isteğin başlıklarını saklıyor ve o
-- tabloya pg_net kurulumu PUBLIC'e yetki veriyor. Anahtarı oraya koymamak bizim elimizdeki
-- tek kontrol; izinleri geri alamıyoruz (hibeleri supabase_admin verdi).
--
-- `trigger_cleanup_clips` seçildi çünkü ön koşulu yok: sırlar yerindeyse her zaman istek
-- gönderiyor. Diğer üç tetikleyici aynı `net_auth_token()` yolunu kullanıyor.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

-- ---------- arrange ----------
select vault.create_secret('https://proje.test', 'project_url');
select vault.create_secret('SERVICE-ROLE-ANAHTARI-GIZLI', 'service_role_key');

-- ---------- test_net_auth_token_falls_back_while_the_secret_is_missing ----------
-- Geçiş dönemi: ayrı sır daha yerleştirilmemişken ürün çalışmaya devam etmeli, yoksa
-- migration'ı yayınlamak beş cron işini birden susturur.
select is(net_auth_token(), 'SERVICE-ROLE-ANAHTARI-GIZLI',
  'ayrı sır yokken eski anahtara düşer');

-- ---------- test_net_auth_token_prefers_the_dedicated_secret ----------
select vault.create_secret('NET-PAYLASILAN-SIR', 'net_shared_secret');
select is(net_auth_token(), 'NET-PAYLASILAN-SIR',
  'ayrı sır varsa service_role yerine o kullanılır');

-- ---------- test_the_outgoing_header_does_not_carry_the_service_role_key ----------
select trigger_cleanup_clips();

select isnt(
  (select count(*)::int from net.http_request_queue where url like '%cleanup-media%'),
  0, 'istek gerçekten kuyruğa girdi');

select is(
  (select count(*)::int from net.http_request_queue
    where url like '%cleanup-media%' and headers::text like '%SERVICE-ROLE-ANAHTARI-GIZLI%'),
  0, 'saklanan başlıkta service_role anahtarı YOK');

select isnt(
  (select count(*)::int from net.http_request_queue
    where url like '%cleanup-media%' and headers::text like '%NET-PAYLASILAN-SIR%'),
  0, 'saklanan başlıkta ayrı sır var — çağrı hâlâ yetkilendiriliyor');

select * from finish();
rollback;
