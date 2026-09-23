-- 012_niche_refresh.sql — niş cache yenilemesinin fan-out listesi (0015).
-- Regresyon: staging'de tek istek 14 nişi gezmeye çalışıp yarıda kalıyordu; artık
-- veritabanı niş başına bir istek atıyor. Buradaki test, o listenin doğru kurulduğunu
-- doğrular (http_post'un kendisi pgTAP'te test edilemez).
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

-- ---------- arrange ----------
insert into niches (slug, name, is_active, queries) values
  ('refresh-active', 'Refresh Active', true, array['a query','b query','c query']),
  ('refresh-empty', 'Refresh Empty', true, '{}'),
  ('refresh-inactive', 'Refresh Inactive', false, array['a query']);

-- ---------- test_niches_to_refresh_includes_active_with_queries ----------
select ok(
  'refresh-active' in (select slug from niches_to_refresh()),
  'sorgusu olan aktif niş listede');

-- ---------- test_niches_to_refresh_skips_niche_without_queries ----------
select ok(
  'refresh-empty' not in (select slug from niches_to_refresh()),
  'sorgusu olmayan niş atlanır (boşuna kota harcamayalım)');

-- ---------- test_niches_to_refresh_skips_inactive ----------
select ok(
  'refresh-inactive' not in (select slug from niches_to_refresh()),
  'pasif niş atlanır');

-- ---------- test_niche_refresh_is_service_role_only ----------
select ok(
  not has_function_privilege('authenticated', 'trigger_refresh_niche_cache()', 'execute'),
  'yenilemeyi kullanıcı tetikleyemez');

select * from finish();
rollback;
