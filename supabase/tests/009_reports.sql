-- 009_reports.sql — rapor akışı (C3, 0012).
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- ---------- arrange ----------
insert into niches (slug, name) values ('report-niche', 'Report test niche');
insert into auth.users (id, email) values
  ('cafe0001-0000-0000-0000-000000000001', 'rep-owner@test.local'),
  ('cafe0001-0000-0000-0000-000000000002', 'rep-r1@test.local'),
  ('cafe0001-0000-0000-0000-000000000003', 'rep-r2@test.local'),
  ('cafe0001-0000-0000-0000-000000000004', 'rep-r3@test.local'),
  ('cafe0001-0000-0000-0000-000000000005', 'rep-stranger@test.local');
update profiles set niche_id = (select id from niches where slug='report-niche'), onboarding_done = true
  where id::text like 'cafe0001-0000-0000-0000-00000000000_';

insert into submissions (id, owner_id, niche_id, title_options, thumbnail_paths, clip_path,
                         clip_duration_seconds, requested_reviews, received_reviews)
values ('cafe0002-0000-0000-0000-000000000001', 'cafe0001-0000-0000-0000-000000000001',
        (select id from niches where slug='report-niche'),
        array['A title'], array['thumbs/r/1.jpg'], 'clips/r/1.mp4', 30, 5, 1);

-- üç değerlendiriciye görev; biri değerlendirmesini de yapmış olsun
insert into review_tasks (id, submission_id, reviewer_id, thumbnail_index, title_index, decoys, candidate_position)
values
  ('cafe0003-0000-0000-0000-000000000001', 'cafe0002-0000-0000-0000-000000000001', 'cafe0001-0000-0000-0000-000000000002', 0, 0, '[]'::jsonb, 0),
  ('cafe0003-0000-0000-0000-000000000002', 'cafe0002-0000-0000-0000-000000000001', 'cafe0001-0000-0000-0000-000000000003', 0, 0, '[]'::jsonb, 1),
  ('cafe0003-0000-0000-0000-000000000003', 'cafe0002-0000-0000-0000-000000000001', 'cafe0001-0000-0000-0000-000000000004', 0, 0, '[]'::jsonb, 2);

insert into reviews (id, task_id, submission_id, reviewer_id, thumbnail_index, title_index,
                     picked_candidate, picked_position, decision_ms, title_guess,
                     leave_second, watched_seconds, time_spent_seconds)
values ('cafe0004-0000-0000-0000-000000000001', 'cafe0003-0000-0000-0000-000000000001',
        'cafe0002-0000-0000-0000-000000000001', 'cafe0001-0000-0000-0000-000000000002', 0, 0,
        true, 0, 1500, 'A guess about the video', 10, 10, 45);

-- ---------- test_reports_require_having_seen_the_content ----------
set local request.jwt.claims to '{"sub":"cafe0001-0000-0000-0000-000000000005","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  $$select report_content('submission', 'cafe0002-0000-0000-0000-000000000001', 'spam')$$,
  'no_access', 'görevi olmayan kullanıcı submission raporlayamaz');
select throws_ok(
  $$insert into reports (reporter_id, target_type, target_id, reason)
    values ('cafe0001-0000-0000-0000-000000000005', 'submission', 'cafe0002-0000-0000-0000-000000000001', 'spam')$$,
  '42501', null, 'reports tablosuna doğrudan yazılamaz');
reset role;

-- ---------- test_reports_reason_must_be_known ----------
set local request.jwt.claims to '{"sub":"cafe0001-0000-0000-0000-000000000002","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  $$select report_content('submission', 'cafe0002-0000-0000-0000-000000000001', 'because_i_said_so')$$,
  'invalid_reason', 'tanımsız sebep reddedilir');

-- ---------- test_reports_first_two_do_not_hide ----------
select lives_ok(
  $$select report_content('submission', 'cafe0002-0000-0000-0000-000000000001', 'inappropriate', 'çok rahatsız edici')$$,
  'görevi olan değerlendirici raporlayabilir');
select lives_ok(
  $$select report_content('submission', 'cafe0002-0000-0000-0000-000000000001', 'spam')$$,
  'aynı kişinin ikinci raporu hata vermez (sessizce yok sayılır)');
reset role;

select is((select report_count from submissions where id='cafe0002-0000-0000-0000-000000000001'), 1,
  'aynı kişi sayacı bir kez artırır');
select is((select status::text from submissions where id='cafe0002-0000-0000-0000-000000000001'), 'open',
  'tek raporla test gizlenmez');

-- ---------- test_reports_three_reports_hide_and_refund ----------
set local request.jwt.claims to '{"sub":"cafe0001-0000-0000-0000-000000000003","role":"authenticated"}';
set local role authenticated;
select report_content('submission', 'cafe0002-0000-0000-0000-000000000001', 'spam');
reset role;
set local request.jwt.claims to '{"sub":"cafe0001-0000-0000-0000-000000000004","role":"authenticated"}';
set local role authenticated;
select report_content('submission', 'cafe0002-0000-0000-0000-000000000001', 'abusive');
reset role;

select is((select status::text from submissions where id='cafe0002-0000-0000-0000-000000000001'), 'hidden',
  '3 rapor alan test gizlenir');
select is(
  (select coalesce(sum(delta),0)::int from credit_ledger
    where ref_id = 'cafe0002-0000-0000-0000-000000000001' and reason = 'refund'),
  4, 'gizlenen testin kullanılmayan kredisi iade edilir (5 istendi, 1 geldi → +4)');

-- ---------- test_reports_hidden_submission_leaves_the_pool ----------
insert into niche_thumbnail_cache (niche_id, video_id, title, thumbnail_url)
select (select id from niches where slug='report-niche'), 'rep_decoy_'||g, 'D'||g, 'https://e.test/'||g||'.jpg'
from generate_series(1,5) g;
set local request.jwt.claims to '{"sub":"cafe0001-0000-0000-0000-000000000005","role":"authenticated"}';
set local role authenticated;
select is(next_review_task()->'task', 'null'::jsonb,
  'gizlenen test görev havuzundan düşer');
reset role;

-- ---------- test_reports_on_reviews ----------
-- Değerlendirmeyi yalnızca testin sahibi raporlayabilir
set local request.jwt.claims to '{"sub":"cafe0001-0000-0000-0000-000000000003","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  $$select report_content('review', 'cafe0004-0000-0000-0000-000000000001', 'abusive')$$,
  'no_access', 'başkasının değerlendirmesi raporlanamaz');
reset role;

set local request.jwt.claims to '{"sub":"cafe0001-0000-0000-0000-000000000001","role":"authenticated"}';
set local role authenticated;
select report_content('review', 'cafe0004-0000-0000-0000-000000000001', 'abusive', 'hakaret var');
reset role;

select is((select is_reported from reviews where id='cafe0004-0000-0000-0000-000000000001'), true,
  'raporlanan değerlendirme işaretlenir');
select is((select reputation from profiles where id='cafe0001-0000-0000-0000-000000000002'), 1.00::numeric(4,2),
  'rapor tek başına itibarı düşürmez (doğrulanmamış rapor ceza değildir)');

select * from finish();
rollback;
