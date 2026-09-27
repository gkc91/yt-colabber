-- 0028 — Pro kredisi faturaya değil geçen zamana bağlı: aktif olduğu her 30 günde 40.
--
-- Karar (2026-09-27, sahibi): yıllık plan "aylığın %20 indirimli hâli" olacak, gerisi aynı.
-- "Gerisi aynı" krediyi de kapsıyor. 0027'nin dönem kuralı bunu veremezdi: yıllık abonede
-- yenileme olayı yılda bir gelir, yani yılda 40 kredi — aylık ödeyenin 480'ine karşı.
--
-- Yeni kural tek cümle: Pro aktifken son 30 gün içinde kredi yazılmamışsa 40 yaz. Faturanın
-- nasıl kesildiğiyle ilgilenmiyor.
--
-- İki yerden tetikleniyor, ikisi de AYNI korumayı kullanıyor:
--   * satın alma anında (grant_purchase) — insan parayı verince kredisini hemen görsün,
--     cron'un ertesi sabahını beklemesin
--   * günlük cron — sonraki ayları getirir, RENEWAL olayına hiç bağımlı değil
--
-- Koruma ledger'ın kendisinde: `credit_ledger` append-only ve zaten her grant'i tarihiyle
-- tutuyor. 0027'deki `credits_granted_for` sütunu ikinci bir doğruluk kaynağıydı ve iki
-- kaynak birbirinden ayrılmaya başladığı gün hata orada çıkardı — kaldırılıyor.
--
-- İptal-vazgeç açığı (0027) da kapalı kalıyor: döngü 30 gün içinde olduğu için kredi yok.

alter table subscriptions drop column credits_granted_for;

create or replace function grant_pro_credits(p_profile uuid) returns boolean
language plpgsql security definer set search_path = public as $fn$
begin
  if not is_pro(p_profile) then return false; end if;
  if exists (
    select 1 from credit_ledger
    where profile_id = p_profile and reason = 'subscription_grant'
      and created_at > now() - interval '30 days'
  ) then
    return false;
  end if;

  insert into credit_ledger (profile_id, delta, reason, note)
  values (p_profile, 40, 'subscription_grant', 'monthly');
  return true;
end $fn$;

revoke execute on function grant_pro_credits from public, anon, authenticated;

create or replace function grant_purchase(
  p_profile uuid, p_rc_event_id text, p_product text, p_credits int, p_raw jsonb,
  p_pro_active boolean default null, p_pro_expires timestamptz default null
) returns void language plpgsql security definer set search_path = public as $fn$
begin
  insert into purchases (profile_id, rc_event_id, product_id, credits, raw)
  values (p_profile, p_rc_event_id, p_product, p_credits, p_raw)
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

-- ---------- aylık tur ----------
create or replace function grant_monthly_pro_credits() returns int
language plpgsql security definer set search_path = public as $fn$
declare v_count int := 0; v_profile uuid;
begin
  for v_profile in
    select profile_id from subscriptions
    where tier = 'pro' and active and (expires_at is null or expires_at > now())
  loop
    if grant_pro_credits(v_profile) then v_count := v_count + 1; end if;
  end loop;
  return v_count;
end $fn$;

revoke execute on function grant_monthly_pro_credits from public, anon, authenticated;

-- Günde bir kez yeter: koruma 30 güne bakıyor, saat değil. Sabaha karşı, kullanıcı
-- uygulamayı açmadan önce.
select cron.schedule('grant_monthly_pro_credits', '0 5 * * *',
  $$select grant_monthly_pro_credits()$$);
