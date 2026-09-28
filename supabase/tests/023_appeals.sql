-- 023_appeals.sql — gizlenen testin geri dönüş yolu (0030).
--
-- Sorular: sahibi haber alıyor mu, itiraz edebiliyor mu, başkası onun adına itiraz
-- edebiliyor mu, geri açılınca kredi yeniden düşülüyor mu (bedava değerlendirme olmasın),
-- kaybettiği süre geri veriliyor mu, ve yanılan raporcunun ağırlığı düşüyor mu.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- ---------- arrange ----------
insert into niches (slug, name) values ('ap-niche', 'Appeal niche');
insert into auth.users (id, email) values
  ('dd222222-0000-0000-0000-000000000001', 'ap-owner@test.local'),
  ('dd222222-0000-0000-0000-000000000002', 'ap-reporter@test.local'),
  ('dd222222-0000-0000-0000-000000000003', 'ap-stranger@test.local');

update profiles set niche_id = (select id from niches where slug='ap-niche'),
                    onboarding_done = true, reviews_given = 3
 where id::text like 'dd222222-0000-0000-0000-00000000000_';

insert into submissions (id, owner_id, niche_id, title_options, thumbnail_paths, clip_path,
                         clip_duration_seconds, requested_reviews, received_reviews, closes_at)
values ('dddd3333-0000-0000-0000-00000000000a', 'dd222222-0000-0000-0000-000000000001',
        (select id from niches where slug='ap-niche'), array['An honest test title'],
        array['thumbs/x/a.jpg'], 'clips/x/a.mp4', 58, 5, 1, now() + interval '48 hours');

insert into review_tasks (submission_id, reviewer_id, thumbnail_index, title_index,
                          decoys, candidate_position)
values ('dddd3333-0000-0000-0000-00000000000a', 'dd222222-0000-0000-0000-000000000002',
        0, 0, '[]'::jsonb, 0);

-- Yanlış rapor: içerik aslında temiz.
set local request.jwt.claims to '{"sub":"dd222222-0000-0000-0000-000000000002","role":"authenticated"}';
set local role authenticated;
select report_content('submission', 'dddd3333-0000-0000-0000-00000000000a', 'inappropriate');
reset role;

-- ---------- test_appeal_owner_is_told ----------
select is(
  (select count(*)::int from notifications
    where profile_id = 'dd222222-0000-0000-0000-000000000001' and kind = 'submission_hidden'),
  1, 'gizlenince sahibine bildirim düşer');

select is(
  (select hidden_reason from submissions where id = 'dddd3333-0000-0000-0000-00000000000a'),
  'inappropriate', 'sebep satırda duruyor, sahibi neden durduğunu görebilir');

-- ---------- test_appeal_only_the_owner_can_appeal ----------
set local request.jwt.claims to '{"sub":"dd222222-0000-0000-0000-000000000003","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  $$select appeal_submission('dddd3333-0000-0000-0000-00000000000a', 'bana ait değil')$$,
  'not_owner', 'başkası itiraz edemez');
reset role;

set local request.jwt.claims to '{"sub":"dd222222-0000-0000-0000-000000000001","role":"authenticated"}';
set local role authenticated;
select lives_ok(
  $$select appeal_submission('dddd3333-0000-0000-0000-00000000000a', 'Bu benim kendi videom')$$,
  'sahibi itiraz edebilir');
select throws_ok(
  $$select appeal_submission('dddd3333-0000-0000-0000-00000000000a', 'tekrar')$$,
  'already_appealed', 'aynı test için ikinci itiraz sırayı tıkayamaz');
reset role;

-- ---------- test_appeal_restore_recharges_and_reopens ----------
select restore_submission('dddd3333-0000-0000-0000-00000000000a', 'içerik temiz');

select is(
  (select status::text from submissions where id = 'dddd3333-0000-0000-0000-00000000000a'),
  'open', 'kabul edilen itiraz testi geri açar');

-- Gizlenince 4 kredi iade edilmişti; geri açılınca aynısı düşülmeli, yoksa test bedava
-- değerlendirme toplardı.
select is(
  (select coalesce(sum(delta), 0)::int from credit_ledger
    where ref_id = 'dddd3333-0000-0000-0000-00000000000a'),
  0, 'iade ve yeniden düşme birbirini götürür: bedava değerlendirme yok');

select ok(
  (select closes_at from submissions where id = 'dddd3333-0000-0000-0000-00000000000a')
    > now() + interval '40 hours',
  'gizli kaldığı süre geri veriliyor');

-- ---------- test_appeal_overturned_report_costs_the_reporter ----------
select ok(
  (select overturned from reports
    where target_id = 'dddd3333-0000-0000-0000-00000000000a' limit 1),
  'geri alınan rapor işaretlenir — yanlış raporun artık bir maliyeti var');

select * from finish();
rollback;
