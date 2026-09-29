-- 0043 — Kaybolan bir webhook'u telafi edecek yol: durumu RevenueCat'ten sunucu çeksin.
--
-- SORUN. `grant_purchase` yalnızca webhook ile çağrılıyor. Webhook tek yönlü: RevenueCat
-- 2xx alamazsa tekrar dener ama sonsuza kadar denemez. Kalıcı olarak kaybolursa:
--   * `INITIAL_PURCHASE` kayıpsa → kullanıcı ödedi, Pro açılmadı, 40 kredi de yazılmadı.
--   * `RENEWAL` kayıpsa → ödeyen kullanıcının Pro'su dönem sonunda sessizce düşer.
--   * Olay `expiration_at_ms` taşımıyorsa → `expires_at = null` yazılıyor ve `is_pro`
--     null'u "süresiz" saydığı için Pro BİR DAHA KAPANMAZ. Bu doğrudan para kaybı.
-- Bugün bunların hiçbirini yakalayan bir şey yok.
--
-- KASITLI OLARAK YAPILMADI: süresi geçmiş abonelikleri kapatan bir cron. Gerek yok —
-- `is_pro` zaten `expires_at > now()` kontrol ediyor, yani kaybolan bir `EXPIRATION`
-- kendiliğinden doğru sonucu veriyor. (İlk analizimde bunu kaçırıp "Pro sonsuza kadar
-- açık kalır" demiştim; koda bakınca yanlış olduğu görüldü. Asıl açık, yukarıdaki null.)
--
-- ÇÖZÜM. `sync_pro_state`: RevenueCat'in yetkili cevabını yazan tek giriş. Kimin çağırdığı
-- önemli — bunu İSTEMCİ ÇAĞIRAMAZ. Uygulama yalnızca "beni senkronize et" diyebilir;
-- RevenueCat'e SUNUCU sorar (sync-entitlements edge function'ı), cevabı buraya yazar.
-- Telefonun "ben Pro'yum" demesinin hiçbir hükmü yok (CLAUDE.md: doğrulama sunucuda).

-- ---------- tek seferlik satın almalar için ortak tekillik anahtarı ----------
-- Webhook `event.id` ile tekilleştiriyor, ama RevenueCat'in API'si olayları değil İŞLEMLERİ
-- döndürüyor. İki yolun aynı satın almayı iki kez kredilendirmemesi için ortak bir anahtar
-- gerekiyor: RevenueCat'in işlem kimliği. Şimdilik yalnızca YAZILIYOR; buradan kredi
-- basılmıyor (sebebi sync-entitlements/index.ts'te yazılı).
alter table purchases add column if not exists rc_transaction_id text;
create unique index if not exists purchases_rc_transaction_id_key
  on purchases (rc_transaction_id) where rc_transaction_id is not null;

-- ---------- grant_purchase: işlem kimliğini de sakla ----------
-- Parametre EKLENEMEZ, değiştirilmeli: varsayılanlı yeni bir aşırı yükleme eklersek eski
-- 7 argümanlı çağrı iki imzaya birden uyar ve Postgres "ambiguous" der.
drop function if exists grant_purchase(uuid, text, text, int, jsonb, boolean, timestamptz);

create or replace function grant_purchase(
  p_profile uuid, p_rc_event_id text, p_product text, p_credits int, p_raw jsonb,
  p_pro_active boolean default null, p_pro_expires timestamptz default null,
  p_rc_txn text default null
) returns void language plpgsql security definer set search_path = public as $fn$
begin
  insert into purchases (profile_id, rc_event_id, product_id, credits, raw, rc_transaction_id)
  values (p_profile, p_rc_event_id, p_product, p_credits, p_raw, p_rc_txn)
  on conflict (rc_event_id) do nothing;
  if not found then return; end if; -- idempotent

  if p_credits > 0 then
    insert into credit_ledger (profile_id, delta, reason, note)
    values (p_profile, p_credits, 'purchase', p_product);
  end if;

  if p_pro_active is not null then
    insert into subscriptions (profile_id, tier, active, expires_at, source, updated_at)
    values (p_profile, 'pro', p_pro_active, p_pro_expires, 'revenuecat', now())
    on conflict (profile_id) do update
      set tier = 'pro', active = excluded.active, expires_at = excluded.expires_at,
          updated_at = now();

    -- Abonelik satırı YAZILDIKTAN sonra: is_pro() ona bakıyor.
    if p_pro_active and p_product like 'pro_%' then
      perform grant_pro_credits(p_profile);
    end if;
  end if;
end $fn$;

revoke execute on function grant_purchase from public, anon, authenticated;

-- ---------- RevenueCat'in yetkili cevabını yaz ----------
--
-- Dönen jsonb teşhis içindir: ne olduğunu ekrana değil KAYDA yazabilmek için. "Hiçbir şey
-- değişmedi" ile "Pro yeni açıldı" arasındaki farkı göremezsek, senkronun çalışıp
-- çalışmadığını da göremeyiz.
create or replace function sync_pro_state(
  p_profile uuid, p_active boolean, p_expires timestamptz
) returns jsonb language plpgsql security definer set search_path = public as $fn$
declare v_before boolean; v_granted boolean := false;
begin
  select active into v_before from subscriptions where profile_id = p_profile;

  -- Pro olmamış ve hâlâ değilse satır açmaya gerek yok: uygulamayı açan herkes için
  -- `active=false` satırı üretmek tabloyu kullanıcı sayısı kadar şişirirdi.
  if not p_active and v_before is null then
    return jsonb_build_object('was', null, 'now', false, 'granted', false, 'wrote', false);
  end if;

  insert into subscriptions (profile_id, tier, active, expires_at, source, updated_at)
  values (p_profile, 'pro', p_active, p_expires, 'revenuecat', now())
  on conflict (profile_id) do update
    set tier = 'pro', active = excluded.active, expires_at = excluded.expires_at,
        source = 'revenuecat', updated_at = now();

  -- Kaybolan `INITIAL_PURCHASE`, kullanıcının 40 kredisini de götürmüştü. Burada telafi
  -- ediliyor ve İKİ KEZ VERİLMİYOR: grant_pro_credits 30 günlük koruma ve profil başına
  -- danışma kilidiyle korunuyor (0042). Tüketilebilir kredilerde aynı güvence YOK, o
  -- yüzden onlar bu yoldan basılmıyor.
  if p_active then v_granted := grant_pro_credits(p_profile); end if;

  return jsonb_build_object(
    'was', v_before, 'now', p_active, 'granted', v_granted, 'wrote', true
  );
end $fn$;

-- Yalnızca service_role (edge function) çağırabilir. İstemci kendi Pro durumunu yazamaz.
revoke execute on function sync_pro_state from public, anon, authenticated;
