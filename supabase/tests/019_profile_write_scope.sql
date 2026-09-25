-- 019_profile_write_scope.sql — profilde client'ın neyi yazabildiği (0021).
-- Sorular: niş doğrudan UPDATE ile değiştirilebiliyor mu (change_niche'in aylık kuralı
-- delinir), sayaçlar ve cihaz listesi yazılabiliyor mu, kullanıcının kendi alanları hâlâ
-- yazılabiliyor mu (kilidi fazla sıkmadık mı).
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- ---------- arrange ----------
insert into niches (slug, name) values ('pw-one', 'Scope one'), ('pw-two', 'Scope two');
insert into auth.users (id, email) values
  ('ee000000-0000-0000-0000-000000000001', 'pw-user@test.local');

set local request.jwt.claims to '{"sub":"ee000000-0000-0000-0000-000000000001","role":"authenticated"}';
set local role authenticated;

-- ---------- test_profile_scope_initial_niche_is_allowed_once ----------
select lives_ok(
  $$select set_initial_niche((select id from niches where slug='pw-one'), 'en')$$,
  'set_initial_niche: ilk niş seçilebilir');
select is(
  (select n.slug from profiles p join niches n on n.id = p.niche_id
    where p.id = 'ee000000-0000-0000-0000-000000000001'),
  'pw-one', 'set_initial_niche: niş profile yazıldı');

-- ---------- test_profile_scope_second_call_is_a_niche_change ----------
select throws_ok(
  $$select set_initial_niche((select id from niches where slug='pw-two'), 'en')$$,
  'use_change_niche',
  'set_initial_niche: ikinci kez farklı niş kabul edilmez, kural change_niche''de');

-- ---------- test_profile_scope_direct_niche_update_is_rejected ----------
-- Asıl açık buydu: tek UPDATE ile "ayda bir" kuralı aşılıyordu.
select throws_ok(
  $$update profiles set niche_id = (select id from niches where slug='pw-two')
     where id = 'ee000000-0000-0000-0000-000000000001'$$,
  '42501', null,
  'profiles: niş doğrudan UPDATE ile değiştirilemez');

-- ---------- test_profile_scope_counters_are_server_owned ----------
select throws_ok(
  $$update profiles set reviews_given = 999
     where id = 'ee000000-0000-0000-0000-000000000001'$$,
  '42501', null,
  'profiles: değerlendirme sayacı client''tan yazılamaz');

-- ---------- test_profile_scope_own_fields_still_writable ----------
-- Kilidi fazla sıkarsak ad değiştirmek ya da push token yazmak da kırılır.
select lives_ok(
  $$update profiles set display_name = 'Yeni Ad', expo_push_token = 'ExponentPushToken[x]'
     where id = 'ee000000-0000-0000-0000-000000000001'$$,
  'profiles: ad ve push token kullanıcıya ait, yazılabilir');

select * from finish();
rollback;
