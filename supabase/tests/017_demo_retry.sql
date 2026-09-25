-- 017_demo_retry.sql — süresi dolan örnek test geri gelir, biten gelmez (0019).
-- Sorular: yarım kalan örnek yeniden verilir mi, tamamlanan bir daha gelir mi (kredi
-- çiftlenmesin), gerçek testte yarım kalan görev yine kapalı mı (ölçüm bozulmasın).
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

-- ---------- arrange ----------
insert into niches (slug, name) values ('dr-niche', 'Retry Niche');
insert into auth.users (id, email) values
  ('d5000000-0000-0000-0000-000000000001', 'dr-demo-owner@test.local'),
  ('d5000000-0000-0000-0000-000000000002', 'dr-real-owner@test.local'),
  ('d5000000-0000-0000-0000-000000000003', 'dr-reviewer@test.local');
update profiles set niche_id = (select id from niches where slug='dr-niche'), onboarding_done = true
  where id in ('d5000000-0000-0000-0000-000000000001',
               'd5000000-0000-0000-0000-000000000002',
               'd5000000-0000-0000-0000-000000000003');

insert into niche_thumbnail_cache (niche_id, video_id, title, thumbnail_url)
select n.id, 'dr_decoy_'||g, 'Decoy '||g, 'https://example.test/'||g||'.jpg'
from niches n cross join generate_series(1,5) g where n.slug = 'dr-niche';

select create_demo_submission('d5000000-0000-0000-0000-000000000001', 'dr-niche',
  array['A demo to retry'], array['thumbs/demo/dr.jpg'], 'clips/demo/dr.mp4', 30);

create temp table taken (step text, submission_id uuid);
grant insert, select on taken to authenticated;

-- ---------- test_expired_demo_task_can_be_taken_again ----------
set local request.jwt.claims to '{"sub":"d5000000-0000-0000-0000-000000000003","role":"authenticated"}';
set local role authenticated;
insert into taken select 'first', (next_review_task()->'task'->>'submission_id')::uuid;
reset role;

-- medya yüklenmedi, kullanıcı bitiremedi: görev süresi doldu
update review_tasks set expires_at = now() - interval '1 second'
  where reviewer_id = 'd5000000-0000-0000-0000-000000000003';

set local request.jwt.claims to '{"sub":"d5000000-0000-0000-0000-000000000003","role":"authenticated"}';
set local role authenticated;
insert into taken select 'second', (next_review_task()->'task'->>'submission_id')::uuid;
reset role;

select isnt((select submission_id from taken where step='second'), null,
  'süresi dolan örnek test yeniden verilir');
select is(
  (select submission_id from taken where step='second'),
  (select submission_id from taken where step='first'),
  'yeniden verilen aynı örnek testtir');

-- ---------- test_completed_demo_is_not_given_again ----------
update review_tasks set assigned_at = now() - interval '60 seconds'
  where reviewer_id = 'd5000000-0000-0000-0000-000000000003' and status = 'assigned';
set local request.jwt.claims to '{"sub":"d5000000-0000-0000-0000-000000000003","role":"authenticated"}';
set local role authenticated;
select isnt(
  submit_review((select id from review_tasks where reviewer_id='d5000000-0000-0000-0000-000000000003'
                   and status='assigned'),
                true, 0, 1500, 'A guess about the demo clip', null, 30, '{}', null, 45),
  null, 'örnek test değerlendirmesi kaydedildi');
insert into taken select 'third', (next_review_task()->'task'->>'submission_id')::uuid;
reset role;

select is((select submission_id from taken where step='third'), null,
  'tamamlanan örnek test bir daha gelmez: kredi çiftlenemez');

-- ---------- test_expired_real_task_stays_closed ----------
insert into submissions (id, owner_id, niche_id, title_options, thumbnail_paths, clip_path,
                         clip_duration_seconds, requested_reviews)
values ('d5000000-0000-0000-0000-0000000000aa', 'd5000000-0000-0000-0000-000000000002',
        (select id from niches where slug='dr-niche'), array['A real test'],
        array['thumbs/real/dr.jpg'], 'clips/real/dr.mp4', 30, 5);

set local request.jwt.claims to '{"sub":"d5000000-0000-0000-0000-000000000003","role":"authenticated"}';
set local role authenticated;
insert into taken select 'fourth', (next_review_task()->'task'->>'submission_id')::uuid;
reset role;

update review_tasks set expires_at = now() - interval '1 second'
  where reviewer_id = 'd5000000-0000-0000-0000-000000000003' and status = 'assigned';

set local request.jwt.claims to '{"sub":"d5000000-0000-0000-0000-000000000003","role":"authenticated"}';
set local role authenticated;
insert into taken select 'fifth', (next_review_task()->'task'->>'submission_id')::uuid;
reset role;

select is((select submission_id from taken where step='fifth'), null,
  'gerçek testte süresi dolan görev geri gelmez: ızgarayı ikinci kez görmek ölçümü bozar');

select * from finish();
rollback;
