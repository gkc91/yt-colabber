-- 0017 — Kapanan testin klibi 30 gün sonra silinir (C5).
--
-- Neden: klip 8 MB'a kadar ve her değerlendirici indiriyor; depolama + çıkış trafiği
-- altyapının en büyük kalemi (Supabase Free 5 GB trafik ≈ 40 test). İkincisi gizlilik:
-- yayınlanmamış videoyu işi bittikten sonra tutmanın savunulacak tarafı yok.
--
-- Ne silinmiyor: thumbnail'lar (küçük ve sonuç ekranında gösteriliyor) ve sonuç sayıları.
-- Sonuç ekranında değerli olan veri, klip değil.

alter table submissions add column clip_deleted_at timestamptz;

comment on column submissions.clip_deleted_at is
  'Klip depodan silindiğinde işaretlenir (C5). Sonuçlar ve thumbnail''lar kalır.';

create or replace function clip_retention_days() returns int language sql immutable as $$ select 30 $$;

-- Süresi dolmuş klipler: kapanmış, kapanışının üstünden 30 gün geçmiş, henüz silinmemiş.
create or replace function expired_clips(p_limit int default 100)
returns table (id uuid, clip_path text)
language sql security definer set search_path = public as $$
  select s.id, s.clip_path
  from submissions s
  where s.status <> 'open'
    and s.clip_deleted_at is null
    and s.closes_at < now() - make_interval(days => clip_retention_days())
  order by s.closes_at
  limit greatest(1, least(p_limit, 500));
$$;

create or replace function mark_clips_deleted(p_ids uuid[])
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  update submissions set clip_deleted_at = now()
   where id = any(p_ids) and clip_deleted_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke execute on function expired_clips(int), mark_clips_deleted(uuid[])
  from public, anon, authenticated;

-- ---------- cron ----------
-- Silme işini Edge Function yapar: dosyayı depodan kaldırmanın desteklenen yolu Storage
-- API'si; `storage.objects` satırını SQL ile silmek dosyayı diskte öksüz bırakır.
create or replace function trigger_cleanup_clips() returns void
language plpgsql security definer set search_path = public as $$
declare v_url text; v_key text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_url is null or v_key is null then
    raise notice 'cleanup-media atlandı: project_url / service_role_key Vault''ta yok';
    return;
  end if;

  perform net.http_post(
    url := v_url || '/functions/v1/cleanup-media',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000);
end $$;

revoke execute on function trigger_cleanup_clips from public, anon, authenticated;

select cron.schedule('cleanup_clips', '0 3 * * *', $$select trigger_cleanup_clips()$$);
