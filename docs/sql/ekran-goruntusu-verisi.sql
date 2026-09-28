-- Mağaza ekran görüntüleri için YEREL veri kurulumu.
-- `scripts/store-screenshots.mjs` bu durumu bekler. Canlıda ÇALIŞTIRILMAZ.
--
-- Sıra:
--   1. pnpm exec supabase db reset
--   2. node scripts/seed-demo.mjs            (örnek testler + medya)
--   3. bu dosya                              (aşağıdaki iki blok)
--   4. node scripts/store-screenshots.mjs
--
-- Neden bu kadar kurulum: iyi bir mağaza görseli dolu bir ekran ister. Boş "test yok"
-- ekranının görüntüsü kimseye ürünü anlatmıyor. Burada kurulan üç şey var:
--   * ızgaranın besleneceği GERÇEK decoy havuzu (canlıdan kopyalanır, aşağıya bak)
--   * değerlendiriciye verilecek GERÇEK bir test — örnek test olursa ekranın üçte birini
--     "Practice test" rozeti kaplıyor ve altı thumbnail'ın ikisi kadraja girmiyor
--   * sahibin kendi testi + beş değerlendirme, sonuç ekranı dolsun diye

-- ---------- 1) test kullanıcısı education nişinde ----------
update profiles
   set niche_id = (select id from niches where slug = 'education'),
       language = 'en', onboarding_done = true, display_name = 'Gokce'
 where id = '22222222-2222-2222-2222-222222222222';

-- ---------- 2) seed'in dolgu decoy'ları ----------
-- seed.sql her nişe "Sample video 8 in Education & Explainers" gibi satırlar koyuyor;
-- ızgarada onlar görününce görüntü sahte duruyor. Gerçekleri canlıdan kopyala:
--   select video_id, title, thumbnail_url, channel_title, is_vertical
--     from niche_thumbnail_cache c join niches n on n.id = c.niche_id
--    where n.slug = 'education' limit 40;
-- ve yerele insert et. Sonra:
delete from niche_thumbnail_cache where title like 'Sample video%';

-- ---------- 3) ızgara için gerçek (demo olmayan) test ----------
-- Örnek testin medyasını yeniden kullanır; amaç rozetsiz bir ızgara.
with src as (
  select s.thumbnail_paths, s.clip_path, s.owner_id, s.channel_id
  from submissions s
  where s.title_options[1] = 'Is the Earth Flat? A Professor vs a Flat Earther'
  limit 1
)
insert into submissions (id, owner_id, channel_id, niche_id, language, title_options,
                         thumbnail_paths, clip_path, clip_duration_seconds,
                         requested_reviews, received_reviews, status, closes_at, is_demo)
select 'ffff0000-0000-0000-0000-00000000bbbb', src.owner_id, src.channel_id,
       (select id from niches where slug = 'education'), 'en',
       array['Is the Earth Flat? A Professor vs a Flat Earther'],
       src.thumbnail_paths, src.clip_path, 58, 15, 2, 'open', now() + interval '60 hours', false
from src
on conflict (id) do nothing;

-- ---------- 4) sahibin kendi testi ----------
with ch as (
  select id from channels where profile_id = '22222222-2222-2222-2222-222222222222' limit 1
), owner_media as (
  select thumbnail_paths, clip_path from submissions
   where title_options[1] = 'Did Women Win the Vote, or Did Men Give It to Them?' limit 1
)
insert into submissions (id, owner_id, channel_id, niche_id, language, title_options,
                         thumbnail_paths, clip_path, clip_duration_seconds,
                         requested_reviews, received_reviews, status, closes_at)
select 'ffff0000-0000-0000-0000-00000000aaaa',
       '22222222-2222-2222-2222-222222222222', ch.id,
       (select id from niches where slug = 'education'), 'en',
       array['Did Women Win the Vote, or Did Men Give It to Them?',
             'The Suffragettes Did Not Ask Nicely'],
       owner_media.thumbnail_paths, owner_media.clip_path, 58, 5, 5, 'open',
       now() + interval '40 hours'
from ch, owner_media
on conflict (id) do nothing;

-- ---------- 5) o teste beş değerlendirme ----------
-- Sonuç ekranı boşsa tıklama oranı, karar süresi ve bırakma saniyesi görünmüyor —
-- yani ürünün KARŞILIĞINI gösteren tek ekran boş çıkıyor.
with reviewers as (
  select id, row_number() over (order by id) as n from profiles
   where id <> '22222222-2222-2222-2222-222222222222' limit 5
), tasks as (
  insert into review_tasks (submission_id, reviewer_id, thumbnail_index, title_index,
                            decoys, candidate_position, status, assigned_at, expires_at)
  select 'ffff0000-0000-0000-0000-00000000aaaa', r.id, (r.n % 2)::int, (r.n % 2)::int,
         '[]'::jsonb, (r.n % 6)::int, 'done', now() - interval '3 hours',
         now() + interval '1 hour'
  from reviewers r
  on conflict (submission_id, reviewer_id) do nothing
  returning id, reviewer_id
), numbered as (
  select t.id, t.reviewer_id, row_number() over (order by t.id) as n from tasks t
), data(n, picked, pos, ms, guess, leave_s, watched, tags, note, spent) as (values
  (1, true,  1, 3100, 'A history video about women getting the vote',  null::int, 58, array['strong_hook','clear_promise'],    'The thumbnail made me expect a fight, and it delivered.',  107),
  (2, true,  3, 4200, 'Suffragettes and how the vote was actually won', 41,       41, array['too_long_setup'],                 'Lost me when the second guest started repeating himself.', 119),
  (3, true,  0, 2600, 'Someone argues the vote was taken, not given',   null::int, 58, array['got_to_the_point','good_energy'], 'Clear from the first line what the question was.',         131),
  (4, false, 4, 5600, 'A debate show about voting rights history',      17,       17, array['slow_intro','low_energy'],         null,                                                       143),
  (5, false, 2, 4800, 'How women won the right to vote in Britain',     29,       29, array['unclear_promise'],                 'Good idea but the opening is slow.',                       155)
)
insert into reviews (task_id, submission_id, reviewer_id, thumbnail_index, title_index,
                     picked_candidate, picked_position, decision_ms, title_guess,
                     leave_second, watched_seconds, reason_tags, comment, time_spent_seconds)
select nu.id, 'ffff0000-0000-0000-0000-00000000aaaa', nu.reviewer_id,
       (d.n % 2)::int, (d.n % 2)::int, d.picked, d.pos, d.ms, d.guess,
       d.leave_s, d.watched, d.tags, d.note, d.spent
from numbered nu join data d on d.n = nu.n;
