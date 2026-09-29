-- 031 — sync_pro_state: kaybolan webhook'un telafisi (0043).
--
-- Sınanan şey, sessiz para kaybının iki yönü:
--   * Kayıp `INITIAL_PURCHASE` → ödeyen kullanıcı Pro olamıyor ve 40 kredisini alamıyor.
--   * `expires_at = null` yazılmış bir satır → `is_pro` null'u "süresiz" sayıyor ve Pro
--     BİR DAHA KAPANMIYOR. Senkron bunu gerçek tarihle değiştirebilmeli.
-- Ayrıca senkronun kredi İKİ KEZ vermediği: aynı ay içinde iki çağrı tek hibe demektir.
begin;
select plan(11);

insert into auth.users (id, email) values
  ('dd000000-0000-0000-0000-000000000001', 'sync-a@test.local'),
  ('dd000000-0000-0000-0000-000000000002', 'sync-b@test.local')
on conflict do nothing;

-- ---------- 1. Hiç Pro olmamış kullanıcı: satır açılmıyor ----------
select is(
  (select sync_pro_state('dd000000-0000-0000-0000-000000000001', false, null) ->> 'wrote'),
  'false',
  'Pro olmayan ve hiç olmamış kullanıcı için abonelik satırı açılmaz'
);
select is(
  (select count(*)::int from subscriptions where profile_id = 'dd000000-0000-0000-0000-000000000001'),
  0,
  've tabloya gerçekten hiçbir şey yazılmaz'
);

-- ---------- 2. Kayıp INITIAL_PURCHASE telafisi ----------
select is(
  (select sync_pro_state(
     'dd000000-0000-0000-0000-000000000001', true, now() + interval '30 days'
   ) ->> 'granted'),
  'true',
  'senkron Pro''yu açıyor ve kaybolan 40 krediyi de yazıyor'
);
select ok(
  is_pro('dd000000-0000-0000-0000-000000000001'),
  'kullanıcı artık Pro'
);
select is(
  (select sum(delta)::int from credit_ledger
    where profile_id = 'dd000000-0000-0000-0000-000000000001' and reason = 'subscription_grant'),
  40,
  'tam olarak 40 kredi'
);

-- ---------- 3. Aynı ay ikinci senkron: kredi TEKRAR verilmiyor ----------
-- Senkron her uygulama açılışında çalışıyor. Korumasız olsaydı uygulamayı günde üç kez
-- açan kullanıcı ayda 90 kredi alırdı.
select is(
  (select sync_pro_state(
     'dd000000-0000-0000-0000-000000000001', true, now() + interval '30 days'
   ) ->> 'granted'),
  'false',
  'ikinci senkron kredi basmıyor'
);
select is(
  (select sum(delta)::int from credit_ledger
    where profile_id = 'dd000000-0000-0000-0000-000000000001' and reason = 'subscription_grant'),
  40,
  've bakiye 40''ta kalıyor'
);

-- ---------- 4. Süresiz kalmış Pro düzeltilebiliyor ----------
-- `expiration_at_ms` taşımayan bir olay `expires_at = null` bırakıyor; `is_pro` bunu
-- "süresiz" sayıyor. Senkron gerçek tarihi yazabilmeli.
insert into subscriptions (profile_id, tier, active, expires_at, source, updated_at)
values ('dd000000-0000-0000-0000-000000000002', 'pro', true, null, 'revenuecat', now())
on conflict (profile_id) do update set active = true, expires_at = null;

select ok(
  is_pro('dd000000-0000-0000-0000-000000000002'),
  'null bitiş tarihi süresiz Pro anlamına geliyor (sızıntının kendisi)'
);
select is(
  (select sync_pro_state(
     'dd000000-0000-0000-0000-000000000002', false, now() - interval '1 day'
   ) ->> 'now'),
  'false',
  'senkron aboneliği kapatıyor'
);
select ok(
  not is_pro('dd000000-0000-0000-0000-000000000002'),
  've kullanıcı artık Pro değil'
);

-- ---------- 5. İstemci bunu kendisi çağıramaz ----------
-- Bu fonksiyon Pro hakkını YAZIYOR. `authenticated` çağırabilseydi herkes kendini Pro
-- yapardı — senkronun tüm anlamı, kararı RevenueCat'e sormasıdır.
select ok(
  not has_function_privilege('authenticated', 'sync_pro_state(uuid, boolean, timestamptz)', 'execute'),
  'authenticated rolü sync_pro_state çağıramaz'
);

select * from finish();
rollback;
