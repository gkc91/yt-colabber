-- 032 — Collab modülü (0002 + 0044). Modülün ilk testi: 0002'den beri hiç testi yoktu.
--
-- Sınanan asıl şey, engellemenin BİR SÖZ OLUP OLMADIĞI. 0044 öncesi engelleme yalnızca
-- aday listesini süzüyordu; beğeni, eşleşme ve mesaj yollarında hiç kontrol edilmiyordu.
-- Ayrıca "geç"in kalıcı olduğu, eşleşme listesinin karşı tarafın adını verebildiği
-- (`profiles` "yalnızca kendini oku" politikasında) ve raporun kendi mesajına işlemediği.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

-- ---------- arrange ----------
-- 01 ben · 02 eşleşeceğim kişi · 03 engelleyeceğim kişi · 04 geçeceğim kişi
insert into auth.users (id, email) values
  ('cc000000-0000-0000-0000-000000000001', 'collab-me@test.local'),
  ('cc000000-0000-0000-0000-000000000002', 'collab-match@test.local'),
  ('cc000000-0000-0000-0000-000000000003', 'collab-blocked@test.local'),
  ('cc000000-0000-0000-0000-000000000004', 'collab-passed@test.local');

insert into niches (slug, name) values ('test-collab', 'Test niche (collab)');

update profiles
   set niche_id = (select id from niches where slug = 'test-collab'),
       language = 'en', onboarding_done = true, display_name = 'Creator ' || right(id::text, 1)
 where id::text like 'cc000000-0000-0000-0000-00000000000_';

-- Hepsi aynı bantta: aday kuralı bandın ±1 içinde olmasını istiyor.
insert into channels (profile_id, youtube_url, channel_title, niche_id, band)
select id, 'https://www.youtube.com/@c' || right(id::text, 1), 'Channel ' || right(id::text, 1),
       (select id from niches where slug = 'test-collab'), 'b1k_10k'
  from profiles where id::text like 'cc000000-0000-0000-0000-00000000000_';

insert into collab_profiles (profile_id, is_open, types, bio)
select id, true, array['joint_video']::collab_type[], 'bio ' || right(id::text, 1)
  from profiles where id::text like 'cc000000-0000-0000-0000-00000000000_';

-- ---------- 1. Aday listesi ----------
set local request.jwt.claims to '{"sub":"cc000000-0000-0000-0000-000000000001","role":"authenticated"}';
set local role authenticated;

select is(
  (select count(*)::int from jsonb_array_elements(collab_candidates(50))),
  3,
  'aday listesi aynı niş/dil/banttaki diğer üç kişiyi getiriyor'
);

-- ---------- 2. "Geç" kalıcı ----------
select lives_ok(
  $$select collab_pass('cc000000-0000-0000-0000-000000000004')$$,
  'geçmek hata vermiyor'
);
select is(
  (select count(*)::int from jsonb_array_elements(collab_candidates(50)) e
    where e ->> 'id' = 'cc000000-0000-0000-0000-000000000004'),
  0,
  'geçilen kişi bir daha aday listesinde çıkmıyor'
);

-- ---------- 3. Engelleme iki yönlü ----------
select lives_ok(
  $$select collab_block('cc000000-0000-0000-0000-000000000003')$$,
  'engellemek hata vermiyor'
);
select is(
  (select count(*)::int from jsonb_array_elements(collab_candidates(50)) e
    where e ->> 'id' = 'cc000000-0000-0000-0000-000000000003'),
  0,
  'engellenen kişi aday listesinde görünmüyor'
);
select throws_ok(
  $$select collab_like('cc000000-0000-0000-0000-000000000003')$$,
  'blocked',
  'engellediğim kişiyi beğenemiyorum'
);

-- Asıl sınav: engeli KARŞI TARAF görmüyor ama ona da uygulanıyor mu?
set local request.jwt.claims to '{"sub":"cc000000-0000-0000-0000-000000000003","role":"authenticated"}';
select throws_ok(
  $$select collab_like('cc000000-0000-0000-0000-000000000001')$$,
  'blocked',
  'engellenen kişi de beni beğenemiyor (engelleme iki yönlü)'
);
select is(
  (select count(*)::int from jsonb_array_elements(collab_candidates(50)) e
    where e ->> 'id' = 'cc000000-0000-0000-0000-000000000001'),
  0,
  've beni aday listesinde hiç görmüyor'
);

