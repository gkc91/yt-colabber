-- 020_relevant_decoys.sql — ızgaradaki beş decoy konuyla ilgili mi (0022).
-- Sorular: başlıkla kelime paylaşanlar öne geçiyor mu, ilgisizler eleniyor mu, yeterli
-- ilgili video yoksa yine de beş tane dönüyor mu (ızgara asla eksik kalmamalı).
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

-- ---------- arrange ----------
insert into niches (slug, name) values ('rd-niche', 'Decoy niche');

-- Üç tanesi konuyu paylaşıyor ("time travel"), beş tanesi tamamen başka.
insert into niche_thumbnail_cache (niche_id, video_id, title, thumbnail_url)
select (select id from niches where slug = 'rd-niche'), v, ttl, 'https://example.test/' || v || '.jpg'
from (values
  ('rd_t1', 'Time Travel Paradoxes Explained'),
  ('rd_t2', 'Can We Travel Back in Time?'),
  ('rd_t3', 'The Physics of Time Dilation'),
  ('rd_x1', 'I Baked Bread for 30 Days'),
  ('rd_x2', 'Every Guitar Pedal Ranked'),
  ('rd_x3', 'My Morning Routine in Lisbon'),
  ('rd_x4', 'Rebuilding a 1994 Engine'),
  ('rd_x5', 'Fifty Push-Ups a Day')
) as t(v, ttl);

-- ---------- test_decoys_share_the_topic_of_the_title ----------
select is(
  jsonb_array_length(pick_decoys((select id from niches where slug='rd-niche'),
    'Is Time Travel Possible? You''re Doing It Right Now')),
  5, 'pick_decoys: her zaman beş öğe döner');

select is(
  (select count(*)::int from jsonb_array_elements(
     pick_decoys((select id from niches where slug='rd-niche'),
       'Is Time Travel Possible? You''re Doing It Right Now')) d
   where d->>'video_id' like 'rd_t%'),
  3, 'pick_decoys: konuyu paylaşan üç video da ızgaraya girer');

-- ---------- test_decoys_prefer_a_match_over_a_large_pool ----------
-- Havuz beşten çok büyük olmalı, yoksa "seçildi" demek bir şey kanıtlamaz: sekiz videodan
-- beşini alırken zaten çoğu giriyor.
insert into niche_thumbnail_cache (niche_id, video_id, title, thumbnail_url)
select (select id from niches where slug = 'rd-niche'), 'rd_pad_' || g,
       'Padding Video Number ' || g, 'https://example.test/pad' || g || '.jpg'
from generate_series(1, 20) g;

select is(
  (select count(*)::int from jsonb_array_elements(
     pick_decoys((select id from niches where slug='rd-niche'),
       'Every Guitar Pedal Ranked by a Beginner')) d
   where d->>'video_id' = 'rd_x2'),
  1, 'pick_decoys: 28 videoluk havuzda bile başlıkla kelime paylaşan video ızgaraya girer');

-- Not: "kısa kelimeler sayılmaz" kuralı burada doğrudan iddia EDİLEMEZ — eşit puanlılar
-- arasında sıra rastgele olduğu için negatif bir iddia rastgele geçip kalabilir. Kural
-- 0022'de yazılı ve yukarıdaki pozitif iddia onun üzerine kurulu.

-- ---------- test_decoys_still_fill_the_grid_without_a_match ----------
-- Izgara eksik kalırsa değerlendirme ekranı hiç açılmaz; ilgisizlik, boşluktan iyidir.
select is(
  jsonb_array_length(pick_decoys((select id from niches where slug='rd-niche'),
    'Completely Unrelated Subject Matter Here')),
  5, 'pick_decoys: hiç eşleşme yoksa da beş öğe döner');

-- ---------- test_decoys_only_from_the_same_niche ----------
insert into niches (slug, name) values ('rd-other', 'Other niche');
insert into niche_thumbnail_cache (niche_id, video_id, title, thumbnail_url)
values ((select id from niches where slug='rd-other'), 'rd_foreign',
        'Time Travel in Another Niche', 'https://example.test/f.jpg');

select is(
  (select count(*)::int from jsonb_array_elements(
     pick_decoys((select id from niches where slug='rd-niche'),
       'Is Time Travel Possible?')) d
   where d->>'video_id' = 'rd_foreign'),
  0, 'pick_decoys: başka nişin videosu ızgaraya giremez');

select * from finish();
rollback;
