-- 011_demo.sql — örnek (demo) testler (0014).
-- Sorular: demo kredi ekonomisine dokunuyor mu, gerçek testin önüne geçiyor mu,
-- dolunca kapanıyor mu, iade üretiyor mu, değerlendirici yine kredi kazanıyor mu.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- ---------- arrange ----------
insert into niches (slug, name) values ('demo-niche', 'Demo Niche');
insert into auth.users (id, email) values
  ('dddd1111-0000-0000-0000-000000000001', 'demo-owner@test.local'),
  ('dddd1111-0000-0000-0000-000000000002', 'demo-real-owner@test.local'),
  ('dddd1111-0000-0000-0000-000000000003', 'demo-reviewer@test.local');

update profiles set niche_id = (select id from niches where slug='demo-niche'), onboarding_done = true
  where id in ('dddd1111-0000-0000-0000-000000000001',
               'dddd1111-0000-0000-0000-000000000002',
               'dddd1111-0000-0000-0000-000000000003');

insert into niche_thumbnail_cache (niche_id, video_id, title, thumbnail_url)
select n.id, 'demo_decoy_'||g, 'Decoy '||g, 'https://example.test/'||g||'.jpg'
from niches n cross join generate_series(1,5) g where n.slug = 'demo-niche';

-- ---------- test_demo_submission_costs_no_credits ----------
select lives_ok(
  $$select create_demo_submission('dddd1111-0000-0000-0000-000000000001', 'demo-niche',
      array['A demo title'], array['thumbs/demo/1.jpg'], 'clips/demo/1.mp4', 30)$$,
  'service_role demo testi açabilir');

select is(
  (select count(*)::int from credit_ledger where profile_id = 'dddd1111-0000-0000-0000-000000000001'
     and reason = 'submission_cost'),
  0,
  'demo test kredi düşmez: ledger''a submission_cost yazılmaz');

select is(
  (select is_demo from submissions where owner_id = 'dddd1111-0000-0000-0000-000000000001'),
  true,
  'demo test is_demo = true');

select ok(
  (select closes_at from submissions where owner_id = 'dddd1111-0000-0000-0000-000000000001')
    > now() + interval '1 year',
  'demo test kapanmaz (closes_at çok ileride)');

-- ---------- test_demo_function_is_service_role_only ----------
select ok(
  not has_function_privilege('authenticated',
    'create_demo_submission(uuid, text, text[], text[], text, int, text)', 'execute'),
  'kullanıcılar demo test açamaz');

-- ---------- test_real_submission_comes_before_demo ----------
insert into submissions (id, owner_id, niche_id, title_options, thumbnail_paths, clip_path,
                         clip_duration_seconds, requested_reviews)
values ('eeee2222-0000-0000-0000-00000000000a', 'dddd1111-0000-0000-0000-000000000002',
        (select id from niches where slug='demo-niche'), array['A real title'],
        array['thumbs/real/1.jpg'], 'clips/real/1.mp4', 30, 5);

create temp table taken (step text, submission_id uuid, is_demo boolean);
grant insert, select on taken to authenticated;

set local request.jwt.claims to '{"sub":"dddd1111-0000-0000-0000-000000000003","role":"authenticated"}';
set local role authenticated;
insert into taken
select 'first', (x.payload->'task'->>'submission_id')::uuid, (x.payload->>'is_demo')::boolean
from (select next_review_task() as payload) x;
reset role;

select is(
  (select submission_id from taken where step='first'),
  'eeee2222-0000-0000-0000-00000000000a'::uuid,
  'gerçek test demo''dan önce gelir');

select is(
  (select is_demo from taken where step='first'),
  false,
  'next_review_task payload''ında is_demo var');

-- ---------- test_reviewer_earns_credit_on_demo ----------
-- gerçek testi tamamla, sıradaki görev demo olsun
update review_tasks set assigned_at = now() - interval '60 seconds'
  where reviewer_id = 'dddd1111-0000-0000-0000-000000000003';
set local request.jwt.claims to '{"sub":"dddd1111-0000-0000-0000-000000000003","role":"authenticated"}';
set local role authenticated;
select isnt(
  submit_review((select id from review_tasks where reviewer_id='dddd1111-0000-0000-0000-000000000003'
                   and status='assigned'),
                true, 0, 1500, 'A guess about the real video', null, 30, '{}', null, 45),
  null, 'gerçek değerlendirme kaydedildi');

insert into taken
select 'second', (next_review_task()->'task'->>'submission_id')::uuid, null;
reset role;

select is(
  (select s.is_demo from taken t join submissions s on s.id = t.submission_id where t.step='second'),
  true,
  'gerçek test bitince demo gösterilir');

update review_tasks set assigned_at = now() - interval '60 seconds'
  where reviewer_id = 'dddd1111-0000-0000-0000-000000000003' and status = 'assigned';
set local request.jwt.claims to '{"sub":"dddd1111-0000-0000-0000-000000000003","role":"authenticated"}';
set local role authenticated;
select isnt(
  submit_review((select id from review_tasks where reviewer_id='dddd1111-0000-0000-0000-000000000003'
                   and status='assigned'),
                true, 0, 1500, 'A guess about the demo video', null, 30, '{}', null, 45),
  null, 'demo değerlendirmesi de kaydedilir ve krediyi kazandırır');
reset role;

select is(
  (select count(*)::int from credit_ledger
     where profile_id = 'dddd1111-0000-0000-0000-000000000003' and reason = 'review_reward'),
  2,
  'demo değerlendirmesi de +1 kredi verir');

select * from finish();
rollback;
