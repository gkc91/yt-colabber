-- 008_notifications.sql — bildirim kuyruğu kuralları (C2, 0011).
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- ---------- arrange ----------
insert into niches (slug, name) values ('notify-niche', 'Notify test niche');
insert into auth.users (id, email) values
  ('aaaa9999-0000-0000-0000-000000000001', 'n-owner@test.local'),
  ('aaaa9999-0000-0000-0000-000000000002', 'n-idle@test.local'),
  ('aaaa9999-0000-0000-0000-000000000003', 'n-active@test.local'),
  ('aaaa9999-0000-0000-0000-000000000004', 'n-notoken@test.local');
update profiles set niche_id = (select id from niches where slug='notify-niche'), onboarding_done = true
  where id::text like 'aaaa9999-0000-0000-0000-00000000000_';
update profiles set expo_push_token = 'ExponentPushToken[idle]'
  where id = 'aaaa9999-0000-0000-0000-000000000002';
update profiles set expo_push_token = 'ExponentPushToken[active]'
  where id = 'aaaa9999-0000-0000-0000-000000000003';

insert into submissions (id, owner_id, niche_id, title_options, thumbnail_paths, clip_path,
                         clip_duration_seconds, requested_reviews)
values ('bbbb9999-0000-0000-0000-000000000001', 'aaaa9999-0000-0000-0000-000000000001',
        (select id from niches where slug='notify-niche'),
        array['A title'], array['thumbs/n/1.jpg'], 'clips/n/1.mp4', 30, 5);

-- ---------- test_notifications_queue_at_three_reviews ----------
update submissions set received_reviews = 2 where id = 'bbbb9999-0000-0000-0000-000000000001';
select is((select count(*)::int from notifications where kind='reviews_arriving' and profile_id = 'aaaa9999-0000-0000-0000-000000000001'), 0,
  '2 değerlendirmede bildirim yok');

update submissions set received_reviews = 3 where id = 'bbbb9999-0000-0000-0000-000000000001';
select is((select count(*)::int from notifications where kind='reviews_arriving' and profile_id = 'aaaa9999-0000-0000-0000-000000000001'), 1,
  '3. değerlendirmede sahibine bildirim kuyruğa girer');
select is(
  (select payload->>'submission_id' from notifications where kind='reviews_arriving' and profile_id = 'aaaa9999-0000-0000-0000-000000000001'),
  'bbbb9999-0000-0000-0000-000000000001', 'bildirim hangi teste ait olduğunu taşır');

update submissions set received_reviews = 4 where id = 'bbbb9999-0000-0000-0000-000000000001';
select is((select count(*)::int from notifications where kind='reviews_arriving' and profile_id = 'aaaa9999-0000-0000-0000-000000000001'), 1,
  '4. değerlendirmede ikinci kez bildirim gönderilmez');

-- ---------- test_notifications_queue_on_completion ----------
update submissions set status = 'completed' where id = 'bbbb9999-0000-0000-0000-000000000001';
select is((select count(*)::int from notifications where kind='test_completed' and profile_id = 'aaaa9999-0000-0000-0000-000000000001'), 1,
  'test tamamlanınca bildirim kuyruğa girer');
update submissions set status = 'completed' where id = 'bbbb9999-0000-0000-0000-000000000001';
select is((select count(*)::int from notifications where kind='test_completed' and profile_id = 'aaaa9999-0000-0000-0000-000000000001'), 1,
  'tamamlanmış test tekrar bildirim üretmez');

-- ---------- test_notifications_task_reminder_needs_five_open_slots ----------
-- Şu an açık test yok (üstteki completed oldu) → hatırlatma çıkmamalı
do $$ begin perform queue_task_reminders(); end $$;
select is(
  (select count(*)::int from notifications where kind='tasks_waiting'
     and profile_id = 'aaaa9999-0000-0000-0000-000000000002'),
  0, '5 boş slot yoksa hatırlatma gönderilmez');

-- 5 boş slotluk açık bir test ekle
insert into submissions (id, owner_id, niche_id, title_options, thumbnail_paths, clip_path,
                         clip_duration_seconds, requested_reviews)
values ('bbbb9999-0000-0000-0000-000000000002', 'aaaa9999-0000-0000-0000-000000000001',
        (select id from niches where slug='notify-niche'),
        array['B title'], array['thumbs/n/2.jpg'], 'clips/n/2.mp4', 30, 5);

-- aktif kullanıcı: az önce değerlendirme yapmış sayılsın
insert into review_tasks (id, submission_id, reviewer_id, thumbnail_index, title_index, decoys,
                          candidate_position, status)
values ('cccc9999-0000-0000-0000-000000000001', 'bbbb9999-0000-0000-0000-000000000001',
        'aaaa9999-0000-0000-0000-000000000003', 0, 0, '[]'::jsonb, 0, 'done');
insert into reviews (task_id, submission_id, reviewer_id, thumbnail_index, title_index,
                     picked_candidate, picked_position, decision_ms, title_guess,
                     leave_second, watched_seconds, time_spent_seconds)
values ('cccc9999-0000-0000-0000-000000000001', 'bbbb9999-0000-0000-0000-000000000001',
        'aaaa9999-0000-0000-0000-000000000003', 0, 0, true, 0, 1500, 'A guess about the video',
        10, 10, 45);

do $$ begin perform queue_task_reminders(); end $$;
select is(
  (select count(*)::int from notifications where kind='tasks_waiting'
     and profile_id = 'aaaa9999-0000-0000-0000-000000000002'),
  1, 'boştaki kullanıcıya hatırlatma gider');
select is(
  (select count(*)::int from notifications where kind='tasks_waiting'
     and profile_id = 'aaaa9999-0000-0000-0000-000000000003'),
  0, 'son 24 saatte değerlendirme yapan kullanıcıya gitmez');

-- push token'ı olmayan kullanıcı hiç almaz
select is(
  (select count(*)::int from notifications where kind='tasks_waiting'
     and profile_id = 'aaaa9999-0000-0000-0000-000000000004'),
  0, 'push token''ı olmayan kullanıcıya hatırlatma kuyruğa girmez');

-- ---------- test_notifications_reminder_is_capped_daily ----------
do $$ begin perform queue_task_reminders(); end $$;
select is(
  (select count(*)::int from notifications where kind='tasks_waiting'
     and profile_id = 'aaaa9999-0000-0000-0000-000000000002'),
  1, 'aynı gün ikinci hatırlatma gönderilmez');

select * from finish();
rollback;
