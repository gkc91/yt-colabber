-- 0033 — pg_net çağrılarından service_role anahtarını çıkar.
--
-- BULGU (2026-09-28): `net.http_request_queue` giden isteğin başlıklarını `headers jsonb`
-- sütununda saklıyor, ve pg_net'in kurulum betiği o şemaya PUBLIC'e `usage` + tablolara
-- `all` veriyor. Bizim dört tetikleyicimiz oraya `Authorization: Bearer <service_role_key>`
-- yazıyordu.
--
-- BUGÜN SÖMÜRÜLEBİLİR DEĞİL, ve bunu abartmamak önemli: Supabase `net` şemasını Data
-- API'den açmıyor, `anon` ve `authenticated` ise NOLOGIN rolleri — doğrudan veritabanı
-- bağlantısı kuramıyorlar. Yani uygulamaya kaydolan birinin o satıra ulaşacak yolu yok.
-- İzinleri kendimiz geri de alamıyoruz: hibeleri `supabase_admin` verdi, migration'lar
-- `postgres` olarak çalışıyor, ve Postgres'te kendi vermediğin hibeyi geri alamazsın
-- (denendi: "permission denied to set role supabase_admin").
--
-- O yüzden bu bir açık kapatma değil, PATLAMA YARIÇAPINI küçültme. Service_role anahtarı
-- RLS'i tamamen atlıyor; o satır yarın bir şekilde görünür olursa (yanlış yazılmış tek bir
-- security definer fonksiyon, bir döküm, bir destek talebi) bedeli ürünün tamamı oluyor.
-- Ayrı bir sırla bedel "tarayıcıyı tetikleyebilirim"e düşüyor.
--
-- GEÇİŞ: `net_auth_token()` önce `net_shared_secret`'e bakıyor, yoksa eski
-- `service_role_key`'e düşüyor. Edge fonksiyonlar da (bkz. _shared/supabase.ts
-- `isInternalCall`) ikisini birden kabul ediyor. Böylece migration ile fonksiyon dağıtımı
-- birbirini beklemiyor ve yanlış sıra beş cron işini birden susturmuyor.
--
-- Sır yerleştikten sonra yapılacaklar `docs/TASKS.md`'de duruyor: yedeği kaldır.

/**
 * pg_net çağrılarında kullanılacak yetki jetonu. Ayrı sır varsa o, yoksa eski anahtar.
 * `security definer` çünkü `vault.decrypted_secrets` çağırana açık değil.
 */
create or replace function net_auth_token() returns text
language sql stable security definer set search_path = public as $fn$
  select coalesce(
    (select decrypted_secret from vault.decrypted_secrets where name = 'net_shared_secret'),
    (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'));
$fn$;

revoke execute on function net_auth_token from public, anon, authenticated;

-- ---------- dört tetikleyici ----------
create or replace function trigger_cleanup_clips() returns void
language plpgsql security definer set search_path = public as $fn$
declare v_url text; v_key text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  v_key := net_auth_token();
  if v_url is null or v_key is null then
    raise notice 'cleanup-media atlandı: project_url / yetki jetonu Vault''ta yok';
    return;
  end if;

  perform net.http_post(
    url := v_url || '/functions/v1/cleanup-media',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000);
end $fn$;

create or replace function trigger_notify() returns void
language plpgsql security definer set search_path = public as $fn$
declare v_url text; v_key text;
begin
  if not exists (select 1 from notifications where sent_at is null and attempts < 5) then
    return;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  v_key := net_auth_token();
  if v_url is null or v_key is null then
    raise notice 'notify atlandı: project_url / yetki jetonu Vault''ta yok';
    return;
  end if;

  perform net.http_post(
    url := v_url || '/functions/v1/notify',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
    body := '{}'::jsonb);
end $fn$;

create or replace function trigger_refresh_niche_cache() returns void
language plpgsql security definer set search_path = public as $fn$
declare
  v_url text;
  v_key text;
  v_slug text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  v_key := net_auth_token();
  if v_url is null or v_key is null then
    raise notice 'refresh-niche-cache atlandı: project_url / yetki jetonu Vault''ta yok';
    return;
  end if;

  for v_slug in select slug from niches_to_refresh() loop
    perform net.http_post(
      url := v_url || '/functions/v1/refresh-niche-cache',
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
      body := jsonb_build_object('niche', v_slug),
      timeout_milliseconds := 20000);
  end loop;
end $fn$;

create or replace function trigger_screen_media() returns void
language plpgsql security definer set search_path = public as $fn$
declare v_url text; v_key text;
begin
  if not exists (select 1 from submissions where status = 'screening' and screen_attempts < 3) then
    return;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  v_key := net_auth_token();
  if v_url is null or v_key is null then
    raise notice 'screen-media atlandı: project_url / yetki jetonu Vault''ta yok';
    return;
  end if;

  perform net.http_post(
    url := v_url || '/functions/v1/screen-media',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_key,
                                  'Content-Type', 'application/json'),
    body := '{}'::jsonb);
end $fn$;

revoke execute on function trigger_cleanup_clips from public, anon, authenticated;
revoke execute on function trigger_notify from public, anon, authenticated;
revoke execute on function trigger_refresh_niche_cache from public, anon, authenticated;
revoke execute on function trigger_screen_media from public, anon, authenticated;
