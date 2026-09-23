-- 006_review_scope.sql — ek niş/dil ile görev eşleştirme (0009).
-- Not: görev alma authenticated rolüyle yapılır, doğrulamalar reset role sonrası; değerlendirici
-- submission satırını RLS gereği okuyamaz.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- ---------- arrange: iki niş, iki test sahibi, bir değerlendirici ----------
insert into niches (slug, name) values ('scope-a', 'Scope A'), ('scope-b', 'Scope B');
insert into auth.users (id, email) values
  ('bbbb1111-0000-0000-0000-000000000001', 'scope-owner-a@test.local'),
  ('bbbb1111-0000-0000-0000-000000000002', 'scope-owner-b@test.local'),
  ('bbbb1111-0000-0000-0000-000000000003', 'scope-reviewer@test.local');

update profiles set niche_id = (select id from niches where slug='scope-a'), onboarding_done = true
  where id in ('bbbb1111-0000-0000-0000-000000000001','bbbb1111-0000-0000-0000-000000000003');
update profiles set niche_id = (select id from niches where slug='scope-b'), onboarding_done = true
  where id = 'bbbb1111-0000-0000-0000-000000000002';

insert into niche_thumbnail_cache (niche_id, video_id, title, thumbnail_url)
select n.id, n.slug||'_decoy_'||g, 'Decoy '||g, 'https://example.test/'||g||'.jpg'
from niches n cross join generate_series(1,5) g where n.slug in ('scope-a','scope-b');

insert into submissions (id, owner_id, niche_id, title_options, thumbnail_paths, clip_path,
                         clip_duration_seconds, requested_reviews)
values
  ('cccc2222-0000-0000-0000-00000000000a', 'bbbb1111-0000-0000-0000-000000000001',
   (select id from niches where slug='scope-a'), array['A title'], array['thumbs/a/1.jpg'], 'clips/a/1.mp4', 30, 5),
  ('cccc2222-0000-0000-0000-00000000000b', 'bbbb1111-0000-0000-0000-000000000002',
   (select id from niches where slug='scope-b'), array['B title'], array['thumbs/b/1.jpg'], 'clips/b/1.mp4', 30, 5);
-- Türkçe test: dil eşleşmesi için ayrı bir submission (görev alınan submission bir daha
-- aynı kişiye gösterilmez, bu yüzden B yeniden kullanılamaz).
insert into submissions (id, owner_id, niche_id, language, title_options, thumbnail_paths, clip_path,
                         clip_duration_seconds, requested_reviews)
values ('cccc2222-0000-0000-0000-00000000000c', 'bbbb1111-0000-0000-0000-000000000002',
        (select id from niches where slug='scope-b'), 'tr', array['C title'], array['thumbs/c/1.jpg'],
        'clips/c/1.mp4', 30, 5);

create temp table taken (step text, submission_id uuid);
grant insert, select on taken to authenticated;

-- ---------- test_review_scope_defaults_to_own_niche_only ----------
set local request.jwt.claims to '{"sub":"bbbb1111-0000-0000-0000-000000000003","role":"authenticated"}';
set local role authenticated;
insert into taken select 'default', (next_review_task()->'task'->>'submission_id')::uuid;
reset role;

select is(
  (select s.niche_id from taken t join submissions s on s.id = t.submission_id where t.step='default'),
  (select id from niches where slug='scope-a'),
  'varsayılan: yalnızca kendi nişinden görev gelir');

-- kendi nişindeki görevi tamamla ki ikinci görev alınabilsin
update review_tasks set assigned_at = now() - interval '60 seconds'
  where reviewer_id = 'bbbb1111-0000-0000-0000-000000000003';
set local request.jwt.claims to '{"sub":"bbbb1111-0000-0000-0000-000000000003","role":"authenticated"}';
set local role authenticated;
select isnt(
  submit_review((select id from review_tasks where reviewer_id='bbbb1111-0000-0000-0000-000000000003'),
                true, 0, 1500, 'A guess about the video', null, 30, '{}', null, 45),
  null::uuid, 'kendi nişindeki değerlendirme kaydedilir');

select is(next_review_task()->'task', 'null'::jsonb,
  'ek niş seçilmeden diğer nişin testi görünmez');
reset role;

-- ---------- test_review_scope_extra_niche_brings_tasks ----------
update profiles set also_review_niche_ids = array[(select id from niches where slug='scope-b')]
  where id = 'bbbb1111-0000-0000-0000-000000000003';
set local request.jwt.claims to '{"sub":"bbbb1111-0000-0000-0000-000000000003","role":"authenticated"}';
set local role authenticated;
insert into taken select 'extra-niche', (next_review_task()->'task'->>'submission_id')::uuid;
reset role;

select is(
  (select s.niche_id from taken t join submissions s on s.id = t.submission_id where t.step='extra-niche'),
  (select id from niches where slug='scope-b'),
  'ek niş seçilince o nişten görev gelir');

-- ---------- test_review_scope_language_must_match_too ----------
-- Geriye yalnızca Türkçe submission kaldı; dil listesinde 'tr' yokken görünmemeli.
update review_tasks set status = 'done' where reviewer_id = 'bbbb1111-0000-0000-0000-000000000003';
set local request.jwt.claims to '{"sub":"bbbb1111-0000-0000-0000-000000000003","role":"authenticated"}';
set local role authenticated;
select is(next_review_task()->'task', 'null'::jsonb,
  'dil eşleşmezse ek nişten de görev gelmez');
reset role;

update profiles set also_review_languages = array['tr']
  where id = 'bbbb1111-0000-0000-0000-000000000003';
set local request.jwt.claims to '{"sub":"bbbb1111-0000-0000-0000-000000000003","role":"authenticated"}';
set local role authenticated;
select isnt(next_review_task()->'task', 'null'::jsonb,
  'ek dil seçilince o dildeki test görünür');
reset role;

-- ---------- test_review_scope_own_submission_still_single_niche ----------
select is(
  (select count(distinct niche_id)::int from submissions where owner_id = 'bbbb1111-0000-0000-0000-000000000001'),
  1, 'kendi testi tek nişe gider (create_submission profiles.niche_id kullanır)');

-- ---------- test_review_scope_is_capped ----------
select throws_ok(
  $$update profiles set also_review_niche_ids = array[1,2,3,4] where id = 'bbbb1111-0000-0000-0000-000000000003'$$,
  '23514', null, 'en fazla 3 ek niş seçilebilir');

select * from finish();
rollback;
