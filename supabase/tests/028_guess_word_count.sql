-- 028_guess_word_count.sql — başlık tahmini kuralı sunucuda geçerli mi (0038).
--
-- PRODUCT §5 Adım 2: serbest metin, ≥5 kelime. İstemci uyguluyordu, sunucu uygulamıyordu —
-- boş string bile kabul edilip kredisi ödeniyordu. Bir kural yalnızca istemcide yaşıyorsa
-- kural değil, öneridir.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- ---------- word_count: istemcideki countWords ile aynı tanım ----------
select is(word_count(null), 0, 'null sıfır kelime');
select is(word_count('   '), 0, 'yalnızca boşluk sıfır kelime');
select is(word_count('bir'), 1, 'tek kelime');
select is(word_count('  bir   iki  üç  '), 3, 'baştaki sondaki ve aradaki fazla boşluk sayılmaz');

-- ---------- arrange ----------
insert into niches (slug, name) values ('gc-niche', 'Guess count');
insert into auth.users (id, email) values
  ('ee555555-0000-0000-0000-00000000000a', 'gc-owner@test.local'),
  ('ee555555-0000-0000-0000-00000000000b', 'gc-reviewer@test.local');

update profiles set niche_id = (select id from niches where slug = 'gc-niche'),
                    onboarding_done = true
 where id::text like 'ee555555%';

insert into channels (profile_id, youtube_url, niche_id)
values ('ee555555-0000-0000-0000-00000000000a', 'https://www.youtube.com/@gc',
        (select id from niches where slug = 'gc-niche'));
insert into credit_ledger (profile_id, delta, reason)
values ('ee555555-0000-0000-0000-00000000000a', 50, 'admin');

insert into submissions (id, owner_id, channel_id, niche_id, language, title_options,
  thumbnail_paths, clip_path, clip_duration_seconds, requested_reviews, status,
  screened_at, closes_at)
values ('ee555555-1111-1111-1111-111111111111', 'ee555555-0000-0000-0000-00000000000a',
  (select id from channels where profile_id = 'ee555555-0000-0000-0000-00000000000a'),
  (select id from niches where slug = 'gc-niche'), 'en', array['Guess count title'],
  array['t/a.jpg'], 'c/a.mp4', 58, 5, 'open', now(), now() + interval '7 days');

insert into review_tasks (id, submission_id, reviewer_id, thumbnail_index, title_index,
  decoys, candidate_position, assigned_at, expires_at, status)
values ('ee555555-2222-2222-2222-222222222222', 'ee555555-1111-1111-1111-111111111111',
  'ee555555-0000-0000-0000-00000000000b', 0, 0, '[]'::jsonb, 0,
  now() - interval '30 seconds', now() + interval '30 minutes', 'assigned');

set local request.jwt.claims to '{"sub":"ee555555-0000-0000-0000-00000000000b","role":"authenticated"}';
set local role authenticated;

-- ---------- test_an_empty_guess_is_rejected ----------
select throws_ok(
  $$select submit_review('ee555555-2222-2222-2222-222222222222'::uuid, true, 2, 900,
      '', 3, 3, array['slow_intro'], null, 30)$$,
  'guess_too_short', 'boş tahmin reddedilir');

-- ---------- test_a_four_word_guess_is_rejected ----------
-- Sınırın hemen altı: kuralın 5'te olduğunu gösterir.
select throws_ok(
  $$select submit_review('ee555555-2222-2222-2222-222222222222'::uuid, true, 2, 900,
      'bu video dört kelime', 3, 3, array['slow_intro'], null, 30)$$,
  'guess_too_short', 'dört kelimelik tahmin reddedilir');

reset role;
select is((select count(*)::int from credit_ledger
            where profile_id = 'ee555555-0000-0000-0000-00000000000b'
              and reason = 'review_reward'),
  0, 'reddedilen istek kredi ödemez');

set local request.jwt.claims to '{"sub":"ee555555-0000-0000-0000-00000000000b","role":"authenticated"}';
set local role authenticated;

-- ---------- test_a_five_word_guess_is_accepted ----------
-- Düzeltme dürüst davranışı bozmamalı: tam sınırdaki tahmin geçerli.
select isnt(
  (select submit_review('ee555555-2222-2222-2222-222222222222'::uuid, true, 2, 900,
      'bu video tam beş kelime', 3, 3, array['slow_intro'], null, 30)),
  null, 'beş kelimelik tahmin kabul edilir');

reset role;
select is((select count(*)::int from credit_ledger
            where profile_id = 'ee555555-0000-0000-0000-00000000000b'
              and reason = 'review_reward'),
  1, 'geçerli değerlendirme kredisini alır');

select * from finish();
rollback;
