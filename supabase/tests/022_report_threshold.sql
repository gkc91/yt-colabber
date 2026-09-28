-- 022_report_threshold.sql — rapor eşiği iki yönlü mü (0029).
--
-- Sorular: ağır sebepte deneyimli bir raporcu tek başına gizletebiliyor mu (zararlı içerik
-- üç kişiyi beklemesin), YENİ bir hesap tek başına gizletebiliyor mu (iyi niyetli kanal tek
-- kötü niyetliye kurban gitmesin), spam hâlâ üç mü, gizlenince kredi iade ediliyor mu.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- ---------- arrange ----------
insert into niches (slug, name) values ('rt-niche', 'Report niche');
insert into auth.users (id, email) values
  ('cc111111-0000-0000-0000-000000000001', 'rt-owner@test.local'),
  ('cc111111-0000-0000-0000-000000000002', 'rt-veteran@test.local'),
  ('cc111111-0000-0000-0000-000000000003', 'rt-fresh@test.local'),
  ('cc111111-0000-0000-0000-000000000004', 'rt-other@test.local');

update profiles set niche_id = (select id from niches where slug='rt-niche'),
                    onboarding_done = true
 where id::text like 'cc111111-0000-0000-0000-00000000000_';

-- Deneyimli: bir değerlendirme yazmış, itibarı yerinde. Yeni: hiç iş yapmamış.
update profiles set reviews_given = 4 where id = 'cc111111-0000-0000-0000-000000000002';
update profiles set reviews_given = 0 where id = 'cc111111-0000-0000-0000-000000000003';
update profiles set reviews_given = 2 where id = 'cc111111-0000-0000-0000-000000000004';

-- ---------- test_report_weight_reads_the_reporter ----------
select ok(report_is_weighted('cc111111-0000-0000-0000-000000000002'),
  'report_is_weighted: değerlendirme yazmış, itibarı yerinde olan ağırlıklı');
select ok(not report_is_weighted('cc111111-0000-0000-0000-000000000003'),
  'report_is_weighted: hiç değerlendirme yazmamış hesap ağırlıklı değil');

-- ---------- test_report_threshold_is_one_only_for_a_weighted_severe_report ----------
select is(report_threshold('inappropriate', true), 1,
  'ağır sebep + ağırlıklı raporcu → 1');
select is(report_threshold('inappropriate', false), 3,
  'ağır sebep ama yeni hesap → 3, tek başına susturamaz');
select is(report_threshold('spam', true), 3,
  'spam → 3, acele etmenin karşılığı yok');

-- ---------- test_report_hides_and_refunds ----------
insert into submissions (id, owner_id, niche_id, title_options, thumbnail_paths, clip_path,
                         clip_duration_seconds, requested_reviews, received_reviews)
values ('cccc2222-0000-0000-0000-00000000000a', 'cc111111-0000-0000-0000-000000000001',
        (select id from niches where slug='rt-niche'), array['A title being reported'],
        array['thumbs/x/a.jpg'], 'clips/x/a.mp4', 58, 5, 1);

insert into review_tasks (submission_id, reviewer_id, thumbnail_index, title_index,
                          decoys, candidate_position)
values ('cccc2222-0000-0000-0000-00000000000a', 'cc111111-0000-0000-0000-000000000002',
        0, 0, '[]'::jsonb, 0);

set local request.jwt.claims to '{"sub":"cc111111-0000-0000-0000-000000000002","role":"authenticated"}';
set local role authenticated;
select report_content('submission', 'cccc2222-0000-0000-0000-00000000000a', 'inappropriate');
reset role;

select is(
  (select status::text from submissions where id = 'cccc2222-0000-0000-0000-00000000000a'),
  'hidden', 'ağırlıklı tek ağır rapor testi gizler');

-- Yanlış rapor olsa bile sahibi kredisini geri alır: kaybettiği zaman olur, kredi değil.
select is(
  (select coalesce(sum(delta), 0)::int from credit_ledger
    where profile_id = 'cc111111-0000-0000-0000-000000000001' and reason = 'refund'),
  4, 'kullanılmayan 4 kredi iade edilir');

select * from finish();
rollback;
