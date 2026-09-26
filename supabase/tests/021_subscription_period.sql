-- 021_subscription_period.sql — Pro kredisi dönem başına bir kez (0027).
--
-- Sorular: satın almada kredi geliyor mu, iptal-vazgeç döngüsü kredi basıyor mu (asıl
-- açık buydu), yenileme yeni dönem açtığı için kredi geliyor mu, kredi paketi bu kuraldan
-- etkileniyor mu.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- ---------- arrange ----------
insert into auth.users (id, email) values
  ('bbbb9999-0000-0000-0000-000000000001', 'sub@test.local');

-- ---------- test_subscription_first_purchase_grants_credits ----------
select grant_purchase('bbbb9999-0000-0000-0000-000000000001', 'evt_initial', 'pro_monthly',
  0, '{"type":"INITIAL_PURCHASE"}'::jsonb, true, now() + interval '30 days');

select is(
  (select coalesce(sum(delta), 0)::int from credit_ledger
    where profile_id = 'bbbb9999-0000-0000-0000-000000000001' and reason = 'subscription_grant'),
  40, 'ilk satın alma: 40 kredi');

-- ---------- test_subscription_uncancel_does_not_grant_again ----------
-- Asıl açık: iptal edip vazgeçmek her seferinde YENİ bir olay kimliği üretir, yani
-- `rc_event_id` tekilliği bunu durdurmuyordu. Dönem değişmediği için kredi de değişmemeli.
select grant_purchase('bbbb9999-0000-0000-0000-000000000001', 'evt_uncancel_1', 'pro_monthly',
  0, '{"type":"UNCANCELLATION"}'::jsonb, true, now() + interval '30 days');
select grant_purchase('bbbb9999-0000-0000-0000-000000000001', 'evt_uncancel_2', 'pro_monthly',
  0, '{"type":"UNCANCELLATION"}'::jsonb, true, now() + interval '30 days');
select grant_purchase('bbbb9999-0000-0000-0000-000000000001', 'evt_uncancel_3', 'pro_monthly',
  0, '{"type":"UNCANCELLATION"}'::jsonb, true, now() + interval '30 days');

select is(
  (select coalesce(sum(delta), 0)::int from credit_ledger
    where profile_id = 'bbbb9999-0000-0000-0000-000000000001' and reason = 'subscription_grant'),
  40, 'üç kez iptal-vazgeç: kredi hâlâ 40');

-- ---------- test_subscription_renewal_opens_a_new_period ----------
select grant_purchase('bbbb9999-0000-0000-0000-000000000001', 'evt_renewal', 'pro_monthly',
  0, '{"type":"RENEWAL"}'::jsonb, true, now() + interval '60 days');

select is(
  (select coalesce(sum(delta), 0)::int from credit_ledger
    where profile_id = 'bbbb9999-0000-0000-0000-000000000001' and reason = 'subscription_grant'),
  80, 'yenileme yeni dönem açar: +40');

select is(
  (select count(*)::int from credit_ledger
    where profile_id = 'bbbb9999-0000-0000-0000-000000000001' and reason = 'subscription_grant'),
  2, 'iki dönem, iki satır — ara olaylar satır açmadı');

-- ---------- test_subscription_period_is_recorded ----------
select is(
  (select credits_granted_for = expires_at from subscriptions
    where profile_id = 'bbbb9999-0000-0000-0000-000000000001'),
  true, 'kredinin yazıldığı dönem abonelik satırında duruyor');

-- ---------- test_subscription_credit_pack_is_unaffected ----------
-- Paket satın alma abonelik kuralına takılmamalı: ayrı ürün, ayrı sebep.
select grant_purchase('bbbb9999-0000-0000-0000-000000000001', 'evt_pack', 'credits_30',
  30, '{"type":"NON_RENEWING_PURCHASE"}'::jsonb);

select is(
  (select coalesce(sum(delta), 0)::int from credit_ledger
    where profile_id = 'bbbb9999-0000-0000-0000-000000000001' and reason = 'purchase'),
  30, 'kredi paketi dönem kuralından etkilenmez');

-- ---------- test_subscription_function_is_service_role_only ----------
select ok(
  not has_function_privilege('authenticated',
    'grant_purchase(uuid, text, text, int, jsonb, boolean, timestamptz)', 'execute'),
  'kullanıcılar kendilerine kredi yazamaz');

select * from finish();
rollback;