-- ---------- 4. Eşleşme ----------
set local request.jwt.claims to '{"sub":"cc000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  collab_like('cc000000-0000-0000-0000-000000000002'),
  null,
  'tek taraflı beğeni eşleşme kurmuyor'
);

set local request.jwt.claims to '{"sub":"cc000000-0000-0000-0000-000000000002","role":"authenticated"}';
select isnt(
  collab_like('cc000000-0000-0000-0000-000000000001'),
  null,
  'karşılıklı beğeni eşleşme kuruyor'
);
select is(
  (select count(*)::int from collab_matches),
  1,
  'tek eşleşme satırı (a_id < b_id kısıtı ikinci bir satırı imkânsız kılıyor)'
);

-- Eşleşme kimliğini geçici tabloya al: RLS'i olmayan biri (04) aşağıda bunu kullanacak.
-- Doğrudan `select id from collab_matches` yazsaydık 04 için NULL dönerdi ve test,
-- üyelik kontrolü hiç olmasa bile geçerdi — yani hiçbir şey sınamazdı.
create temp table t_match as select id from collab_matches limit 1;

-- ---------- 5. Eşleşme listesi karşı tarafın adını verebiliyor ----------
set local request.jwt.claims to '{"sub":"cc000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  (select count(*)::int from profiles where id = 'cc000000-0000-0000-0000-000000000002'),
  0,
  'ön koşul: karşı tarafın profilini DOĞRUDAN okuyamıyorum (profiles yalnızca kendini oku)'
);
select is(
  (select e ->> 'display_name' from jsonb_array_elements(collab_matches_list()) e limit 1),
  'Creator 2',
  'ama eşleşme listesi adını veriyor (security definer''ın var oluş sebebi)'
);
select is(
  (select e ->> 'channel_title' from jsonb_array_elements(collab_matches_list()) e limit 1),
  'Channel 2',
  've kanal adını'
);

-- ---------- 6. Mesaj ----------
select lives_ok(
  $$select send_message((select id from t_match), 'hi')$$,
  'eşleştiğim kişiye mesaj atabiliyorum'
);
select is(
  (select count(*)::int from messages),
  1,
  'mesaj yazıldı'
);

set local request.jwt.claims to '{"sub":"cc000000-0000-0000-0000-000000000004","role":"authenticated"}';
select throws_ok(
  $$select send_message((select id from t_match), 'let me in')$$,
  'not_in_match',
  'eşleşmede olmayan kişi o sohbete yazamıyor'
);

-- ---------- 7. Okundu ----------
set local request.jwt.claims to '{"sub":"cc000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  (select (e ->> 'unread')::int from jsonb_array_elements(collab_matches_list()) e limit 1),
  0,
  'kendi mesajım bana okunmamış sayılmıyor'
);
set local request.jwt.claims to '{"sub":"cc000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is(
  (select (e ->> 'unread')::int from jsonb_array_elements(collab_matches_list()) e limit 1),
  1,
  'karşı taraf için bir okunmamış mesaj var'
);
select lives_ok(
  $$select collab_mark_read((select id from t_match))$$,
  'okundu işaretlenebiliyor'
);
select is(
  (select (e ->> 'unread')::int from jsonb_array_elements(collab_matches_list()) e limit 1),
  0,
  've sayaç sıfırlanıyor'
);

-- ---------- 8. Rapor ----------
-- Şu an 02'yiz ve tek mesajı 01 yazmıştı: karşı tarafın mesajını raporlamak geçerli.
select lives_ok(
  $$select report_message((select id from messages limit 1), 'spam')$$,
  'karşı tarafın mesajı raporlanabiliyor'
);
set local request.jwt.claims to '{"sub":"cc000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$select report_message((select id from messages limit 1), 'spam')$$,
  'own_message',
  'kendi mesajını raporlayamıyorsun'
);

-- ---------- 9. Engellenen eşleşme sohbete kapanıyor ----------
select lives_ok(
  $$select collab_block('cc000000-0000-0000-0000-000000000002')$$,
  'eşleştiğim kişiyi engelleyebiliyorum'
);
select is(
  (select count(*)::int from jsonb_array_elements(collab_matches_list())),
  0,
  'engellenen eşleşme listede görünmüyor'
);
select throws_ok(
  $$select send_message((select id from t_match), 'still here')$$,
  'blocked',
  've o sohbete artık yazılamıyor (eşleşme satırı duruyor, sohbet kapalı)'
);

rollback;
