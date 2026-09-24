-- 013_purchases.sql — satın alma → kredi/abonelik (D1, grant_purchase).
-- Sorular: aynı olay iki kez gelirse kredi iki kez yazılır mı, Pro açılınca aylık kredi
-- geliyor mu, süresi dolunca kapanıyor mu, kullanıcı bu fonksiyonu çağırabilir mi.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

-- ---------- arrange ----------
insert into auth.users (id, email) values
  ('aaaa9999-0000-0000-0000-000000000001', 'buyer@test.local');

-- ---------- test_grant_purchase_credits_are_written_once ----------
select lives_ok(
  $$select grant_purchase('aaaa9999-0000-0000-0000-000000000001', 'evt_credits_1', 'credits_30',
      30, '{"type":"NON_RENEWING_PURCHASE"}'::jsonb)$$,
  'kredi paketi işlenir');

select is(
  (select coalesce(sum(delta), 0)::int from credit_ledger
    where profile_id = 'aaaa9999-0000-0000-0000-000000000001' and reason = 'purchase'),
  30, 'credits_30 → +30 kredi');

-- aynı olay tekrar (RevenueCat yeniden denerse)
select lives_ok(
  $$select grant_purchase('aaaa9999-0000-0000-0000-000000000001', 'evt_credits_1', 'credits_30',
      30, '{"type":"NON_RENEWING_PURCHASE"}'::jsonb)$$,
  'aynı olay tekrar gelince hata vermez');

select is(
  (select coalesce(sum(delta), 0)::int from credit_ledger
    where profile_id = 'aaaa9999-0000-0000-0000-000000000001' and reason = 'purchase'),
  30, 'aynı rc_event_id ikinci kez kredi yazmaz (idempotent)');

select is(
  (select count(*)::int from purchases where rc_event_id = 'evt_credits_1'),
  1, 'purchases tablosunda tek satır kalır');

-- ---------- test_pro_purchase_activates_and_grants_monthly_credits ----------
select lives_ok(
  $$select grant_purchase('aaaa9999-0000-0000-0000-000000000001', 'evt_pro_1', 'pro_monthly',
      0, '{"type":"INITIAL_PURCHASE"}'::jsonb, true, now() + interval '30 days')$$,
  'Pro satın alma işlenir');

select ok(
  is_pro('aaaa9999-0000-0000-0000-000000000001'),
  'Pro hakkı açılır');

select is(
  (select coalesce(sum(delta), 0)::int from credit_ledger
    where profile_id = 'aaaa9999-0000-0000-0000-000000000001' and reason = 'subscription_grant'),
  40, 'Pro aylık 40 kredi getirir (PRODUCT §8)');

-- ---------- test_expiration_closes_pro ----------
do $$ begin
  perform grant_purchase('aaaa9999-0000-0000-0000-000000000001', 'evt_pro_expire', 'pro_monthly',
    0, '{"type":"EXPIRATION"}'::jsonb, false, now());
end $$;

select ok(
  not is_pro('aaaa9999-0000-0000-0000-000000000001'),
  'EXPIRATION Pro hakkını kapatır');

-- ---------- test_grant_purchase_is_service_role_only ----------
select ok(
  not has_function_privilege('authenticated',
    'grant_purchase(uuid, text, text, int, jsonb, boolean, timestamptz)', 'execute'),
  'kullanıcı kendine kredi yazdıramaz');

select * from finish();
rollback;
