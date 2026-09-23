-- 0009 — değerlendirme kapsamı (B6).
-- Kendi testin HÂLÂ tek niş + tek dile gider (profiles.niche_id / language): sonucun
-- anlamlı kalması için değişmez. Değerlendirme tarafında ek niş/dil seçilebilir.
--
-- Kolonlar "ek" listeyi tutar, tam listeyi değil: kullanıcı kendi nişini sonradan
-- değiştirdiğinde (C4, ayda bir) liste bayatlamaz.

alter table profiles
  add column also_review_niche_ids int[] not null default '{}',
  add column also_review_languages text[] not null default '{}';

-- Sınır: herkesin her nişi değerlendirmesi kaliteyi düşürür; kendi nişi + en fazla 3 ek niş.
alter table profiles
  add constraint also_review_niches_limit check (coalesce(array_length(also_review_niche_ids, 1), 0) <= 3),
  add constraint also_review_languages_limit check (coalesce(array_length(also_review_languages, 1), 0) <= 2);

-- Eşleştirme artık ek listeleri de dikkate alır.
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
    and (s.niche_id = v_prof.niche_id or s.niche_id = any(v_prof.also_review_niche_ids))
    and (s.language = v_prof.language or s.language = any(v_prof.also_review_languages))
    and s.owner_id <> v_uid
    and s.received_reviews + (select count(*) from review_tasks t where t.submission_id = s.id and t.status='assigned' and t.expires_at > now()) < s.requested_reviews
    and not exists (select 1 from review_tasks t where t.submission_id = s.id and t.reviewer_id = v_uid)
  -- Kendi nişi önce gelsin: en iyi geri bildirim oradan çıkar.
  order by (s.niche_id = v_prof.niche_id) desc, s.is_priority desc, s.created_at asc
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
