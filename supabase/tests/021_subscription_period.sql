-- 021_subscription_period.sql — Pro kredisi 30 günde bir (0027, 0028).
--
-- Sorular: satın almada kredi hemen geliyor mu, iptal-vazgeç döngüsü kredi basıyor mu
-- (asıl açık buydu), 30 gün geçince aylık tur kredi yazıyor mu, YILLIK abone de aylık
-- alıyor mu (kural faturaya değil geçen zamana bağlı), kredi paketi etkileniyor mu.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

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

-- ---------- test_subscription_monthly_round_waits_thirty_days ----------
select is(grant_monthly_pro_credits(), 0,
  'aylık tur: 30 gün dolmadan kredi yazmaz');

-- Zamanı ileri almak yerine ledger satırını geriye alıyoruz: transaction içinde now()
-- sabit, yani "30 gün sonra" ancak böyle kurulabiliyor.
update credit_ledger set created_at = now() - interval '31 days'
 where profile_id = 'bbbb9999-0000-0000-0000-000000000001' and reason = 'subscription_grant';

select is(grant_monthly_pro_credits(), 1,
  'aylık tur: 30 gün geçince kredi yazar');

select is(
  (select coalesce(sum(delta), 0)::int from credit_ledger
    where profile_id = 'bbbb9999-0000-0000-0000-000000000001' and reason = 'subscription_grant'),
  80, 'ikinci ay: toplam 80 kredi');

-- ---------- test_subscription_yearly_gets_monthly_credits ----------
-- Yıllık plan "aylığın ucuz hâli": yenileme yılda bir gelir ama kredi aylık akmalı.
-- Kural faturaya değil geçen zamana baktığı için ürün adının hiçbir önemi yok.
insert into auth.users (id, email) values
  ('bbbb9999-0000-0000-0000-000000000002', 'yearly@test.local');
select grant_purchase('bbbb9999-0000-0000-0000-000000000002', 'evt_yearly', 'pro_yearly',
  0, '{"type":"INITIAL_PURCHASE"}'::jsonb, true, now() + interval '365 days');

update credit_ledger set created_at = now() - interval '31 days'
 where profile_id = 'bbbb9999-0000-0000-0000-000000000002' and reason = 'subscription_grant';

select is(grant_monthly_pro_credits(), 1,
  'yıllık abone de 30 gün sonra kredi alır');

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

select ok(
  not has_function_privilege('authenticated', 'grant_pro_credits(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'grant_monthly_pro_credits()', 'execute'),
  'aylık kredi fonksiyonları da yalnızca service role');

select * from finish();
rollback;
