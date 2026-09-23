-- 004_niches.sql — niş sorguları ve cache yenileme işi (0006).
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

select is(
  (select count(*)::int from niches where is_active and array_length(queries, 1) is null),
  0, 'niches: her aktif nişin arama sorgusu var');

select is(
  (select count(*)::int from niches where is_active and array_length(queries, 1) <> 3),
  0, 'niches: her aktif niş tam 3 sorgu taşır');

select has_function('public', 'trigger_refresh_niche_cache', 'cron yardımcısı tanımlı');

select is(
  (select schedule from cron.job where jobname = 'refresh_niche_cache'),
  '0 4 * * *', 'cron: cache yenileme her gün 04:00''te');

-- Vault sırrı yokken iş patlamamalı (yerelde ve sır girilmeden önce)
select lives_ok(
  $$select trigger_refresh_niche_cache()$$,
  'trigger_refresh_niche_cache: sır yoksa sessizce atlar');

select is(
  (select count(*)::int from net.http_request_queue),
  0, 'trigger_refresh_niche_cache: sır yokken istek göndermez');

-- Sırlar varsa gerçekten istek kuyruğa girmeli (cron yolunun asıl testi)
do $$ begin
  perform vault.create_secret('http://kong:8000', 'project_url');
  perform vault.create_secret('test-service-role-key', 'service_role_key');
end $$;
do $$ begin perform trigger_refresh_niche_cache(); end $$;

select is(
  (select count(*)::int from net.http_request_queue
    where url = 'http://kong:8000/functions/v1/refresh-niche-cache'),
  1, 'trigger_refresh_niche_cache: sırlar varsa Edge Function çağrısı kuyruğa girer');

select * from finish();
rollback;
