-- 0014 — Örnek (demo) testler.
--
-- Amaç: uygulamaya ilk giren kişi "Değerlendir" sekmesinde boş ekran görmesin. Boş ekran
-- gören geri dönmüyor (GROWTH.md §1), ama sahte üretici de yaratmıyoruz: bu testler açıkça
-- "örnek test" olarak işaretlenir, değerlendirici karşısında birinin olmadığını bilir.
--
-- Kurallar:
--  * Demo test yalnızca service_role ile açılır (create_demo_submission); kredi düşmez,
--    ledger'a satır yazılmaz — kredi ekonomisine hiç dokunmaz.
--  * Demo test kapanmaz, iade üretmez ve dolduğunda 'completed' olmaz: havuzda kalır.
--  * Gerçek testler her zaman önce gösterilir; demo yalnızca sıra boşken çıkar.
--  * Değerlendirici demo için de +1 kredi kazanır: emeği gerçek, ödülü de gerçek.

alter table submissions add column is_demo boolean not null default false;

comment on column submissions.is_demo is
  'Örnek test: kredi ile açılmaz, kapanmaz, gerçek testlerden sonra gösterilir, arayüzde rozetlidir.';

create index on submissions (is_demo) where is_demo;

-- ---------- demo testi açmak ----------
create or replace function create_demo_submission(
  p_owner uuid, p_niche_slug text, p_title_options text[], p_thumbnail_paths text[],
  p_clip_path text, p_clip_duration int, p_language text default 'en'
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_niche int; v_id uuid;
begin
  select id into v_niche from niches where slug = p_niche_slug;
  if v_niche is null then raise exception 'unknown_niche'; end if;
  if not exists (select 1 from profiles where id = p_owner) then raise exception 'unknown_owner'; end if;

  insert into submissions (owner_id, niche_id, language, title_options, thumbnail_paths, clip_path,
                           clip_duration_seconds, requested_reviews, is_demo, closes_at)
  values (p_owner, v_niche, p_language, p_title_options, p_thumbnail_paths, p_clip_path,
          p_clip_duration, 15, true, now() + interval '100 years')
  returning id into v_id;
  return v_id;
end $$;

-- Kullanıcılar kendileri demo test açamaz; yalnızca service_role (seed scripti).
revoke execute on function create_demo_submission(uuid, text, text[], text[], text, int, text)
  from public, anon, authenticated;

-- ---------- eşleştirme: gerçek testler önce, demo bitmez ----------
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

  select * into v_task from review_tasks where reviewer_id = v_uid and status='assigned' and expires_at > now() limit 1;
  if found then
    select * into v_sub from submissions where id = v_task.submission_id;
    return jsonb_build_object(
      'task', to_jsonb(v_task),
      'title', v_sub.title_options[v_task.title_index + 1],
      'clip_duration_seconds', v_sub.clip_duration_seconds,
      'is_demo', v_sub.is_demo);
  end if;

  select s.* into v_sub
  from submissions s
  where s.status = 'open' and s.closes_at > now()
    and (s.niche_id = v_prof.niche_id or s.niche_id = any(v_prof.also_review_niche_ids))
    and (s.language = v_prof.language or s.language = any(v_prof.also_review_languages))
    and s.owner_id <> v_uid
    -- Demo testin kotası dolmaz: havuz boş kalmasın diye hep açık durur.
    and (s.is_demo or s.received_reviews + (select count(*) from review_tasks t where t.submission_id = s.id and t.status='assigned' and t.expires_at > now()) < s.requested_reviews)
    and not exists (select 1 from review_tasks t where t.submission_id = s.id and t.reviewer_id = v_uid)
  -- Kendi nişi önce; sonra gerçek testler; demo en sona.
  order by (s.niche_id = v_prof.niche_id) desc, s.is_demo asc, s.is_priority desc, s.created_at asc
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
    'clip_duration_seconds', v_sub.clip_duration_seconds,
    'is_demo', v_sub.is_demo);
end $$;

