-- 033 — Collab bildirimleri (0045).
--
-- Sınanan asıl şey SIKLIK SINIRI: her mesaja bir push atmak, 20 mesajlık bir konuşmayı
-- 20 bildirime çevirir ve insanlar bildirimleri kapatır. Ayrıca eşleşmenin İKİ tarafa da
-- haber verdiği (ilk beğenen kişi günler önce beğenmiş olabilir) ve aynı kişiyi tekrar
-- beğenmenin ikinci bir bildirim üretmediği.
--
-- SAYIMLAR KİMİN GÖZÜNDEN YAPILIYORSA ONA AİT: `notifications` üzerinde
-- "notifications self read" politikası var, yani her kullanıcı yalnızca kendi satırlarını
-- görür. "İki tarafa da gitti" iddiası bu yüzden iki ayrı oturumdan ayrı ayrı sınanıyor —
-- tek oturumdan `count(*) = 2` beklemek, testin göremediği bir satırı beklemek olurdu.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('dd100000-0000-0000-0000-000000000001', 'notif-a@test.local'),
  ('dd100000-0000-0000-0000-000000000002', 'notif-b@test.local');

insert into niches (slug, name) values ('test-collab-notif', 'Test niche (collab notif)');

update profiles
   set niche_id = (select id from niches where slug = 'test-collab-notif'),
       language = 'en', onboarding_done = true, display_name = 'N' || right(id::text, 1)
 where id::text like 'dd100000-0000-0000-0000-00000000000_';

insert into channels (profile_id, youtube_url, channel_title, niche_id, band)
select id, 'https://www.youtube.com/@n' || right(id::text, 1), 'N' || right(id::text, 1),
       (select id from niches where slug = 'test-collab-notif'), 'b1k_10k'
  from profiles where id::text like 'dd100000-0000-0000-0000-00000000000_';

insert into collab_profiles (profile_id, is_open, types)
select id, true, array['joint_video']::collab_type[]
  from profiles where id::text like 'dd100000-0000-0000-0000-00000000000_';

set local request.jwt.claims to '{"sub":"dd100000-0000-0000-0000-000000000001","role":"authenticated"}';
set local role authenticated;

-- ---------- 1. Tek taraflı beğeni bildirim üretmez ----------
select is(collab_like('dd100000-0000-0000-0000-000000000002'), null, 'ön koşul: tek taraflı beğeni');
select is(
  (select count(*)::int from notifications where kind = 'collab_match'),
  0,
  'tek taraflı beğeni eşleşme bildirimi üretmiyor'
);

-- ---------- 2. Karşılıklı beğeni İKİ tarafa da bildiriyor ----------
set local request.jwt.claims to '{"sub":"dd100000-0000-0000-0000-000000000002","role":"authenticated"}';
select isnt(collab_like('dd100000-0000-0000-0000-000000000001'), null, 'ön koşul: eşleşme kuruldu');
select is(
  (select count(*)::int from notifications where kind = 'collab_match'),
  1,
  'eşleşmeyi tamamlayan kişi bildirim alıyor'
);

set local request.jwt.claims to '{"sub":"dd100000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  (select count(*)::int from notifications where kind = 'collab_match'),
  1,
  've günler önce beğenmiş olan diğer taraf da alıyor (asıl haberi olmayan o)'
);

-- ---------- 3. Tekrar beğenmek ikinci bir bildirim üretmiyor ----------
-- `collab_like` çakışmada `do update` yapıyor; insert tetikleyicisi o yolda çalışmamalı.
set local request.jwt.claims to '{"sub":"dd100000-0000-0000-0000-000000000002","role":"authenticated"}';
select lives_ok(
  $$select collab_like('dd100000-0000-0000-0000-000000000001')$$,
  'ön koşul: aynı kişi tekrar beğenildi'
);
set local request.jwt.claims to '{"sub":"dd100000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  (select count(*)::int from notifications where kind = 'collab_match'),
  1,
  'tekrar beğenmek ikinci bir eşleşme bildirimi üretmiyor'
);

create temp table t_match as select id from collab_matches limit 1;

-- ---------- 4. İlk mesaj KARŞI tarafa bildiriliyor ----------
set local request.jwt.claims to '{"sub":"dd100000-0000-0000-0000-000000000002","role":"authenticated"}';
select lives_ok($$select send_message((select id from t_match), 'first')$$, 'ön koşul: ilk mesaj');
select is(
  (select count(*)::int from notifications where kind = 'collab_message'),
  0,
  'gönderene kendi mesajı bildirilmiyor'
);

set local request.jwt.claims to '{"sub":"dd100000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  (select count(*)::int from notifications where kind = 'collab_message'),
  1,
  'karşı taraf ilk mesaj için bildirim alıyor'
);

-- ---------- 5. Arkasından gelen mesajlar bildirim yağdırmıyor ----------
-- Beş mesaj daha, `send_message` üzerinden: `messages` tablosuna doğrudan insert RLS'e
-- takılır, çünkü yazma yolu bilerek yalnızca fonksiyondan geçiyor.
-- 15 dakika sabiti bilerek koddan türetilmiyor: sınırı sınadığı koddan okuyan bir test,
-- sınır kaldırıldığında kendisi de uyum sağlayıp geçer (0040'ın dersi).
set local request.jwt.claims to '{"sub":"dd100000-0000-0000-0000-000000000002","role":"authenticated"}';
select lives_ok(
  $$select send_message((select id from t_match), 'more ' || g) from generate_series(1, 5) g$$,
  'ön koşul: beş mesaj daha'
);

set local request.jwt.claims to '{"sub":"dd100000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  (select count(*)::int from notifications where kind = 'collab_message'),
  1,
  '15 dakika içindeki beş mesaj daha tek bildirim olarak kalıyor'
);

rollback;
