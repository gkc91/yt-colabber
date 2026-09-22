-- 002_rls.sql — kullanıcılar birbirinin kredi/profil verisini göremez.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- arrange: iki kullanıcı (her biri 5 kredi signup bonus ile)
insert into auth.users (id, email) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'a@test.local'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.local');

-- test_rls_profile_balances_view_respects_ledger_rls (0003 regresyonu)
select is(
  (select pg_catalog.array_to_string(reloptions, ',') from pg_class where oid = 'public.profile_balances'::regclass),
  'security_invoker=true', 'profile_balances: security_invoker açık');

set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}';
set local role authenticated;

select is(
  (select count(*)::int from profile_balances where profile_id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  0, 'profile_balances: başkasının bakiyesi görünmez');
select is(
  (select balance from profile_balances where profile_id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  5, 'profile_balances: kendi bakiyesi görünür');

-- test_rls_ledger_and_profiles_are_self_only
select is(
  (select count(*)::int from credit_ledger where profile_id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  0, 'credit_ledger: başkasının ledger satırları görünmez');
select is(
  (select count(*)::int from profiles where id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  0, 'profiles: başkasının profili görünmez');

-- anon hiçbir bakiye göremez
reset role;
set local request.jwt.claims to '{"role":"anon"}';
set local role anon;
select is((select count(*)::int from profile_balances), 0, 'profile_balances: anon hiçbir satır görmez');

select * from finish();
rollback;
