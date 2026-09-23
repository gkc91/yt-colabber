-- 010_profile.sql — niş değiştirme ve hesap silmenin veriye etkisi (C4, 0013).
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

-- ---------- arrange ----------
insert into niches (slug, name) values ('profile-a', 'Profile A'), ('profile-b', 'Profile B');
insert into auth.users (id, email) values
  ('beef0001-0000-0000-0000-000000000001', 'p-owner@test.local'),
  ('beef0001-0000-0000-0000-000000000002', 'p-reviewer@test.local');
update profiles set niche_id = (select id from niches where slug='profile-a'), onboarding_done = true
  where id::text like 'beef0001-0000-0000-0000-00000000000_';

insert into submissions (id, owner_id, niche_id, title_options, thumbnail_paths, clip_path,
                         clip_duration_seconds, requested_reviews, received_reviews)
values ('beef0002-0000-0000-0000-000000000001', 'beef0001-0000-0000-0000-000000000001',
        (select id from niches where slug='profile-a'),
        array['A title'], array['thumbs/p/1.jpg'], 'clips/p/1.mp4', 30, 5, 1);

insert into review_tasks (id, submission_id, reviewer_id, thumbnail_index, title_index, decoys, candidate_position)
values ('beef0003-0000-0000-0000-000000000001', 'beef0002-0000-0000-0000-000000000001',
        'beef0001-0000-0000-0000-000000000002', 0, 0, '[]'::jsonb, 0);
insert into reviews (id, task_id, submission_id, reviewer_id, thumbnail_index, title_index,
                     picked_candidate, picked_position, decision_ms, title_guess,
                     leave_second, watched_seconds, time_spent_seconds, comment)
values ('beef0004-0000-0000-0000-000000000001', 'beef0003-0000-0000-0000-000000000001',
        'beef0002-0000-0000-0000-000000000001', 'beef0001-0000-0000-0000-000000000002', 0, 0,
        true, 0, 1500, 'A guess about the video', 12, 12, 45, 'Useful feedback');

-- ---------- test_profile_niche_change ----------
set local request.jwt.claims to '{"sub":"beef0001-0000-0000-0000-000000000002","role":"authenticated"}';
set local role authenticated;

select throws_ok(
  $$select change_niche(999999)$$, 'unknown_niche', 'olmayan niş seçilemez');

select lives_ok(
  $$select change_niche((select id from niches where slug='profile-b'))$$,
  'niş değiştirilebilir');
reset role;

select is(
  (select n.slug from profiles p join niches n on n.id = p.niche_id
    where p.id = 'beef0001-0000-0000-0000-000000000002'),
  'profile-b', 'yeni niş kaydedildi');
select isnt(
  (select niche_changed_at from profiles where id='beef0001-0000-0000-0000-000000000002'),
  null, 'değişim zamanı kaydedildi');

-- ---------- test_profile_niche_change_is_monthly ----------
set local request.jwt.claims to '{"sub":"beef0001-0000-0000-0000-000000000002","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  $$select change_niche((select id from niches where slug='profile-a'))$$,
  'niche_change_too_soon', 'aynı ay içinde ikinci kez değiştirilemez');
reset role;

update profiles set niche_changed_at = now() - interval '31 days'
  where id = 'beef0001-0000-0000-0000-000000000002';
set local request.jwt.claims to '{"sub":"beef0001-0000-0000-0000-000000000002","role":"authenticated"}';
set local role authenticated;
select lives_ok(
  $$select change_niche((select id from niches where slug='profile-a'))$$,
  '30 gün sonra tekrar değiştirilebilir');
reset role;

-- ---------- test_profile_deleting_an_account_keeps_other_peoples_feedback ----------
delete from auth.users where id = 'beef0001-0000-0000-0000-000000000002';

select is(
  (select count(*)::int from profiles where id='beef0001-0000-0000-0000-000000000002'),
  0, 'hesap silindi');
select is(
  (select count(*)::int from reviews where id='beef0004-0000-0000-0000-000000000001'),
  1, 'başkasının testine yazdığı değerlendirme kalır');
select is(
  (select reviewer_id from reviews where id='beef0004-0000-0000-0000-000000000001'),
  null, 'değerlendirmenin kimliği düşer');
select is(
  (select received_reviews from submissions where id='beef0002-0000-0000-0000-000000000001'),
  1, 'test sahibinin sayacı bozulmaz');

select * from finish();
rollback;
