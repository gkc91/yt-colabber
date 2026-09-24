-- 016_demo_any_niche.sql — nişinde test yoksa herhangi bir nişten örnek test (0018).
-- Sorular: boş nişteki kişi örnek testi görüyor mu, başka nişin GERÇEK testi ona sızıyor mu,
-- aynı örneği ikinci kez alıyor mu, kendi nişinde gerçek test varsa o mu önce geliyor.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

-- ---------- arrange ----------
insert into niches (slug, name) values ('fa-own', 'Own Niche'), ('fa-other', 'Other Niche');
insert into auth.users (id, email) values
  ('fa000000-0000-0000-0000-000000000001', 'fa-demo-owner@test.local'),
  ('fa000000-0000-0000-0000-000000000002', 'fa-real-owner@test.local'),
  ('fa000000-0000-0000-0000-000000000003', 'fa-reviewer@test.local');

update profiles set niche_id = (select id from niches where slug='fa-other'), onboarding_done = true
  where id in ('fa000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000002');
update profiles set niche_id = (select id from niches where slug='fa-own'), onboarding_done = true
  where id = 'fa000000-0000-0000-0000-000000000003';

insert into niche_thumbnail_cache (niche_id, video_id, title, thumbnail_url)
select n.id, n.slug||'_decoy_'||g, 'Decoy '||g, 'https://example.test/'||g||'.jpg'
from niches n cross join generate_series(1,5) g where n.slug in ('fa-own', 'fa-other');

select create_demo_submission('fa000000-0000-0000-0000-000000000001', 'fa-other',
  array['A demo in another niche'], array['thumbs/demo/fa.jpg'], 'clips/demo/fa.mp4', 30);

-- Başka nişte açık bir GERÇEK test: boş nişteki kişiye asla gitmemeli.
insert into submissions (id, owner_id, niche_id, title_options, thumbnail_paths, clip_path,
                         clip_duration_seconds, requested_reviews)
values ('fa000000-0000-0000-0000-0000000000aa', 'fa000000-0000-0000-0000-000000000002',
        (select id from niches where slug='fa-other'), array['A real test elsewhere'],
        array['thumbs/real/fa.jpg'], 'clips/real/fa.mp4', 30, 5);

create temp table taken (step text, submission_id uuid, is_demo boolean, decoy_ids text);
grant insert, select on taken to authenticated;

-- ---------- test_empty_niche_gets_a_demo_from_any_niche ----------
set local request.jwt.claims to '{"sub":"fa000000-0000-0000-0000-000000000003","role":"authenticated"}';
set local role authenticated;
insert into taken
select 'first', (x.p->'task'->>'submission_id')::uuid, (x.p->>'is_demo')::boolean,
       x.p->'task'->'decoys'->0->>'video_id'
from (select next_review_task() as p) x;
reset role;

select is((select is_demo from taken where step='first'), true,
  'nişinde test olmayan kişi başka nişten örnek test alır');

select ok((select decoy_ids from taken where step='first') like 'fa-other_decoy_%',
  'örnek testin ızgarası testin kendi nişinden kurulur');

-- ---------- test_real_test_from_other_niche_never_leaks ----------
select isnt((select submission_id from taken where step='first'),
  'fa000000-0000-0000-0000-0000000000aa'::uuid,
  'başka nişin gerçek testi boş nişteki kişiye gitmez');

-- ---------- test_same_demo_is_not_given_twice ----------
update review_tasks set expires_at = now() - interval '1 second'
  where reviewer_id = 'fa000000-0000-0000-0000-000000000003';
set local request.jwt.claims to '{"sub":"fa000000-0000-0000-0000-000000000003","role":"authenticated"}';
set local role authenticated;
insert into taken select 'second', (next_review_task()->'task'->>'submission_id')::uuid, null, null;
reset role;

select is((select submission_id from taken where step='second'), null,
  'aynı örnek test ikinci kez verilmez; başka örnek yoksa ekran boş');

-- ---------- test_real_test_in_own_niche_comes_first ----------
select create_demo_submission('fa000000-0000-0000-0000-000000000001', 'fa-other',
  array['A second demo'], array['thumbs/demo/fb.jpg'], 'clips/demo/fb.mp4', 30);
insert into submissions (id, owner_id, niche_id, title_options, thumbnail_paths, clip_path,
                         clip_duration_seconds, requested_reviews)
values ('fa000000-0000-0000-0000-0000000000bb', 'fa000000-0000-0000-0000-000000000002',
        (select id from niches where slug='fa-own'), array['A real test in your niche'],
        array['thumbs/real/fb.jpg'], 'clips/real/fb.mp4', 30, 5);

set local request.jwt.claims to '{"sub":"fa000000-0000-0000-0000-000000000003","role":"authenticated"}';
set local role authenticated;
insert into taken select 'third', (next_review_task()->'task'->>'submission_id')::uuid, null, null;
reset role;

select is((select submission_id from taken where step='third'),
  'fa000000-0000-0000-0000-0000000000bb'::uuid,
  'kendi nişinde gerçek test varsa örnekten önce o gelir');

select * from finish();
rollback;
