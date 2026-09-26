-- 020_relevant_decoys.sql — ızgaradaki beş decoy konuyla ilgili mi (0022, 0023).
--
-- İki katman ayrı test ediliyor:
--   decoy_keywords → hangi kelime konu taşır. Belirlenebilir, rastgelelik yok.
--   pick_decoys    → o kelimelerle kimler seçilir. Eşit puanlılar arasında sıra rastgele,
--                    bu yüzden burada yalnızca HER ZAMAN doğru olan iddialar kurulur.
--                    "Şu video seçilmemeli" demek rastgele geçip kalabilirdi.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

-- ---------- arrange ----------
insert into niches (slug, name) values ('rd-niche', 'Decoy niche'), ('rd-other', 'Other niche');

-- Havuz bilerek 5'ten çok büyük: sekiz videodan beşini seçerken "seçildi" demek bir şey
-- kanıtlamaz. Dolgu başlıklarının hepsinde "Explained" var — 0023'ün eleyeceği klişe bu.
insert into niche_thumbnail_cache (niche_id, video_id, title, thumbnail_url)
select (select id from niches where slug = 'rd-niche'), v, ttl, 'https://example.test/' || v || '.jpg'
from (values
  ('rd_t1', 'Time Travel Paradoxes'),
  ('rd_t2', 'Can We Travel Back in Time?'),
  ('rd_t3', 'The Physics of Time Dilation'),
  ('rd_x1', 'I Baked Bread for 30 Days'),
  ('rd_x2', 'Every Guitar Pedal Ranked'),
  ('rd_x3', 'My Morning Routine in Lisbon'),
  ('rd_x4', 'Rebuilding a 1994 Engine'),
  ('rd_x5', 'Fifty Push-Ups a Day')
) as t(v, ttl);

insert into niche_thumbnail_cache (niche_id, video_id, title, thumbnail_url)
select (select id from niches where slug = 'rd-niche'), 'rd_pad_' || g,
       'Padding Explained Number ' || g, 'https://example.test/pad' || g || '.jpg'
from generate_series(1, 20) g;

-- ---------- test_decoy_keywords_keeps_the_topic_word ----------
select ok(
  'travel' = any(decoy_keywords((select id from niches where slug='rd-niche'),
                                'Is Time Travel Possible?')),
  'decoy_keywords: konu kelimesi sayılır');

-- ---------- test_decoy_keywords_drops_short_words ----------
select ok(
  not ('is' = any(decoy_keywords((select id from niches where slug='rd-niche'),
                                 'Is Time Travel Possible?'))),
  'decoy_keywords: dört harften kısa kelime sayılmaz');

-- ---------- test_decoy_keywords_drops_a_word_the_niche_overuses ----------
select ok(
  not ('explained' = any(decoy_keywords((select id from niches where slug='rd-niche'),
                                        'Guitar Explained for Everyone'))),
  'decoy_keywords: nişin çoğunda geçen kelime sayılmaz');
select ok(
  'guitar' = any(decoy_keywords((select id from niches where slug='rd-niche'),
                                'Guitar Explained for Everyone')),
  'decoy_keywords: klişe elenirken konu kelimesi kalır');

-- ---------- test_decoys_fill_the_grid ----------
select is(
  jsonb_array_length(pick_decoys((select id from niches where slug='rd-niche'),
    'Is Time Travel Possible? You''re Doing It Right Now')),
  5, 'pick_decoys: her zaman beş öğe döner');

-- ---------- test_decoys_share_the_topic ----------
select is(
  (select count(*)::int from jsonb_array_elements(
     pick_decoys((select id from niches where slug='rd-niche'),
       'Is Time Travel Possible? You''re Doing It Right Now')) d
   where d->>'video_id' like 'rd_t%'),
  3, 'pick_decoys: 28 videoluk havuzda konuyu paylaşan üçü de ızgaraya girer');

-- ---------- test_decoys_still_fill_the_grid_without_a_match ----------
-- Izgara eksik kalırsa değerlendirme ekranı hiç açılmaz; ilgisizlik, boşluktan iyidir.
select is(
  jsonb_array_length(pick_decoys((select id from niches where slug='rd-niche'),
    'Zebra Quadrant Nineteen Marmalade')),
  5, 'pick_decoys: hiç eşleşme yoksa da beş öğe döner');

-- ---------- test_decoys_only_from_the_same_niche ----------
insert into niche_thumbnail_cache (niche_id, video_id, title, thumbnail_url)
values ((select id from niches where slug='rd-other'), 'rd_foreign',
        'Time Travel in Another Niche', 'https://example.test/f.jpg');

select is(
  (select count(*)::int from jsonb_array_elements(
     pick_decoys((select id from niches where slug='rd-niche'),
       'Is Time Travel Possible?')) d
   where d->>'video_id' = 'rd_foreign'),
  0, 'pick_decoys: başka nişin videosu ızgaraya giremez');

-- ---------- test_decoys_match_the_orientation ----------
-- Dikey bir aday 16:9 komşular arasında sırıtır ve test gerçekte olacağından İYİ sonuç
-- verir (0024). Yön ızgarayı böler, değerlendirici havuzunu değil.
insert into niche_thumbnail_cache (niche_id, video_id, title, thumbnail_url, is_vertical)
select (select id from niches where slug = 'rd-niche'), 'rd_dik_' || g,
       'Vertical Travel Clip ' || g, 'https://example.test/d' || g || '.jpg', true
from generate_series(1, 8) g;

select is(
  (select count(*)::int from jsonb_array_elements(
     pick_decoys((select id from niches where slug='rd-niche'), 'Time Travel', true)) d
   where d->>'video_id' like 'rd_dik%'),
  5, 'pick_decoys: dikey testin beş komşusu da dikey');

select is(
  (select count(*)::int from jsonb_array_elements(
     pick_decoys((select id from niches where slug='rd-niche'), 'Time Travel', false)) d
   where d->>'video_id' like 'rd_dik%'),
  0, 'pick_decoys: yatay testin ızgarasına dikey video girmez');

select * from finish();
rollback;
