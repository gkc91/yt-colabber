-- 014_ai_summary.sql — AI özeti hak kontrolü ve kullanım sınırı (0016).
-- Sorular: Pro olmayan alabiliyor mu, az veriyle üretiliyor mu, sınır işliyor mu,
-- başarısız üretim kullanıcının hakkını yakıyor mu, kullanıcı fonksiyonu kendi çağırabilir mi.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- ---------- arrange ----------
insert into niches (slug, name) values ('summary-niche', 'Summary Niche');
insert into auth.users (id, email) values
  ('ffff3333-0000-0000-0000-000000000001', 'summary-owner@test.local'),
  ('ffff3333-0000-0000-0000-000000000002', 'summary-other@test.local');

update profiles set niche_id = (select id from niches where slug='summary-niche'), onboarding_done = true
  where id in ('ffff3333-0000-0000-0000-000000000001', 'ffff3333-0000-0000-0000-000000000002');

insert into submissions (id, owner_id, niche_id, title_options, thumbnail_paths, clip_path,
                         clip_duration_seconds, requested_reviews, received_reviews)
values ('aaaa4444-0000-0000-0000-00000000000a', 'ffff3333-0000-0000-0000-000000000001',
        (select id from niches where slug='summary-niche'), array['A title'],
        array['thumbs/a/1.jpg'], 'clips/a/1.mp4', 30, 15, 12);

-- ---------- test_ai_summary_requires_pro ----------
select is(
  claim_ai_summary('ffff3333-0000-0000-0000-000000000001', 'aaaa4444-0000-0000-0000-00000000000a'),
  'pro_required',
  'Pro olmayan özet alamaz');

-- Pro yap
insert into subscriptions (profile_id, tier, active, expires_at, source, updated_at)
values ('ffff3333-0000-0000-0000-000000000001', 'pro', true, now() + interval '30 days', 'test', now());

-- ---------- test_ai_summary_rejects_other_peoples_tests ----------
select is(
  claim_ai_summary('ffff3333-0000-0000-0000-000000000002', 'aaaa4444-0000-0000-0000-00000000000a'),
  'no_access',
  'başkasının testine özet çıkarılamaz');

-- ---------- test_ai_summary_needs_enough_reviews ----------
update submissions set received_reviews = ai_summary_min_reviews() - 1
  where id = 'aaaa4444-0000-0000-0000-00000000000a';
select is(
  claim_ai_summary('ffff3333-0000-0000-0000-000000000001', 'aaaa4444-0000-0000-0000-00000000000a'),
  'not_enough_reviews',
  'az veriyle özet üretilmez (uydurma desen çıkmasın)');
update submissions set received_reviews = 12 where id = 'aaaa4444-0000-0000-0000-00000000000a';

-- ---------- test_ai_summary_claim_succeeds_once ----------
select is(
  claim_ai_summary('ffff3333-0000-0000-0000-000000000001', 'aaaa4444-0000-0000-0000-00000000000a'),
  'ok',
  'koşullar sağlanınca hak verilir');

select is(
  (select count(*)::int from ai_summary_runs where submission_id = 'aaaa4444-0000-0000-0000-00000000000a'),
  1, 'hak tek satır olarak kaydedilir');

-- ---------- test_ai_summary_second_request_does_not_double_spend ----------
select is(
  claim_ai_summary('ffff3333-0000-0000-0000-000000000001', 'aaaa4444-0000-0000-0000-00000000000a'),
  'in_progress',
  'eşzamanlı ikinci istek ikinci kez model çağırmaz');

-- ---------- test_ai_summary_release_returns_the_slot ----------
do $$ begin perform release_ai_summary_claim('aaaa4444-0000-0000-0000-00000000000a'); end $$;
select is(
  (select count(*)::int from ai_summary_runs where submission_id = 'aaaa4444-0000-0000-0000-00000000000a'),
  0, 'başarısız üretimde ayrılan hak geri verilir');

-- ---------- test_ai_summary_not_regenerated_when_cached ----------
update submissions set ai_summary = 'önceden üretilmiş özet'
  where id = 'aaaa4444-0000-0000-0000-00000000000a';
select is(
  claim_ai_summary('ffff3333-0000-0000-0000-000000000001', 'aaaa4444-0000-0000-0000-00000000000a'),
  'already_generated',
  'özeti olan test için model tekrar çağrılmaz');
update submissions set ai_summary = null where id = 'aaaa4444-0000-0000-0000-00000000000a';

-- ---------- test_ai_summary_monthly_limit_blocks_further_runs ----------
-- Sınırı doldur: sahibe ait N adet başka test ve her birine kullanım kaydı.
insert into submissions (id, owner_id, niche_id, title_options, thumbnail_paths, clip_path,
                         clip_duration_seconds, requested_reviews, received_reviews)
select ('bbbb5555-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid,
       'ffff3333-0000-0000-0000-000000000001',
       (select id from niches where slug='summary-niche'), array['Filler title'],
       array['thumbs/a/1.jpg'], 'clips/a/1.mp4', 30, 15, 12
from generate_series(1, ai_summary_limit()) g;

insert into ai_summary_runs (profile_id, submission_id)
select 'ffff3333-0000-0000-0000-000000000001',
       ('bbbb5555-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid
from generate_series(1, ai_summary_limit()) g;

select is(
  claim_ai_summary('ffff3333-0000-0000-0000-000000000001', 'aaaa4444-0000-0000-0000-00000000000a'),
  'monthly_limit',
  '30 günlük sınır dolunca yeni özet üretilmez');

-- 30 günden eski kullanımlar sayılmaz
update ai_summary_runs set created_at = now() - interval '31 days'
  where profile_id = 'ffff3333-0000-0000-0000-000000000001';
select is(
  claim_ai_summary('ffff3333-0000-0000-0000-000000000001', 'aaaa4444-0000-0000-0000-00000000000a'),
  'ok',
  'sınır 30 günlük kayan pencerede çalışır');

-- ---------- test_ai_summary_status_reports_quota_to_the_owner ----------
set local request.jwt.claims to '{"sub":"ffff3333-0000-0000-0000-000000000001","role":"authenticated"}';
set local role authenticated;
create temp table status_out as select ai_summary_status('aaaa4444-0000-0000-0000-00000000000a') as payload;
reset role;

select is(
  (select (payload->>'limit')::int from status_out),
  ai_summary_limit(),
  'durum sorgusu kullanıcıya sınırı söyler');

-- ---------- test_claim_is_service_role_only ----------
select ok(
  not has_function_privilege('authenticated', 'claim_ai_summary(uuid, uuid)', 'execute'),
  'kullanıcı hak talebini kendisi çağıramaz');

select * from finish();
rollback;
