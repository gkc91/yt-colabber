-- 005_review.sql — değerlendirme ekranının veri kuralları (0007).
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- ---------- arrange ----------
insert into auth.users (id, email) values
  ('ffffffff-0000-0000-0000-000000000001', 'r-owner@test.local'),
  ('ffffffff-0000-0000-0000-000000000002', 'r-reviewer@test.local'),
  ('ffffffff-0000-0000-0000-000000000003', 'r-stranger@test.local');
insert into niches (slug, name) values ('test-review', 'Test niche (review)');
update profiles set niche_id = (select id from niches where slug = 'test-review'), onboarding_done = true
  where id::text like 'ffffffff-0000-0000-0000-00000000000_';
insert into channels (profile_id, youtube_url, channel_title)
values ('ffffffff-0000-0000-0000-000000000001', 'https://www.youtube.com/@owner-channel', 'Owner Channel');
-- feed ızgarası 5 decoy ister
insert into niche_thumbnail_cache (niche_id, video_id, title, thumbnail_url, channel_title)
select (select id from niches where slug = 'test-review'), 'review_decoy_'||g, 'Decoy '||g,
       'https://example.test/'||g||'.jpg', 'Decoy channel '||g
from generate_series(1,5) g;

insert into submissions (id, owner_id, niche_id, title_options, thumbnail_paths, clip_path,
                         clip_duration_seconds, requested_reviews)
values ('aaaa1111-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000001',
        (select id from niches where slug = 'test-review'),
        array['Only title option'], array['thumbs/o/a.jpg'], 'clips/o/clip.mp4', 42, 5);

-- ---------- test_review_task_carries_title_and_duration ----------
set local request.jwt.claims to '{"sub":"ffffffff-0000-0000-0000-000000000002","role":"authenticated"}';
set local role authenticated;

select is(next_review_task()->>'title', 'Only title option',
  'next_review_task: değerlendiriciye atanan başlık metni döner (submission''ı okuyamaz)');
select is((next_review_task()->>'clip_duration_seconds')::int, 42,
  'next_review_task: klip süresi döner');
select is(jsonb_array_length(next_review_task()->'task'->'decoys'), 5,
  'next_review_task: 5 decoy döner');
select ok((next_review_task()->'task'->>'candidate_position')::int between 0 and 5,
  'next_review_task: aday pozisyonu 0-5 arası');

-- ---------- test_reviewed_channel_requires_a_submitted_review ----------
select throws_ok(
  $$select reviewed_channel('aaaa1111-0000-0000-0000-000000000001')$$,
  'no_access', 'reviewed_channel: değerlendirme göndermeden kanal görünmez');

-- değerlendirmeyi gönder (görev 60 sn önce açılmış gibi)
reset role;
update review_tasks set assigned_at = now() - interval '60 seconds'
  where reviewer_id = 'ffffffff-0000-0000-0000-000000000002';
set local request.jwt.claims to '{"sub":"ffffffff-0000-0000-0000-000000000002","role":"authenticated"}';
set local role authenticated;
select isnt(
  submit_review((select id from review_tasks where reviewer_id = 'ffffffff-0000-0000-0000-000000000002'),
                true, 2, 1800, 'I think this video is about testing', 12, 12,
                array['slow_intro'], 'Nice pacing', 40),
  null::uuid, 'submit_review: değerlendirme kabul edilir');

select is(reviewed_channel('aaaa1111-0000-0000-0000-000000000001')->>'youtube_url',
  'https://www.youtube.com/@owner-channel',
  'reviewed_channel: gönderimden sonra kanal bağlantısı döner');

-- ---------- test_reviewed_channel_is_not_open_to_others ----------
reset role;
set local request.jwt.claims to '{"sub":"ffffffff-0000-0000-0000-000000000003","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  $$select reviewed_channel('aaaa1111-0000-0000-0000-000000000001')$$,
  'no_access', 'reviewed_channel: değerlendirmeyen kullanıcı kanalı göremez');

-- ---------- test_review_counts_on_the_submission ----------
reset role;
select is(
  (select received_reviews from submissions where id = 'aaaa1111-0000-0000-0000-000000000001'),
  1, 'submissions: gelen değerlendirme sayacı artar');

select * from finish();
rollback;
