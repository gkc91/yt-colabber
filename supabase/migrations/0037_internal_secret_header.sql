-- 0037 — service_role anahtarını pg_net başlıklarından çıkar (TASKS S1).
--
-- ARKA PLAN: `net.http_request_queue` giden isteğin başlıklarını `headers jsonb` sütununda
-- saklıyor ve pg_net'in kurulum betiği o şemaya PUBLIC'e yetki veriyor. İzinleri geri
-- alamıyoruz — hibeleri `supabase_admin` verdi, migration'lar `postgres` olarak çalışıyor.
-- Bugün o satır okunabilir değil (Supabase `net`'i Data API'den açmıyor, `anon` ve
-- `authenticated` NOLOGIN), yani açık değil; ama oraya veritabanını sahiplenen bir anahtar
-- koymak, o satır yarın bir şekilde görünür olursa bedeli "tüm ürün" yapıyor.
--
-- 0033'TE NEDEN BAŞARISIZ OLDU: paylaşılan sır doğrudan `Authorization`'a konmuştu. Bu dört
-- fonksiyon `verify_jwt = true` ile çalışıyor, yani Supabase ağ geçidi o başlığı JWT olarak
-- DOĞRULUYOR ve bizim kodumuz çalışmadan reddediyor. `token_urlsafe` bir sır JWT değil;
-- dört cron işi 95 dakika 401 aldı ve 0034 ile geri alındı.
--
-- ÇÖZÜM: iki başlık, iki ayrı iş.
--   * `Authorization` → anon anahtarı. Geçerli bir JWT olduğu için ağ geçidi geçiriyor, ve
--     o anahtar zaten mobil uygulamanın içinde herkese açık — kuyrukta durması bir şey
--     ifade etmiyor. Hiçbir yetki taşımıyor; RLS'i atlamıyor.
--   * `x-internal-secret` → paylaşılan sır. Gerçek yetkiyi bu veriyor ve ağ geçidi bu
--     başlığa karışmıyor. Sızarsa bedel "tarayıcıyı tetikleyebilirim".
--
-- YAYIN SIRASI ÖNEMLİ: önce Edge Function'lar, sonra bu migration. Yeni `isInternalCall`
-- hem yeni başlığı hem eski service_role karşılaştırmasını kabul ediyor, o yüzden
-- fonksiyonları önce yayınlamak hiçbir şeyi bozmuyor. TERSİ bozar: bu migration eski
-- fonksiyonlarla birlikte çalışırsa `Authorization`'da anon anahtarı görülür ve 403 dönülür.
--
-- Vault'ta `anon_key` yoksa ağ geçidi jetonu eski anahtara düşüyor: yani bu migration,
-- sır konmadan önce yayınlansa bile bugünkü davranışı koruyor.

/**
 * Ağ geçidini geçmek için JWT. Anon anahtarı varsa o — herkese açık, yetkisiz.
 * Yoksa eski anahtara düşüyor ki geçiş sırasında hiçbir çağrı düşmesin.
 * `security definer` çünkü `vault.decrypted_secrets` çağırana açık değil.
 */
create or replace function net_gateway_token() returns text
language sql stable security definer set search_path = public as $fn$
  select coalesce(
    (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
    (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'));
$fn$;

revoke execute on function net_gateway_token from public, anon, authenticated;

/** Gerçek yetkiyi veren sır. `x-internal-secret` başlığında gidiyor. */
create or replace function net_auth_token() returns text
language sql stable security definer set search_path = public as $fn$
  select coalesce(
    (select decrypted_secret from vault.decrypted_secrets where name = 'net_shared_secret'),
    (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'));
$fn$;

revoke execute on function net_auth_token from public, anon, authenticated;

/** Dört tetikleyicinin ortak başlıkları: tek yerde dursun, dördü ayrışmasın. */
create or replace function net_headers() returns jsonb
language sql stable security definer set search_path = public as $fn$
  select jsonb_build_object(
    'Authorization', 'Bearer ' || net_gateway_token(),
    'x-internal-secret', net_auth_token(),
    'Content-Type', 'application/json');
$fn$;

revoke execute on function net_headers from public, anon, authenticated;

-- ---------- dört tetikleyici ----------
create or replace function trigger_cleanup_clips() returns void
language plpgsql security definer set search_path = public as $fn$
declare v_url text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  if v_url is null or net_auth_token() is null then
    raise notice 'cleanup-media atlandı: project_url / yetki jetonu Vault''ta yok';
    return;
  end if;

  perform net.http_post(
    url := v_url || '/functions/v1/cleanup-media',
    headers := net_headers(),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000);
end $fn$;

create or replace function trigger_notify() returns void
language plpgsql security definer set search_path = public as $fn$
declare v_url text;
begin
  if not exists (select 1 from notifications where sent_at is null and attempts < 5) then
    return;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  if v_url is null or net_auth_token() is null then
    raise notice 'notify atlandı: project_url / yetki jetonu Vault''ta yok';
    return;
  end if;

  perform net.http_post(
    url := v_url || '/functions/v1/notify',
    headers := net_headers(),
    body := '{}'::jsonb);
end $fn$;

create or replace function trigger_refresh_niche_cache() returns void
language plpgsql security definer set search_path = public as $fn$
declare v_url text; v_slug text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  if v_url is null or net_auth_token() is null then
    raise notice 'refresh-niche-cache atlandı: project_url / yetki jetonu Vault''ta yok';
    return;
  end if;

  for v_slug in select slug from niches_to_refresh() loop
    perform net.http_post(
      url := v_url || '/functions/v1/refresh-niche-cache',
      headers := net_headers(),
      body := jsonb_build_object('niche', v_slug),
      timeout_milliseconds := 20000);
  end loop;
end $fn$;

create or replace function trigger_screen_media() returns void
language plpgsql security definer set search_path = public as $fn$
declare v_url text;
begin
  if not exists (select 1 from submissions where status = 'screening' and screen_attempts < 3) then
    return;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  if v_url is null or net_auth_token() is null then
    raise notice 'screen-media atlandı: project_url / yetki jetonu Vault''ta yok';
    return;
  end if;

  perform net.http_post(
    url := v_url || '/functions/v1/screen-media',
    headers := net_headers(),
    body := '{}'::jsonb);
end $fn$;

revoke execute on function trigger_cleanup_clips from public, anon, authenticated;
revoke execute on function trigger_notify from public, anon, authenticated;
revoke execute on function trigger_refresh_niche_cache from public, anon, authenticated;
revoke execute on function trigger_screen_media from public, anon, authenticated;
