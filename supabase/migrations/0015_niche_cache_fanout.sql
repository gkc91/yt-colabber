-- 0015 — Niş cache yenileme: tek dev istek yerine niş başına bir istek.
--
-- Bulgu (2026-09-23, staging): `trigger_refresh_niche_cache()` tek bir `net.http_post` ile
-- bütün nişleri işleyen bir çağrı yapıyordu. Edge Function 14 nişi sırayla gezerken istek
-- düşüyor ve yalnızca ilk 7 niş doluyordu (vlog, tech, finance, gaming, animation, education,
-- fitness dolu; diğer 7'si boş). Tek nişlik çağrı ~3 saniyede bitiyor.
--
-- Çözüm: veritabanı fan-out yapar — her aktif niş için ayrı bir istek. Her istek kısa,
-- biri düşerse diğerleri etkilenmez, pg_net zaman aşımı da 20 saniyeye çıkarıldı.

-- Hangi nişler yenilenir: aktif ve sorgusu olanlar. Ayrı fonksiyon, çünkü test edilebilir.
create or replace function niches_to_refresh() returns table (slug text)
language sql stable security definer set search_path = public as $$
  select n.slug from niches n
  where n.is_active and coalesce(array_length(n.queries, 1), 0) > 0
  order by n.slug;
$$;

revoke execute on function niches_to_refresh from public, anon, authenticated;

create or replace function trigger_refresh_niche_cache() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_url text;
  v_key text;
  v_slug text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_url is null or v_key is null then
    raise notice 'refresh-niche-cache atlandı: project_url / service_role_key Vault''ta yok';
    return;
  end if;

  for v_slug in select slug from niches_to_refresh() loop
    perform net.http_post(
      url := v_url || '/functions/v1/refresh-niche-cache',
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
      body := jsonb_build_object('niche', v_slug),
      timeout_milliseconds := 20000);
  end loop;
end $$;

revoke execute on function trigger_refresh_niche_cache from public, anon, authenticated;
