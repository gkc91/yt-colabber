-- 0027 — Pro kredisi dönem başına bir kez.
--
-- Bulgu (2026-09-26, sahibin sorusu üzerine): `grant_purchase` Pro'yu aktive eden HER
-- olayda 40 kredi yazıyordu. Webhook'un aktive edici listesi dört olay içeriyor:
-- INITIAL_PURCHASE, RENEWAL, UNCANCELLATION, PRODUCT_CHANGE. İlk ikisi yeni bir ödenmiş
-- dönem açar, diğer ikisi açmaz.
--
-- `purchases.rc_event_id` tekil olduğu için aynı olay iki kez işlenmiyordu — ama iptal
-- edip vazgeçmek HER SEFERİNDE yeni bir olay kimliği üretir. Ay içinde iptal → vazgeç
-- döngüsüyle tek ödemeyle sınırsız 40'lık paket alınabiliyordu; paket fiyatıyla her biri
-- yaklaşık 7 dolar değerinde.
--
-- Düzeltme olay ADINA bakmıyor, ödenmiş DÖNEME bakıyor: kredi yalnızca aboneliğin bitiş
-- tarihi bir öncekinden farklıysa yazılıyor. Olay adlarına bağlı bir liste tutmak, her
-- yeni RevenueCat olayı geldiğinde aynı hatayı yeniden yapmanın yoluydu.

alter table subscriptions add column credits_granted_for timestamptz;

comment on column subscriptions.credits_granted_for is
  'Kredinin hangi dönem için yazıldığı (o dönemin bitiş tarihi). Aynı dönem iki kez kredi üretmez.';

-- Var olan aboneler: içinde bulundukları dönem için kredi almış sayılır. Aksi halde
-- migration sonrası ilk UNCANCELLATION 40 kredi yazardı.
update subscriptions set credits_granted_for = expires_at
 where tier = 'pro' and active;

create or replace function grant_purchase(
  p_profile uuid, p_rc_event_id text, p_product text, p_credits int, p_raw jsonb,
  p_pro_active boolean default null, p_pro_expires timestamptz default null
) returns void language plpgsql security definer set search_path = public as $fn$
declare v_already timestamptz; v_new_period boolean;
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
    select credits_granted_for into v_already from subscriptions where profile_id = p_profile;

    -- Yeni dönem: bitiş tarihi değişmişse. Süresiz abonelikte (expires_at null) yalnızca
    -- hiç kredi yazılmamışsa yeni dönem sayılır.
    v_new_period := p_pro_active
                and p_product like 'pro_%'
                and (v_already is null or p_pro_expires is distinct from v_already);

    insert into subscriptions (profile_id, tier, active, expires_at, source, updated_at,
                               credits_granted_for)
    values (p_profile, 'pro', p_pro_active, p_pro_expires, 'revenuecat', now(),
            case when v_new_period then p_pro_expires else v_already end)
    on conflict (profile_id) do update
      set tier = 'pro',
          active = excluded.active,
          expires_at = excluded.expires_at,
          updated_at = now(),
          credits_granted_for = excluded.credits_granted_for;

    if v_new_period then
      insert into credit_ledger (profile_id, delta, reason, note)
      values (p_profile, 40, 'subscription_grant', p_product);
    end if;
  end if;
end $fn$;

revoke execute on function grant_purchase from public, anon, authenticated;
