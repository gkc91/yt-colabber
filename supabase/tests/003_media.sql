-- 003_media.sql — medya erişim kuralları (0004).
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- ---------- arrange ----------
-- 01 owner · 02 atanmış değerlendirici · 03 görevi olmayan kullanıcı
insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000001', 'm-owner@test.local'),
  ('cccccccc-0000-0000-0000-000000000002', 'm-reviewer@test.local'),
  ('cccccccc-0000-0000-0000-000000000003', 'm-stranger@test.local');
insert into niches (slug, name) values ('test-media', 'Test niche (media)');
update profiles set niche_id = (select id from niches where slug = 'test-media'), onboarding_done = true
  where id::text like 'cccccccc-0000-0000-0000-00000000000_';

insert into submissions (id, owner_id, niche_id, title_options, thumbnail_paths, clip_path,
                         clip_duration_seconds, requested_reviews)
values ('dddddddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
        (select id from niches where slug = 'test-media'),
        array['Title A','Title B','Title C'],
        array['thumbs/owner/a.jpg','thumbs/owner/b.jpg','thumbs/owner/c.jpg'],
        'clips/owner/clip.mp4', 30, 5);

-- ikinci thumbnail (index 1) atanmış bir görev
insert into review_tasks (id, submission_id, reviewer_id, thumbnail_index, title_index, decoys, candidate_position)
values ('eeeeeeee-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001',
        'cccccccc-0000-0000-0000-000000000002', 1, 0, '[]'::jsonb, 3);

-- ---------- test_media_paths_bucket_limits ----------
select is((select file_size_limit from storage.buckets where id = 'media'), 8388608::bigint,
  'media kovası 8 MB ile sınırlı');
select ok((select allowed_mime_types from storage.buckets where id = 'media') @> array['video/mp4','image/jpeg'],
  'media kovası yalnızca resim/video türlerine izin verir');
select is((select public from storage.buckets where id = 'media'), false, 'media kovası public değil');

-- ---------- test_media_paths_reviewer_sees_only_assigned_thumbnail ----------
set local request.jwt.claims to '{"sub":"cccccccc-0000-0000-0000-000000000002","role":"authenticated"}';
set local role authenticated;

select is(media_paths('eeeeeeee-0000-0000-0000-000000000001')->>'role', 'reviewer',
  'media_paths: görev sahibi reviewer olarak yanıt alır');
select is(media_paths('eeeeeeee-0000-0000-0000-000000000001')->'thumbnails', '["thumbs/owner/b.jpg"]'::jsonb,
  'media_paths: reviewer YALNIZCA kendisine atanan thumbnail''i görür');
select is(media_paths('eeeeeeee-0000-0000-0000-000000000001')->>'clip', 'clips/owner/clip.mp4',
  'media_paths: reviewer klibi görür');

-- başkasının submission'ını sahibi gibi isteyemez
select throws_ok(
  $$select media_paths(null, 'dddddddd-0000-0000-0000-000000000001')$$,
  'no_access', 'media_paths: reviewer submission sahibi gibi tüm dosyaları isteyemez');

-- ---------- test_media_paths_stranger_is_denied ----------
reset role;
set local request.jwt.claims to '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  $$select media_paths('eeeeeeee-0000-0000-0000-000000000001')$$,
  'no_access', 'media_paths: görevi olmayan kullanıcı erişemez');

-- ---------- test_media_paths_expired_task_is_denied ----------
reset role;
update review_tasks set expires_at = now() - interval '1 minute'
  where id = 'eeeeeeee-0000-0000-0000-000000000001';
set local request.jwt.claims to '{"sub":"cccccccc-0000-0000-0000-000000000002","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  $$select media_paths('eeeeeeee-0000-0000-0000-000000000001')$$,
  'task_expired', 'media_paths: süresi dolmuş görev erişemez');

-- ---------- test_media_paths_owner_sees_every_thumbnail ----------
reset role;
set local request.jwt.claims to '{"sub":"cccccccc-0000-0000-0000-000000000001","role":"authenticated"}';
set local role authenticated;
select is(
  media_paths(null, 'dddddddd-0000-0000-0000-000000000001')->'thumbnails',
  '["thumbs/owner/a.jpg","thumbs/owner/b.jpg","thumbs/owner/c.jpg"]'::jsonb,
  'media_paths: submission sahibi tüm thumbnail''ları görür');

select throws_ok(
  $$select media_paths()$$,
  'invalid_arguments', 'media_paths: argümansız çağrı reddedilir');

select * from finish();
rollback;
