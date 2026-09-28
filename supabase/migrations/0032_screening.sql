-- 0032 — yükleme anında otomatik tarama.
--
-- Araştırmanın (2026-09-28) asıl dersi buydu: Meta'nın işlem yaptığı içeriğin %90'dan
-- fazlası kimse şikâyet etmeden yakalanıyor. Bizde bu oran sıfırdı — rapor akışı zararı
-- ONARIYOR, girmesini engellemiyordu. Bir kişinin o içeriği görmesi gerekiyordu.
--
-- Artık test `screening` olarak doğuyor, thumbnail'ları Google Cloud Vision SafeSearch'ten
-- geçiyor ve ancak temiz çıkarsa `open` oluyor. `next_review_task` yalnızca `open` bakıyor,
-- yani taranmamış bir şey havuza giremiyor.
--
-- Takılırsa ne olur: tarama 10 dakikada bitmezse cron testi açıyor ve `screened_at` boş
-- kalıyor. Gerekçe — ölçüm ve güvenlik önemli ama ürünün çalışmaz hâle gelmesi daha kötü;
-- rapor akışı zaten arkada duruyor ve açılan testin taranmamış olduğu satırda yazılı.
--
-- Anahtar yoksa tarama hiç yapılmıyor ve test doğrudan `open` doğuyor. Yerel geliştirme ve
-- CI böyle çalışıyor; "anahtar yok" sessiz bir kapalılık değil, `screening_enabled()`
-- okunabilir bir cevap veriyor.
--
-- KAPSAM SINIRI: yalnızca THUMBNAIL taranıyor, klip taranmıyor. Vision görüntü API'si;
-- video için Video Intelligence gerekiyor ve dakikası ~0,10 $ — bir kredinin (0,166 $)
-- yanında orantısız. Izgarada herkesin ilk gördüğü şey thumbnail olduğu için kapsamın
-- en değerli kısmı burada; klip için rapor akışı devrede kalıyor.

alter table submissions
  add column screened_at timestamptz,
  add column screen_attempts int not null default 0;

comment on column submissions.screened_at is
  'Otomatik taramanın bittiği an. Boşsa test taranmadan açılmış demektir (tarama kapalı ya da zaman aşımı).';

create index on submissions (status, created_at) where status = 'screening';

/** Vault'ta Vision anahtarı var mı. Yoksa tarama kapalıdır ve test doğrudan açılır. */
create or replace function screening_enabled() returns boolean
language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from vault.decrypted_secrets where name = 'google_vision_api_key');
$fn$;

-- ---------- test açma: tarama sırasına gir ----------
drop function if exists create_submission(text[], text[], text, int, int, uuid, boolean);

create or replace function create_submission(
  p_title_options text[], p_thumbnail_paths text[], p_clip_path text,
  p_clip_duration int, p_requested int, p_channel_id uuid default null,
  p_is_vertical boolean default false
) returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  v_uid uuid := auth.uid();
  v_channel channels%rowtype;
  v_pro boolean; v_id uuid; v_count int; v_screen boolean;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  if p_channel_id is null then
    select count(*) into v_count from channels where profile_id = v_uid;
    if v_count = 0 then raise exception 'onboarding_incomplete'; end if;
    if v_count > 1 then raise exception 'channel_required'; end if;
    select * into v_channel from channels where profile_id = v_uid;
  else
    select * into v_channel from channels where id = p_channel_id;
    if v_channel.id is null then raise exception 'unknown_channel'; end if;
    if v_channel.profile_id <> v_uid then raise exception 'not_owner'; end if;
  end if;

  v_pro := is_pro(v_uid);
  if p_requested = 25 and not v_pro then raise exception 'pro_required'; end if;
  if balance_of(v_uid) < p_requested then raise exception 'insufficient_credits'; end if;

  v_screen := screening_enabled();

  insert into submissions (owner_id, channel_id, niche_id, language, title_options,
                           thumbnail_paths, clip_path, clip_duration_seconds,
                           requested_reviews, is_priority, is_vertical, status, screened_at)
  values (v_uid, v_channel.id, v_channel.niche_id, v_channel.language, p_title_options,
          p_thumbnail_paths, p_clip_path, p_clip_duration, p_requested, v_pro,
          coalesce(p_is_vertical, false),
          case when v_screen then 'screening'::submission_status else 'open'::submission_status end,
          case when v_screen then null else now() end)
  returning id into v_id;

  insert into credit_ledger (profile_id, delta, reason, ref_id)
  values (v_uid, -p_requested, 'submission_cost', v_id);
  return v_id;
