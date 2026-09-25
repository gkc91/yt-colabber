-- 018_multi_channel.sql — bir hesapta birden fazla kanal (0020).
-- Sorular: ikinci kanal açılabiliyor mu, testin nişi PROFİLDEN değil KANALDAN mı
-- okunuyor, birden fazla kanalda seçim zorunlu mu, başkasının kanalına test açılabilir mi,
-- kanal nişi ayda birden sık değiştirilebiliyor mu.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- ---------- arrange ----------
insert into niches (slug, name) values
  ('mc-money', 'Multi niche (money)'),
  ('mc-toons', 'Multi niche (toons)');

insert into auth.users (id, email) values
  ('cc000000-0000-0000-0000-000000000001', 'mc-owner@test.local'),
  ('cc000000-0000-0000-0000-000000000002', 'mc-other@test.local');

-- Profilin nişi bilerek 'mc-money': test kanalın nişini almalı, bunun kopyasını değil.
update profiles set niche_id = (select id from niches where slug = 'mc-money'),
                    onboarding_done = true
  where id in ('cc000000-0000-0000-0000-000000000001',
               'cc000000-0000-0000-0000-000000000002');

set local request.jwt.claims to '{"sub":"cc000000-0000-0000-0000-000000000001","role":"authenticated"}';
set local role authenticated;

-- ---------- test_multi_channel_second_channel_is_allowed ----------
select lives_ok(
  $$select add_channel('https://www.youtube.com/@mc-money', (select id from niches where slug='mc-money'))$$,
  'add_channel: ilk kanal açılır');
select lives_ok(
  $$select add_channel('https://www.youtube.com/@mc-toons', (select id from niches where slug='mc-toons'))$$,
  'add_channel: aynı hesapta ikinci kanal da açılır');

-- ---------- test_multi_channel_submission_needs_a_choice ----------
-- İki kanal varken sessizce birini seçmek, testi yanlış havuza gönderirdi.
select throws_ok(
  $$select create_submission(array['A title that is long enough'], array['thumbs/a.jpg'],
      'clips/a.mp4', 30, 5)$$,
  'channel_required',
  'create_submission: iki kanal varsa kanal seçimi zorunlu');

-- ---------- test_multi_channel_niche_comes_from_the_channel ----------
select create_submission(array['Cartoon title option here'], array['thumbs/b.jpg'],
  'clips/b.mp4', 30, 5,
  (select id from channels where youtube_url = 'https://www.youtube.com/@mc-toons'))
  as toon_submission \gset

select is(
  (select n.slug from submissions s join niches n on n.id = s.niche_id
    where s.id = :'toon_submission'),
  'mc-toons',
  'create_submission: niş kanaldan okunur, profilden değil');

select is(
  (select c.youtube_url from submissions s join channels c on c.id = s.channel_id
    where s.id = :'toon_submission'),
  'https://www.youtube.com/@mc-toons',
  'create_submission: test kendi kanalına bağlanır');

-- ---------- test_multi_channel_cannot_use_someone_elses_channel ----------
-- Kimliği ÖNCEDEN alıyoruz: RLS başkasının kanal satırını gizlediği için alt sorgu
-- null döner ve fonksiyon 'channel_required' der. Asıl soru, kimliği bir şekilde
-- öğrenen birinin o kanala test açıp açamayacağı.
reset role;
insert into channels (profile_id, youtube_url, niche_id)
values ('cc000000-0000-0000-0000-000000000002', 'https://www.youtube.com/@mc-stranger',
        (select id from niches where slug = 'mc-money'))
returning id as stranger_channel \gset

set local request.jwt.claims to '{"sub":"cc000000-0000-0000-0000-000000000001","role":"authenticated"}';
set local role authenticated;

select throws_ok(
  format($$select create_submission(array['Stealing the other channel'], array['thumbs/c.jpg'],
      'clips/c.mp4', 30, 5, %L)$$, :'stranger_channel'),
  'not_owner',
  'create_submission: kimliği bilinse bile başkasının kanalına test açılamaz');

-- ---------- test_multi_channel_niche_change_is_rate_limited ----------
select lives_ok(
  $$select change_channel_niche(
      (select id from channels where youtube_url = 'https://www.youtube.com/@mc-toons'),
      (select id from niches where slug = 'mc-money'))$$,
  'change_channel_niche: ilk değişiklik geçer');
select throws_ok(
  $$select change_channel_niche(
      (select id from channels where youtube_url = 'https://www.youtube.com/@mc-toons'),
      (select id from niches where slug = 'mc-toons'))$$,
  'niche_change_too_soon',
  'change_channel_niche: ayda birden sık değiştirilemez');

select * from finish();
rollback;
