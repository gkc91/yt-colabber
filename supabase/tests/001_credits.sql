-- 001_credits.sql — kredi ekonomisinin çekirdek kuralları.
-- Seed'e bağlı değil: kendi kullanıcılarını ve decoy'larını açar, sonunda rollback.
-- Transaction içinde now() sabit olduğu için "geçen süre" review_tasks.assigned_at geri alınarak kurulur.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- ---------- arrange: kullanıcılar ----------
-- 01 owner · 02 dürüst reviewer · 03 hızlı reviewer · 04 süresi hakkında yalan söyleyen reviewer
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'owner@test.local',  '{"full_name":"Owner"}'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'honest@test.local', '{"full_name":"Honest"}'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'fast@test.local',   '{"full_name":"Fast"}'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'liar@test.local',   '{"full_name":"Liar"}');
-- Teste özel niş: next_review_task veritabanındaki başka submission'ları seçemesin
-- (testler dış duruma bağlı olmamalı).
insert into niches (slug, name) values ('test-credits', 'Test niche (credits)');
update profiles set niche_id = (select id from niches where slug = 'test-credits'), onboarding_done = true
  where id::text like 'aaaaaaaa-0000-0000-0000-00000000000_';
-- next_review_task 5 decoy ister
insert into niche_thumbnail_cache (niche_id, video_id, title, thumbnail_url)
select (select id from niches where slug = 'test-credits'), 'test_decoy_'||g, 'Decoy '||g, 'https://example.test/'||g||'.jpg'
from generate_series(1,5) g;

-- ---------- test_credits_signup_bonus_is_five ----------
select is(balance_of('aaaaaaaa-0000-0000-0000-000000000001'), 5, 'signup: yeni kullanıcı 5 kredi ile başlar');
select is(
  (select count(*)::int from credit_ledger where profile_id = 'aaaaaaaa-0000-0000-0000-000000000001' and reason = 'signup_bonus' and delta = 5),
  1, 'signup: bonus ledger''da tek satır');

-- ---------- test_create_submission_* ----------
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
set local role authenticated;

select throws_ok(
  $$select create_submission(array['A title that is long'], array['thumbs/x/1.jpg'], 'clips/x/1.mp4', 30, 10)$$,
  'insufficient_credits', 'create_submission: bakiye (5) < istenen (10) → insufficient_credits');

select throws_ok(
  $$select create_submission(array['A title that is long'], array['thumbs/x/1.jpg'], 'clips/x/1.mp4', 30, 25)$$,
  'pro_required', 'create_submission: 25 değerlendirme Pro ister');

select lives_ok(
  $$select create_submission(array['First title option','Second title option'], array['thumbs/x/1.jpg','thumbs/x/2.jpg'], 'clips/x/1.mp4', 30, 5)$$,
  'create_submission: bakiye yeterliyse submission açılır');

select is(balance_of('aaaaaaaa-0000-0000-0000-000000000001'), 0, 'create_submission: maliyet düşülür (5 − 5 = 0)');

select throws_ok(
  $$select create_submission(array['A title that is long'], array['thumbs/x/1.jpg'], 'clips/x/1.mp4', 30, 5)$$,
  'insufficient_credits', 'create_submission: bakiye 0 iken ikinci submission reddedilir');

select throws_ok(
  $$insert into credit_ledger (profile_id, delta, reason) values ('aaaaaaaa-0000-0000-0000-000000000001', 100, 'admin')$$,
  '42501', null, 'ledger: client credit_ledger''a doğrudan yazamaz');

-- ---------- test_submit_review_under_20s_is_rejected_and_penalised ----------
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}';
set local role authenticated;
select isnt((next_review_task()->'task'), 'null'::jsonb, 'next_review_task: reviewer aynı nişte görev alır');
reset role;
update review_tasks set assigned_at = now() - interval '60 seconds' where reviewer_id = 'aaaaaaaa-0000-0000-0000-000000000003';
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}';
set local role authenticated;

select is(
  submit_review((select id from review_tasks where reviewer_id = 'aaaaaaaa-0000-0000-0000-000000000003'),
                true, 0, 1500, 'A guess about the video', null, 15, '{}', null, 19),
  null::uuid, 'submit_review: client 19 sn bildirirse reddedilir (NULL)');