end $fn$;

grant execute on function create_submission to authenticated;

-- ---------- tarama sonucu ----------
create or replace function screening_passed(p_submission_id uuid) returns void
language plpgsql security definer set search_path = public as $fn$
begin
  update submissions set status = 'open', screened_at = now()
   where id = p_submission_id and status = 'screening';
end $fn$;

revoke execute on function screening_passed from public, anon, authenticated;

/**
 * Tarama takıldı: içerik `hidden` olur, kredi iade edilir, sahibine haber gider.
 * İTİRAZ YOLU AÇIK KALIR (0030) — otomatik tarama yanılır, ve yanıldığında bedelini
 * ödeyen kişi elinde bir şey olmadan kalmamalı.
 */
create or replace function screening_failed(p_submission_id uuid, p_reason text default 'inappropriate')
returns void language plpgsql security definer set search_path = public as $fn$
declare v_sub submissions%rowtype;
begin
  select * into v_sub from submissions where id = p_submission_id for update;
  if v_sub.id is null or v_sub.status <> 'screening' then return; end if;

  update submissions
     set status = 'hidden', hidden_reason = p_reason, hidden_at = now(), screened_at = now()
   where id = p_submission_id;

  insert into credit_ledger (profile_id, delta, reason, ref_id, note)
  values (v_sub.owner_id, v_sub.requested_reviews, 'refund', v_sub.id, 'hidden_after_reports');

  insert into notifications (profile_id, kind, payload)
  values (v_sub.owner_id, 'submission_hidden',
          jsonb_build_object('submission_id', v_sub.id, 'reason', p_reason));
end $fn$;

revoke execute on function screening_failed from public, anon, authenticated;

-- ---------- tarayıcıyı tetikle ----------
create or replace function trigger_screen_media() returns void
language plpgsql security definer set search_path = public as $fn$
declare v_url text; v_key text;
begin
  if not exists (select 1 from submissions where status = 'screening' and screen_attempts < 3) then
    return;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_url is null or v_key is null then
    raise notice 'screen-media atlandı: project_url / service_role_key Vault''ta yok';
    return;
  end if;

  perform net.http_post(
    url := v_url || '/functions/v1/screen-media',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_key,
                                  'Content-Type', 'application/json'),
    body := '{}'::jsonb);
end $fn$;

revoke execute on function trigger_screen_media from public, anon, authenticated;

create or replace function on_submission_needs_screening() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if new.status = 'screening' then perform trigger_screen_media(); end if;
  return new;
end $fn$;

create trigger submissions_screen after insert on submissions
  for each row execute function on_submission_needs_screening();

-- ---------- takılanlar ----------
-- Tarama bir şekilde bitmezse test sonsuza kadar görünmez kalmamalı: on dakika sonra
-- açılıyor ve `screened_at` boş bırakılıyor, yani "bu taranmadı" satırda yazılı kalıyor.
create or replace function release_stuck_screening() returns int
language plpgsql security definer set search_path = public as $fn$
declare v_count int;
begin
  with released as (
    update submissions set status = 'open'
     where status = 'screening' and created_at < now() - interval '10 minutes'
    returning 1
  )
  select count(*)::int into v_count from released;
  return v_count;
end $fn$;

revoke execute on function release_stuck_screening from public, anon, authenticated;

select cron.schedule('screen_media', '*/2 * * * *', $$select trigger_screen_media()$$);
select cron.schedule('release_stuck_screening', '*/5 * * * *', $$select release_stuck_screening()$$);
