-- 0007 — değerlendirme ekranının ihtiyaç duyduğu veri (B4).

-- Değerlendirici submission satırını okuyamaz (RLS: yalnızca sahibi). Görevle birlikte
-- kendisine atanan BAŞLIK metnini ve klip süresini de döneriz. Diğer başlıklar ve diğer
-- thumbnail'lar gönderilmez — testin tasarımı değerlendiriciden gizli kalmalı.
create or replace function next_review_task() returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_prof profiles%rowtype;
  v_sub submissions%rowtype;
  v_task review_tasks%rowtype;
  v_decoys jsonb; v_tidx int; v_ttl int; v_pos int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_prof from profiles where id = v_uid;
  if v_prof.reputation < 0.3 or v_prof.is_flagged then raise exception 'reviewer_blocked'; end if;

  -- zaten açık görevi varsa onu döndür
  select * into v_task from review_tasks where reviewer_id = v_uid and status='assigned' and expires_at > now() limit 1;
  if found then
    select * into v_sub from submissions where id = v_task.submission_id;
    return jsonb_build_object(
      'task', to_jsonb(v_task),
      'title', v_sub.title_options[v_task.title_index + 1],
      'clip_duration_seconds', v_sub.clip_duration_seconds);
  end if;

  select s.* into v_sub
  from submissions s
  where s.status = 'open' and s.closes_at > now()
    and s.niche_id = v_prof.niche_id and s.language = v_prof.language
    and s.owner_id <> v_uid
    and s.received_reviews + (select count(*) from review_tasks t where t.submission_id = s.id and t.status='assigned' and t.expires_at > now()) < s.requested_reviews
    and not exists (select 1 from review_tasks t where t.submission_id = s.id and t.reviewer_id = v_uid)
  order by s.is_priority desc, s.created_at asc
  limit 1 for update skip locked;
  if not found then return jsonb_build_object('task', null); end if;

  v_tidx := floor(random() * array_length(v_sub.thumbnail_paths,1))::int;
  v_ttl  := floor(random() * array_length(v_sub.title_options,1))::int;
  v_pos  := floor(random() * 6)::int;
  select coalesce(jsonb_agg(jsonb_build_object('video_id',video_id,'title',title,'thumbnail_url',thumbnail_url,'channel_title',channel_title)), '[]'::jsonb)
    into v_decoys
  from (select * from niche_thumbnail_cache where niche_id = v_sub.niche_id order by random() limit 5) d;
  if jsonb_array_length(v_decoys) < 5 then raise exception 'niche_cache_empty'; end if;

  insert into review_tasks (submission_id, reviewer_id, thumbnail_index, title_index, decoys, candidate_position)
  values (v_sub.id, v_uid, v_tidx, v_ttl, v_decoys, v_pos) returning * into v_task;

  return jsonb_build_object(
    'task', to_jsonb(v_task),
    'title', v_sub.title_options[v_ttl + 1],
    'clip_duration_seconds', v_sub.clip_duration_seconds);
end $$;

-- Değerlendirme GÖNDERİLDİKTEN sonra test sahibinin kanalı (PRODUCT §5).
-- Önce gösterilemez: değerlendirici kanalı tanırsa feed ve başlık testi bozulur.
-- Ziyaret sayılmaz, krediyle ilişkisi yoktur.
create or replace function reviewed_channel(p_submission_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_owner uuid; v_channel channels%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from reviews r where r.submission_id = p_submission_id and r.reviewer_id = v_uid) then
    raise exception 'no_access';
  end if;

  select owner_id into v_owner from submissions where id = p_submission_id;
  select * into v_channel from channels where profile_id = v_owner;
  if not found then return jsonb_build_object('channel_title', null, 'youtube_url', null); end if;

  return jsonb_build_object('channel_title', v_channel.channel_title, 'youtube_url', v_channel.youtube_url);
end $$;

grant execute on function reviewed_channel to authenticated;
