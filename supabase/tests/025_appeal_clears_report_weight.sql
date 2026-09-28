-- 025_appeal_clears_report_weight.sql — itirazı kazanan test korunuyor mu (0035).
--
-- 0030'un bütün gerekçesi şuydu: ağır sebeplerde TEK ağırlıklı raporla gizlemeyi
-- savunulabilir kılan şey, itirazın gerçek bir karşılık olması. Geri açılan test,
-- aklandığı raporların yüküyle dönerse itiraz bir karşılık değil, bir erteleme olur.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- ---------- arrange ----------
insert into niches (slug, name) values ('ap-niche', 'Appeal niche');
insert into auth.users (id, email) values
  ('cc111111-0000-0000-0000-00000000000a', 'ap-owner@test.local'),
  ('cc111111-0000-0000-0000-00000000000b', 'ap-r1@test.local'),
  ('cc111111-0000-0000-0000-00000000000c', 'ap-r2@test.local'),
  ('cc111111-0000-0000-0000-00000000000d', 'ap-r3@test.local'),
  ('cc111111-0000-0000-0000-00000000000e', 'ap-r4@test.local');

update profiles set niche_id = (select id from niches where slug = 'ap-niche'),
                    onboarding_done = true
 where id::text like 'cc111111%';

-- Dört raporcu da AĞIRLIKSIZ: eşik her sebep için 3, yani tek rapor yetmiyor. Test
-- edilen şey sayacın yükü, ağırlık kuralı değil.
update profiles set reputation = 0.5, reviews_given = 0
 where id::text like 'cc111111-0000-0000-0000-00000000000[bcde]';

insert into channels (profile_id, youtube_url, niche_id)
values ('cc111111-0000-0000-0000-00000000000a', 'https://www.youtube.com/@ap',
        (select id from niches where slug = 'ap-niche'));
insert into credit_ledger (profile_id, delta, reason)
values ('cc111111-0000-0000-0000-00000000000a', 50, 'admin');

insert into submissions (id, owner_id, channel_id, niche_id, language, title_options,
  thumbnail_paths, clip_path, clip_duration_seconds, requested_reviews, status,
  screened_at, closes_at)
values ('cc111111-2222-2222-2222-222222222222', 'cc111111-0000-0000-0000-00000000000a',
  (select id from channels where profile_id = 'cc111111-0000-0000-0000-00000000000a'),
  (select id from niches where slug = 'ap-niche'), 'en', array['Appeal repro title'],
  array['t/a.jpg'], 'c/a.mp4', 58, 5, 'open', now(), now() + interval '7 days');

-- ---------- test_three_reports_hide_the_submission ----------
insert into reports (reporter_id, target_type, target_id, reason) values
  ('cc111111-0000-0000-0000-00000000000b', 'submission', 'cc111111-2222-2222-2222-222222222222', 'spam'),
  ('cc111111-0000-0000-0000-00000000000c', 'submission', 'cc111111-2222-2222-2222-222222222222', 'spam'),
  ('cc111111-0000-0000-0000-00000000000d', 'submission', 'cc111111-2222-2222-2222-222222222222', 'spam');

select is((select status::text from submissions where id = 'cc111111-2222-2222-2222-222222222222'),
  'hidden', 'üç ağırlıksız rapor testi gizler');

-- ---------- test_restoring_clears_the_weight_of_overturned_reports ----------
insert into appeals (submission_id, profile_id)
values ('cc111111-2222-2222-2222-222222222222', 'cc111111-0000-0000-0000-00000000000a');
select restore_submission('cc111111-2222-2222-2222-222222222222', 'haksız rapor');

select is((select status::text from submissions where id = 'cc111111-2222-2222-2222-222222222222'),
  'open', 'itiraz kabul edilince test geri açılır');
select is((select count(*)::int from reports
            where target_id = 'cc111111-2222-2222-2222-222222222222' and overturned),
  3, 'üç rapor da geri alınmış işaretlenir');
select is((select report_count from submissions where id = 'cc111111-2222-2222-2222-222222222222'),
  0, 'geri alınan raporlar artık sayaçta YÜK DEĞİL');

-- ---------- test_one_more_report_does_not_re_hide_an_exonerated_submission ----------
-- Asıl iddia bu. Sayaç sıfırlanmazsa dördüncü rapor 4'e çıkarıp eşiği aşıyor ve aklanmış
-- test anında yeniden gizleniyor — itiraz bir karşılık değil, bir erteleme oluyor.
insert into reports (reporter_id, target_type, target_id, reason)
values ('cc111111-0000-0000-0000-00000000000e', 'submission',
        'cc111111-2222-2222-2222-222222222222', 'spam');

select is((select status::text from submissions where id = 'cc111111-2222-2222-2222-222222222222'),
  'open', 'aklanmış test TEK yeni raporla yeniden gizlenmez');
select is((select report_count from submissions where id = 'cc111111-2222-2222-2222-222222222222'),
  1, 'yeni rapor sıfırdan sayılır');

select * from finish();
rollback;
