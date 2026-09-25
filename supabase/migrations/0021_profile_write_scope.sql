-- 0021 — profilde neyin kullanıcıya, neyin sunucuya ait olduğunu RLS'e yazar.
--
-- Bulgu (2026-09-25 güvenlik taraması): profiles UPDATE politikası yalnızca `reputation`
-- ve `is_flagged` sütunlarını donduruyordu. Geri kalan her şey client'a açıktı ve üç
-- kural kağıt üstünde kalıyordu:
--
--   niche_id / niche_changed_at  → change_niche()'in "ayda bir" kuralı tek UPDATE ile
--                                  aşılabiliyordu; üstelik niche_changed_at null'a
--                                  çekilerek sayaç da sıfırlanabiliyordu. 0020'den sonra
--                                  bu sütun kişinin NEYİ DEĞERLENDİRDİĞİNİ belirliyor,
--                                  yani niş atlayıp her havuzdan kredi toplamak mümkündü.
--   reviews_given / received     → sunucunun saydığı sayaçlar; client istediğini yazabiliyordu.
--   device_ids                   → çoklu hesap tespiti (register_device) buna bakıyor;
--                                  kullanıcının kendi listesini temizlemesi tespiti köreltir.
--
-- Yöntem, reputation için zaten kullanılan yöntemin aynısı: WITH CHECK içinde sütunun
-- yeni değeri mevcut değerine eşit olmak zorunda. Postgres'te sütun bazlı RLS yok;
-- "değişmedi mi" kontrolü en yakın karşılığı.

drop policy "profiles self update" on profiles;

create policy "profiles self update" on profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and reputation = (select p.reputation from profiles p where p.id = auth.uid())
    and is_flagged = (select p.is_flagged from profiles p where p.id = auth.uid())
    and niche_id is not distinct from (select p.niche_id from profiles p where p.id = auth.uid())
    and niche_changed_at is not distinct from
        (select p.niche_changed_at from profiles p where p.id = auth.uid())
    and reviews_given = (select p.reviews_given from profiles p where p.id = auth.uid())
    and reviews_received = (select p.reviews_received from profiles p where p.id = auth.uid())
    and device_ids = (select p.device_ids from profiles p where p.id = auth.uid())
  );

-- ---------- ilk niş ----------
-- Kayıttan sonra niş bir kez seçilir; sonrası change_niche()'in kuralına tabidir.
-- Onboarding bunu doğrudan UPDATE ile yazıyordu, artık yazamaz.
create or replace function set_initial_niche(p_niche_id int, p_language text default 'en')
returns void language plpgsql security definer set search_path = public as $fn$
declare v_uid uuid := auth.uid(); v_current int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from niches where id = p_niche_id and is_active) then
    raise exception 'unknown_niche';
  end if;

  select niche_id into v_current from profiles where id = v_uid;
  -- İkinci kez çağrılırsa bu bir NİŞ DEĞİŞTİRMEDİR: aylık kural oraya aittir.
  if v_current is not null and v_current <> p_niche_id then
    raise exception 'use_change_niche';
  end if;

  update profiles set niche_id = p_niche_id, language = coalesce(p_language, language)
   where id = v_uid;
end $fn$;

grant execute on function set_initial_niche to authenticated;
