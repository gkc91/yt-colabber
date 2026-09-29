-- 0042 — Pro kredisi verme işini aynı profil için sıraya sok.
--
-- BULGU (Strix taraması, 2026-09-29 — doğrulandı): `grant_pro_credits` önce "son 30 günde
-- `subscription_grant` var mı" diye bakıyor, sonra ekliyor. İkisi tek ifade değil, yani
-- aynı profil için eşzamanlı iki çağrı kontrolü BİRLİKTE geçip 40 krediyi iki kez basabilir.
--
-- İki çağıran var ve ikisi çakışabilir: aylık cron (`grant_monthly_pro_credits`, 05:00) ve
-- satın alma/yenileme yolu (0028). Yenileme tam cron saatine denk gelirse ikisi aynı anda
-- çalışır.
--
-- İşlem ömrü boyunca tutulan bir danışma kilidi (advisory lock) ikinciyi birincinin
-- bitmesini beklemeye zorluyor; beklerken birincinin eklediği satır görünür oluyor ve
-- kontrol doğru cevabı veriyor. Kilit profil BAŞINA: farklı kullanıcılar birbirini
-- beklemiyor.
--
-- TESTİN SINIRI, dürüstlük payı: pgTAP tek oturumda çalıştığı için yarışın kendisi
-- otomatik testle kanıtlanamıyor. 021 idempotentliği koruyor (kilit onu bozmamalı) ve
-- kilidin gerçekten tutulduğu `scripts/check-pro-grant-lock.mjs` ile iki eşzamanlı
-- bağlantıyla gösteriliyor.

create or replace function grant_pro_credits(p_profile uuid) returns boolean
language plpgsql security definer set search_path = public as $fn$
begin
  -- Kilit ÖNCE: kontrolden sonra alınırsa yarış penceresi açık kalır.
  perform pg_advisory_xact_lock(hashtext('grant_pro_credits:' || p_profile::text));

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