reset role;
select is(balance_of('aaaaaaaa-0000-0000-0000-000000000003'), 5, 'submit_review: reddedilen değerlendirme kredi kazandırmaz');
select is((select reputation from profiles where id = 'aaaaaaaa-0000-0000-0000-000000000003'), 0.80::numeric(4,2),
  'submit_review: hızlı değerlendirme cezası kalıcı (1.00 → 0.80)');
select is((select status::text from review_tasks where reviewer_id = 'aaaaaaaa-0000-0000-0000-000000000003'), 'expired',
  'submit_review: hızlı değerlendirmenin görevi kapanır');
select is((select count(*)::int from reviews where reviewer_id = 'aaaaaaaa-0000-0000-0000-000000000003'), 0,
  'submit_review: hızlı değerlendirme kaydedilmez');

-- ---------- test_submit_review_client_time_is_not_trusted ----------
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-0000-0000-000000000004","role":"authenticated"}';
set local role authenticated;
do $$ begin perform next_review_task(); end $$;
reset role;
update review_tasks set assigned_at = now() - interval '5 seconds' where reviewer_id = 'aaaaaaaa-0000-0000-0000-000000000004';
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-0000-0000-000000000004","role":"authenticated"}';
set local role authenticated;
select is(
  submit_review((select id from review_tasks where reviewer_id = 'aaaaaaaa-0000-0000-0000-000000000004'),
                true, 0, 1500, 'A guess about the video', null, 5, '{}', null, 45),
  null::uuid, 'submit_review: client 45 sn dese de sunucu 5 sn ölçtüyse reddedilir');

-- ---------- test_submit_review_watched_cannot_exceed_elapsed ----------
reset role;
update review_tasks set status = 'assigned', assigned_at = now() - interval '25 seconds'
  where reviewer_id = 'aaaaaaaa-0000-0000-0000-000000000004';
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-0000-0000-000000000004","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  format($$select submit_review(%L, true, 0, 1500, 'A guess about the video', null, 30, '{}', null, 25)$$,
         (select id from review_tasks where reviewer_id = 'aaaaaaaa-0000-0000-0000-000000000004')),
  'invalid_watched_seconds', 'submit_review: 25 sn geçmişken 30 sn izledim denemez');

-- ---------- test_submit_review_over_20s_is_accepted ----------
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}';
set local role authenticated;
do $$ begin perform next_review_task(); end $$;
reset role;
update review_tasks set assigned_at = now() - interval '60 seconds' where reviewer_id = 'aaaaaaaa-0000-0000-0000-000000000002';
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}';
set local role authenticated;
select isnt(
  submit_review((select id from review_tasks where reviewer_id = 'aaaaaaaa-0000-0000-0000-000000000002'),
                true, 0, 1500, 'A guess about the video', null, 30, '{}', null, 45),
  null::uuid, 'submit_review: 20 sn ve üstü değerlendirme kabul edilir');
select is(balance_of('aaaaaaaa-0000-0000-0000-000000000002'), 6, 'submit_review: kabul edilen değerlendirme +1 kredi');
reset role;
select is((select time_spent_seconds from reviews where reviewer_id = 'aaaaaaaa-0000-0000-0000-000000000002'), 45,
  'submit_review: kaydedilen süre min(client, sunucu)');

-- ---------- test_close_stale_submissions_refunds_missing_reviews ----------
update submissions set closes_at = now() - interval '1 minute'
  where owner_id = 'aaaaaaaa-0000-0000-0000-000000000001';
do $$ begin perform close_stale_submissions(); end $$;

select is(
  (select status::text from submissions where owner_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'completed', 'close_stale: süresi dolan submission kapanır');
select is(balance_of('aaaaaaaa-0000-0000-0000-000000000001'), 4,
  'close_stale: gelmeyen değerlendirmeler iade edilir (5 istendi, 1 geldi → +4)');

do $$ begin perform close_stale_submissions(); end $$;
select is(balance_of('aaaaaaaa-0000-0000-0000-000000000001'), 4, 'close_stale: iade ikinci çalıştırmada tekrarlanmaz');

select * from finish();
rollback;
