-- 029_daily_review_limit.sql — kişi başı günlük değerlendirme tavanı (0039).
--
-- Tarlacılığın gerçek zararı kredi enflasyonu değil: tarlacı, parasını ödemiş bir kanalın
-- değerlendirme kotasını gürültüyle doldurup karşılığında kendi testine gerçek geri bildirim
-- alıyor. Tavan kaliteyi hiç yargılamadan o hacmi kesiyor — desen tespiti rastgeleleştirmeyle
-- atlatılabiliyor, hacim tavanı atlatılamıyor.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

-- ---------- arrange ----------
insert into niches (slug, name) values ('dl-niche', 'Daily limit');
insert into auth.users (id, email) values
  ('ff666666-0000-0000-0000-00000000000a', 'dl-owner@test.local'),
  ('ff666666-0000-0000-0000-00000000000b', 'dl-reviewer@test.local');

update profiles set niche_id = (select id from niches where slug = 'dl-niche'),
                    onboarding_done = true
 where id::text like 'ff666666%';

insert into channels (profile_id, youtube_url, niche_id)
values ('ff666666-0000-0000-0000-00000000000a', 'https://www.youtube.com/@dl',
        (select id from niches where slug = 'dl-niche'));

insert into niche_thumbnail_cache (niche_id, video_id, title, thumbnail_url)
select (select id from niches where slug = 'dl-niche'), 'dl_decoy_' || g, 'Decoy ' || g,
       'https://example.test/' || g || '.jpg'
from generate_series(1, 5) g;

insert into submissions (id, owner_id, channel_id, niche_id, language, title_options,
  thumbnail_paths, clip_path, clip_duration_seconds, requested_reviews, status,
  screened_at, closes_at)
values ('ff666666-1111-1111-1111-111111111111', 'ff666666-0000-0000-0000-00000000000a',
  (select id from channels where profile_id = 'ff666666-0000-0000-0000-00000000000a'),
  (select id from niches where slug = 'dl-niche'), 'en', array['Daily limit title'],
  array['t/a.jpg'], 'c/a.mp4', 58, 25, 'open', now(), now() + interval '7 days');

-- İkinci test baştan havuzda duruyor. Olmazsa tavan testi dişsiz kalır: gerçek bir test
-- aynı kişiye iki kez verilmediği için birincisi ilk görevden sonra kapanıyor ve
-- `next_review_task` tavan olmasa DA boş dönerdi (mutasyon bunu yakaladı).
insert into submissions (id, owner_id, channel_id, niche_id, language, title_options,
  thumbnail_paths, clip_path, clip_duration_seconds, requested_reviews, status,
  screened_at, closes_at)
values ('ff666666-3333-3333-3333-333333333333', 'ff666666-0000-0000-0000-00000000000a',
  (select id from channels where profile_id = 'ff666666-0000-0000-0000-00000000000a'),
  (select id from niches where slug = 'dl-niche'), 'en', array['Second daily limit title'],
  array['t/b.jpg'], 'c/b.mp4', 58, 25, 'open', now(), now() + interval '7 days');

-- Tavanı dolduracak kadar geçmiş değerlendirme. Görev satırı üretmeden doğrudan yazıyoruz:
-- sınanan şey görev akışı değil, sayacın kapıyı kapatması.
insert into reviews (submission_id, reviewer_id, thumbnail_index, title_index, picked_candidate,
  picked_position, decision_ms, title_guess, leave_second, watched_seconds, time_spent_seconds, created_at)
select 'ff666666-1111-1111-1111-111111111111', 'ff666666-0000-0000-0000-00000000000b',
       0, 0, true, g % 6, 900, 'bu video tam beş kelime', 3, 3, 30, now() - interval '2 hours'
from generate_series(1, 19) g;

-- ---------- test_the_limit_is_not_reached_yet ----------
select is((select count(*)::int from reviews where reviewer_id = 'ff666666-0000-0000-0000-00000000000b'),
  19, 'on dokuz değerlendirme yazılmış: tavanın bir altı');

set local request.jwt.claims to '{"sub":"ff666666-0000-0000-0000-00000000000b","role":"authenticated"}';
set local role authenticated;
select isnt((next_review_task())->'task', 'null'::jsonb,
  'tavanın altındayken görev veriliyor');
reset role;

-- ---------- test_the_twentieth_review_closes_the_door ----------
insert into reviews (submission_id, reviewer_id, thumbnail_index, title_index, picked_candidate,
  picked_position, decision_ms, title_guess, leave_second, watched_seconds, time_spent_seconds, created_at)
values ('ff666666-1111-1111-1111-111111111111', 'ff666666-0000-0000-0000-00000000000b',
  0, 0, true, 1, 900, 'bu video tam beş kelime', 3, 3, 30, now() - interval '2 hours');

-- Açık görev kalmasın: tavan, elindeki işi çöpe atmıyor ve o dal burayı gölgelerdi.
update review_tasks set status = 'done' where reviewer_id = 'ff666666-0000-0000-0000-00000000000b';

set local request.jwt.claims to '{"sub":"ff666666-0000-0000-0000-00000000000b","role":"authenticated"}';
set local role authenticated;
select is((next_review_task())->'task', 'null'::jsonb,
  'yirminciden sonra görev verilmiyor');
select is((next_review_task())->>'reason', 'daily_limit',
  'sebep satırda: istemci "niş boş" ile "bugünlük doldun"u ayırabilsin');
reset role;

-- ---------- test_the_window_rolls ----------
-- Kayan 24 saat, takvim günü değil: takvim günü olsaydı gece yarısı sıfırlanır ve tarlacı
-- iki katını arka arkaya yapardı.
update reviews set created_at = now() - interval '25 hours'
 where reviewer_id = 'ff666666-0000-0000-0000-00000000000b';


set local request.jwt.claims to '{"sub":"ff666666-0000-0000-0000-00000000000b","role":"authenticated"}';
set local role authenticated;
select isnt((next_review_task())->'task', 'null'::jsonb,
  '24 saati geçen değerlendirmeler tavandan düşer');
reset role;

select * from finish();
rollback;
