-- 030_storage_quota_and_orphans.sql — kotasız yükleme ve yetim dosyalar (0040).
--
-- Açığın üç parçası vardı: politika nesne sayısına bakmıyordu, yükleme krediden ÖNCE
-- bitiyordu, ve `expired_clips` yalnızca `submissions` satırlarına baktığı için hiçbir
-- teste bağlanmamış dosyayı hiç görmüyordu. Burada ikisi sınanıyor: yetimin bulunması ve
-- kotanın kapanması.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- ---------- arrange ----------
insert into niches (slug, name) values ('st-niche', 'Storage');
insert into auth.users (id, email) values
  ('ab999999-0000-0000-0000-00000000000a', 'st-owner@test.local'),
  ('ab999999-0000-0000-0000-00000000000b', 'st-other@test.local');

update profiles set niche_id = (select id from niches where slug = 'st-niche'),
                    onboarding_done = true
 where id::text like 'ab999999%';

insert into channels (profile_id, youtube_url, niche_id)
values ('ab999999-0000-0000-0000-00000000000a', 'https://www.youtube.com/@st',
        (select id from niches where slug = 'st-niche'));

insert into submissions (id, owner_id, channel_id, niche_id, language, title_options,
  thumbnail_paths, clip_path, clip_duration_seconds, requested_reviews, status,
  screened_at, closes_at)
values ('ab999999-1111-1111-1111-111111111111', 'ab999999-0000-0000-0000-00000000000a',
  (select id from channels where profile_id = 'ab999999-0000-0000-0000-00000000000a'),
  (select id from niches where slug = 'st-niche'), 'en', array['Storage title'],
  array['thumbnails/ab999999-0000-0000-0000-00000000000a/kullanilan.jpg'],
  'clips/ab999999-0000-0000-0000-00000000000a/kullanilan.mp4',
  58, 5, 'open', now(), now() + interval '7 days');

-- Dört dosya: ikisi teste bağlı, biri bağsız ve ESKİ (yetim), biri bağsız ama YENİ.
insert into storage.objects (bucket_id, name, owner, created_at) values
  ('media', 'thumbnails/ab999999-0000-0000-0000-00000000000a/kullanilan.jpg',
   'ab999999-0000-0000-0000-00000000000a', now() - interval '10 hours'),
  ('media', 'clips/ab999999-0000-0000-0000-00000000000a/kullanilan.mp4',
   'ab999999-0000-0000-0000-00000000000a', now() - interval '10 hours'),
  ('media', 'thumbnails/ab999999-0000-0000-0000-00000000000a/yetim.jpg',
   'ab999999-0000-0000-0000-00000000000a', now() - interval '10 hours'),
  ('media', 'thumbnails/ab999999-0000-0000-0000-00000000000a/az-once.jpg',
   'ab999999-0000-0000-0000-00000000000a', now() - interval '5 minutes');

-- ---------- test_orphan_media_finds_the_unattached_file ----------
select is((select count(*)::int from orphan_media(100)), 1,
  'bağlanmamış ve süresi geçmiş tek dosya bulunur');
-- Sayarak karşılaştırıyoruz, tek satır bekleyerek değil: sorgu bozulup birden fazla satır
-- döndürdüğünde `select path from ...` HATA fırlatıp işlemi iptal ediyor ve geri kalan
-- testler hiç çalışmıyordu — bir testin diğerlerini maskelemesi (mutasyon bunu gösterdi).
select is((select count(*)::int from orphan_media(100)
            where path = 'thumbnails/ab999999-0000-0000-0000-00000000000a/yetim.jpg'),
  1, 'bulunan dosya tam olarak yetim olan');

-- ---------- test_orphan_media_spares_files_that_belong_to_a_test ----------
select is((select count(*)::int from orphan_media(100)
            where path like '%kullanilan%'), 0,
  'teste bağlı dosyalara dokunulmaz');

-- ---------- test_orphan_media_spares_a_fresh_upload ----------
-- Süre payı ZORUNLU: yeni yüklenen dosya `create_submission` çağrılana kadar teknik olarak
-- yetimdir. Pay olmasaydı dürüst bir yüklemeyi yarı yolda silerdik.
select is((select count(*)::int from orphan_media(100)
            where path like '%az-once%'), 0,
  'az önce yüklenen dosya yetim sayılmaz');

-- ---------- test_quota_allows_a_normal_upload_burst ----------
-- Dürüst kullanıcı bir testte 4 dosya yüklüyor; sınırı hissetmemeli.
select ok(uploads_under_quota('ab999999-0000-0000-0000-00000000000a'),
  'dört dosya yüklemiş kullanıcı kotanın altında');

-- ---------- test_hourly_upload_limit_is_twenty ----------
-- Sayı ayrıca sınanıyor: aşağıdaki testler SABİT 19 ve 20 kullanıyor, çünkü veriyi
-- `hourly_upload_limit()` ile üretmek testi sınadığı fonksiyona bağlar ve sınır
-- kaldırıldığında test de uyum sağlayıp geçer (mutasyon bunu yakaladı).
select is(hourly_upload_limit(), 20, 'saatlik tavan 20');

-- ---------- test_quota_closes_at_the_limit ----------
insert into storage.objects (bucket_id, name, owner, created_at)
select 'media',
       'thumbnails/ab999999-0000-0000-0000-00000000000b/spam-' || g || '.jpg',
       'ab999999-0000-0000-0000-00000000000b', now() - interval '2 minutes'
from generate_series(1, 19) g;

select ok(uploads_under_quota('ab999999-0000-0000-0000-00000000000b'),
  'on dokuz dosya yüklemiş kullanıcı hâlâ yükleyebilir');

insert into storage.objects (bucket_id, name, owner, created_at)
values ('media', 'thumbnails/ab999999-0000-0000-0000-00000000000b/spam-son.jpg',
        'ab999999-0000-0000-0000-00000000000b', now() - interval '1 minute');

select ok(not uploads_under_quota('ab999999-0000-0000-0000-00000000000b'),
  'yirminci dosyadan sonra yükleyemez');

-- ---------- test_quota_is_per_person ----------
-- Bir kişinin kotayı doldurması diğerini engellememeli.
select ok(uploads_under_quota('ab999999-0000-0000-0000-00000000000a'),
  'kota kişi başına: biri dolduğunda diğeri etkilenmez');

select * from finish();
rollback;