-- ---------- demo dolunca kapanmasın ----------
create or replace function submit_review(
  p_task_id uuid, p_picked_candidate boolean, p_picked_position int, p_decision_ms int,
  p_title_guess text, p_leave_second int, p_watched_seconds int,
  p_reason_tags text[], p_comment text, p_time_spent int
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_task review_tasks%rowtype; v_sub submissions%rowtype; v_rep numeric; v_rid uuid;
  v_elapsed int; v_spent int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_task from review_tasks where id = p_task_id and reviewer_id = v_uid for update;
  if not found then raise exception 'task_not_found'; end if;
  if v_task.status <> 'assigned' or v_task.expires_at < now() then raise exception 'task_expired'; end if;
  select * into v_sub from submissions where id = v_task.submission_id for update;
  if v_sub.status <> 'open' then raise exception 'submission_closed'; end if;

  v_elapsed := floor(extract(epoch from now() - v_task.assigned_at))::int;
  v_spent := least(coalesce(p_time_spent, 0), v_elapsed);

  if v_spent < 20 then
    update review_tasks set status='expired' where id = p_task_id;
    update profiles set reputation = greatest(0.2, reputation - 0.2) where id = v_uid;
    return null;
  end if;
  if p_leave_second is not null and p_leave_second > p_watched_seconds then raise exception 'invalid_leave_second'; end if;
  if p_watched_seconds > v_sub.clip_duration_seconds + 2 or p_watched_seconds > v_elapsed + 2 then
    raise exception 'invalid_watched_seconds';
  end if;

  select reputation into v_rep from profiles where id = v_uid;

  insert into reviews (task_id, submission_id, reviewer_id, thumbnail_index, title_index, picked_candidate,
    picked_position, decision_ms, title_guess, leave_second, watched_seconds, reason_tags, comment, time_spent_seconds, weight)
  values (p_task_id, v_sub.id, v_uid, v_task.thumbnail_index, v_task.title_index, p_picked_candidate,
    p_picked_position, p_decision_ms, p_title_guess, p_leave_second, p_watched_seconds, p_reason_tags, p_comment, v_spent, v_rep)
  returning id into v_rid;

  update review_tasks set status='done' where id = p_task_id;
  update submissions set received_reviews = received_reviews + 1 where id = v_sub.id;
  update profiles set reviews_given = reviews_given + 1 where id = v_uid;
  update profiles set reviews_received = reviews_received + 1 where id = v_sub.owner_id;

  if v_rep >= 0.5 then
    insert into credit_ledger (profile_id, delta, reason, ref_id) values (v_uid, 1, 'review_reward', v_rid);
  end if;

  -- Demo test 'completed' olmaz: kotası dolsa da havuzda kalır.
  if not v_sub.is_demo and v_sub.received_reviews + 1 >= v_sub.requested_reviews then
    update submissions set status='completed' where id = v_sub.id;
  end if;
  return v_rid;
end $$;

-- ---------- demo iade üretmesin ----------
create or replace function close_stale_submissions() returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select * from submissions where status='open' and closes_at < now() and not is_demo for update skip locked loop
    update submissions set status='completed' where id = r.id;
    if r.requested_reviews > r.received_reviews then
      insert into credit_ledger (profile_id, delta, reason, ref_id) values (r.owner_id, r.requested_reviews - r.received_reviews, 'refund', r.id);
    end if;
  end loop;
end $$;

-- ---------- demo için bildirim kuyruğa girmesin ----------
create or replace function queue_submission_notifications() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_demo then return new; end if;

  if new.received_reviews >= 3 and old.received_reviews < 3 then
    insert into notifications (profile_id, kind, payload)
    values (new.owner_id, 'reviews_arriving',
            jsonb_build_object('submission_id', new.id, 'received', new.received_reviews));
  end if;

  if new.status = 'completed' and old.status <> 'completed' then
    insert into notifications (profile_id, kind, payload)
    values (new.owner_id, 'test_completed',
            jsonb_build_object('submission_id', new.id, 'received', new.received_reviews,
                               'requested', new.requested_reviews));
  end if;

  return new;
end $$;
