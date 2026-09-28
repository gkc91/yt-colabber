-- 026_watched_claim_consistency.sql — "sonuna kadar izledim" iddiası doğrulanıyor mu (0036).
--
-- PRODUCT §5: `leave_second = null` "klip sonuna kadar izlendi" demek. İstemci bu değişmezi
-- koruyor ama sunucu kontrol etmiyordu; `null` + `watched_seconds = 0` kabul ediliyor,
-- kaydediliyor ve kredisi ödeniyordu.
--
-- Bu yalnızca bir kredi sızıntısı değil: `flag_suspicious_reviewer` "hep sıfırda bıraktı"
-- kuralını `leave_second = 0` üzerinden uyguluyor ve NULL sıfıra eşit olmadığı için o
-- kuraldan kaçıyordu. Tespit, daha dikkatli saldırgana karşı daha zayıftı.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- ---------- arrange ----------
insert into niches (slug, name) values ('wc-niche', 'Watch claim');
insert into auth.users (id, email) values
  ('dd111111-0000-0000-0000-00000000000a', 'wc-owner@test.local'),
  ('dd111111-0000-0000-0000-00000000000b', 'wc-reviewer@test.local');

update profiles set niche_id = (select id from niches where slug = 'wc-niche'),
                    onboarding_done = true
 where id::text like 'dd111111%';

insert into channels (profile_id, youtube_url, niche_id)
values ('dd111111-0000-0000-0000-00000000000a', 'https://www.youtube.com/@wc',
        (select id from niches where slug = 'wc-niche'));
insert into credit_ledger (profile_id, delta, reason)
values ('dd111111-0000-0000-0000-00000000000a', 50, 'admin');

insert into submissions (id, owner_id, channel_id, niche_id, language, title_options,
  thumbnail_paths, clip_path, clip_duration_seconds, requested_reviews, status,
  screened_at, closes_at)
values ('dd111111-2222-2222-2222-222222222222', 'dd111111-0000-0000-0000-00000000000a',
  (select id from channels where profile_id = 'dd111111-0000-0000-0000-00000000000a'),
  (select id from niches where slug = 'wc-niche'), 'en', array['Watch claim title'],
  array['t/a.jpg'], 'c/a.mp4', 58, 5, 'open', now(), now() + interval '7 days');

-- Görev 30 saniye önce atanmış olsun ki `time_spent >= 20` kapısı test edilen şeyi
-- gölgelemesin: burada sınanan süre değil, tutarlılık.
insert into review_tasks (id, submission_id, reviewer_id, thumbnail_index, title_index,
  decoys, candidate_position, assigned_at, expires_at, status)
values ('dd111111-3333-3333-3333-333333333333', 'dd111111-2222-2222-2222-222222222222',
  'dd111111-0000-0000-0000-00000000000b', 0, 0, '[]'::jsonb, 0,
  now() - interval '30 seconds', now() + interval '30 minutes', 'assigned');

set local request.jwt.claims to '{"sub":"dd111111-0000-0000-0000-00000000000b","role":"authenticated"}';
set local role authenticated;

-- ---------- test_claiming_a_full_watch_without_watching_is_rejected ----------
select throws_ok(
  $$select submit_review('dd111111-3333-3333-3333-333333333333'::uuid, true, 2, 900,
      'some guess words here please', null, 0, array['kept_watching'], null, 30)$$,
  'invalid_leave_second',
  '"sonuna kadar izledim" + izlenen süre sıfır reddedilir');

-- ---------- test_a_partial_watch_still_needs_a_leave_second ----------
-- Aynı çelişki, klibin ortasında: null yine "sonuna kadar" demek.
select throws_ok(
  $$select submit_review('dd111111-3333-3333-3333-333333333333'::uuid, true, 2, 900,
      'some guess words here please', null, 30, array['kept_watching'], null, 30)$$,
  'invalid_leave_second',
  'yarısını izleyip "sonuna kadar" demek de reddedilir');

reset role;
-- Reddedilen çağrılar hiçbir iz bırakmamalı.
select is((select count(*)::int from reviews
            where submission_id = 'dd111111-2222-2222-2222-222222222222'),
  0, 'reddedilen istek değerlendirme yazmaz');
select is((select count(*)::int from credit_ledger
            where profile_id = 'dd111111-0000-0000-0000-00000000000b'
              and reason = 'review_reward'),
  0, 'reddedilen istek kredi ödemez');

set local request.jwt.claims to '{"sub":"dd111111-0000-0000-0000-00000000000b","role":"authenticated"}';
set local role authenticated;

-- ---------- test_leaving_early_is_still_a_valid_review ----------
-- Düzeltme dürüst davranışı bozmamalı: erken bırakmak değerli bir sinyal, hile değil.
select isnt(
  (select submit_review('dd111111-3333-3333-3333-333333333333'::uuid, false, 2, 900,
      'some guess words here please', 3, 3, array['slow_intro'], null, 30)),
  null, 'üçüncü saniyede bırakmak geçerli bir değerlendirme');

reset role;
select is((select leave_second from reviews
            where submission_id = 'dd111111-2222-2222-2222-222222222222'),
  3, 'bırakılan saniye olduğu gibi kaydedilir');

select * from finish();
rollback;
