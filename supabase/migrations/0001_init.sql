-- 0001_init.sql — FirstCut çekirdek şema
-- Postgres 15+, Supabase. Tüm iş mantığı burada; client ledger'a yazmaz.

create extension if not exists "pgcrypto";
create extension if not exists "pg_cron";

-- ---------- ENUMS ----------
create type subscriber_band as enum ('b0_100','b100_1k','b1k_10k','b10k_100k','b100k_plus');
create type submission_status as enum ('open','completed','cancelled','hidden');
create type task_status as enum ('assigned','done','expired');
create type ledger_reason as enum ('signup_bonus','review_reward','submission_cost','refund','purchase','subscription_grant','admin');
create type subscription_tier as enum ('free','pro');

-- ---------- NICHES ----------
create table niches (
  id serial primary key,
  slug text unique not null,
  name text not null,
  is_active boolean not null default true,
  queries text[] not null default '{}'
);
insert into niches (slug,name) values
 ('animation','Animation'),('gaming','Gaming'),('education','Education & Explainers'),
 ('tech','Tech & Software'),('finance','Finance'),('fitness','Fitness & Health'),
 ('vlog','Vlog & Lifestyle'),('food','Food & Cooking'),('music','Music'),
 ('diy','DIY & Crafts'),('science','Science'),('comedy','Comedy & Entertainment'),
 ('travel','Travel'),('kids','Kids & Family'),('other','Other');

-- ---------- PROFILES ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique,
  display_name text,
  niche_id int references niches(id),
  language text not null default 'en',
  reputation numeric(4,2) not null default 1.00 check (reputation between 0.2 and 2.0),
  reviews_given int not null default 0,
  reviews_received int not null default 0,
  device_ids text[] not null default '{}',
  is_flagged boolean not null default false,
  onboarding_done boolean not null default false,
  expo_push_token text,
  created_at timestamptz not null default now()
);

create table channels (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  youtube_url text not null,
  youtube_channel_id text,
  channel_title text,
  band subscriber_band,
  created_at timestamptz not null default now(),
  unique (profile_id)
);

-- yeni auth kullanıcısı → profil + 5 kredi
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));
  insert into credit_ledger (profile_id, delta, reason) values (new.id, 5, 'signup_bonus');
  return new;
end $$;

-- ---------- CREDITS ----------
create table credit_ledger (
  id bigserial primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  delta int not null,
  reason ledger_reason not null,
  ref_id uuid,
  note text,
  created_at timestamptz not null default now()
);
create index on credit_ledger (profile_id, created_at desc);

create view profile_balances as
  select profile_id, coalesce(sum(delta),0)::int as balance from credit_ledger group by profile_id;

create or replace function balance_of(p uuid) returns int language sql stable as $$
  select coalesce(sum(delta),0)::int from credit_ledger where profile_id = p;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- SUBSCRIPTIONS / PURCHASES ----------
create table subscriptions (
  profile_id uuid primary key references profiles(id) on delete cascade,
  tier subscription_tier not null default 'free',
  active boolean not null default false,
  expires_at timestamptz,
  source text,
  updated_at timestamptz not null default now()
);
create table purchases (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  rc_event_id text unique not null,
  product_id text not null,
  credits int not null default 0,
  raw jsonb,
  created_at timestamptz not null default now()
);

create or replace function is_pro(p uuid) returns boolean language sql stable as $$
  select exists (select 1 from subscriptions where profile_id = p and tier='pro' and active and (expires_at is null or expires_at > now()));
$$;

-- ---------- NICHE THUMBNAIL CACHE (decoy'lar) ----------
create table niche_thumbnail_cache (
  id bigserial primary key,
  niche_id int not null references niches(id),
  video_id text not null,
  title text not null,
  thumbnail_url text not null,
  channel_title text,
  view_count bigint,
  fetched_at timestamptz not null default now(),
  unique (niche_id, video_id)
);

-- ---------- SUBMISSIONS ----------
create table submissions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  niche_id int not null references niches(id),
  language text not null default 'en',
  title_options text[] not null check (array_length(title_options,1) between 1 and 3),
  thumbnail_paths text[] not null check (array_length(thumbnail_paths,1) between 1 and 3),
  clip_path text not null,
  clip_duration_seconds int not null check (clip_duration_seconds between 5 and 60),
  requested_reviews int not null check (requested_reviews in (5,10,15,25)),
  received_reviews int not null default 0,
  status submission_status not null default 'open',
  is_priority boolean not null default false,
  ai_summary text,
  report_count int not null default 0,
  created_at timestamptz not null default now(),
  closes_at timestamptz not null default now() + interval '72 hours'
);
create index on submissions (niche_id, status, is_priority desc, created_at);

-- ---------- REVIEW TASKS ----------
create table review_tasks (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  reviewer_id uuid not null references profiles(id) on delete cascade,
  status task_status not null default 'assigned',
  thumbnail_index int not null,
  title_index int not null,
  decoys jsonb not null,           -- [{video_id,title,thumbnail_url,channel_title}] x5
  candidate_position int not null, -- 0..5 ızgaradaki yer
  assigned_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 minutes',
  unique (submission_id, reviewer_id)
);
create index on review_tasks (reviewer_id, status);

-- ---------- REVIEWS ----------
create table reviews (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique references review_tasks(id) on delete cascade,
  submission_id uuid not null references submissions(id) on delete cascade,
  reviewer_id uuid not null references profiles(id) on delete cascade,
  thumbnail_index int not null,
  title_index int not null,
  picked_candidate boolean not null,     -- feed testinde aday mı seçildi
  picked_position int not null,
  decision_ms int not null,
  title_guess text not null check (length(title_guess) >= 10),
  leave_second int,                       -- null = sonuna kadar
  watched_seconds int not null,
  reason_tags text[] not null default '{}',
  comment text,
  time_spent_seconds int not null,
  weight numeric(4,2) not null default 1.00,
  helpful boolean,                        -- owner oyu
  promise_understood boolean,             -- owner: başlık tahmini doğru mu
  created_at timestamptz not null default now(),
  check (leave_second is null or leave_second <= watched_seconds)
);
create index on reviews (submission_id);
create index on reviews (reviewer_id, created_at desc);

-- ---------- REPORTS ----------
create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles(id) on delete cascade,
  target_type text not null check (target_type in ('submission','review','profile')),
  target_id uuid not null,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);

-- ======================================================
-- FONKSİYONLAR (security definer; auth.uid() ile çalışır)
-- ======================================================

-- create_submission: kredi düşer, submission açar
create or replace function create_submission(
  p_title_options text[], p_thumbnail_paths text[], p_clip_path text,
  p_clip_duration int, p_requested int
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_niche int; v_lang text; v_pro boolean; v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select niche_id, language into v_niche, v_lang from profiles where id = v_uid;
  if v_niche is null then raise exception 'onboarding_incomplete'; end if;
  v_pro := is_pro(v_uid);
  if p_requested = 25 and not v_pro then raise exception 'pro_required'; end if;
  if balance_of(v_uid) < p_requested then raise exception 'insufficient_credits'; end if;

  insert into submissions (owner_id, niche_id, language, title_options, thumbnail_paths, clip_path,
                           clip_duration_seconds, requested_reviews, is_priority)
  values (v_uid, v_niche, v_lang, p_title_options, p_thumbnail_paths, p_clip_path, p_clip_duration, p_requested, v_pro)
  returning id into v_id;

  insert into credit_ledger (profile_id, delta, reason, ref_id)
  values (v_uid, -p_requested, 'submission_cost', v_id);
  return v_id;
end $$;

-- next_review_task: uygun submission seç, görev aç, görev + decoy döndür
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
    return jsonb_build_object('task', to_jsonb(v_task));
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
  return jsonb_build_object('task', to_jsonb(v_task));
end $$;

-- submit_review: doğrula, kaydet, kredi ver, gerekirse submission'ı kapat
create or replace function submit_review(
  p_task_id uuid, p_picked_candidate boolean, p_picked_position int, p_decision_ms int,
  p_title_guess text, p_leave_second int, p_watched_seconds int,
  p_reason_tags text[], p_comment text, p_time_spent int
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_task review_tasks%rowtype; v_sub submissions%rowtype; v_rep numeric; v_rid uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_task from review_tasks where id = p_task_id and reviewer_id = v_uid for update;
  if not found then raise exception 'task_not_found'; end if;
  if v_task.status <> 'assigned' or v_task.expires_at < now() then raise exception 'task_expired'; end if;
  select * into v_sub from submissions where id = v_task.submission_id for update;
  if v_sub.status <> 'open' then raise exception 'submission_closed'; end if;

  -- anti-fraud
  if p_time_spent < 20 then
    update review_tasks set status='expired' where id = p_task_id;
    update profiles set reputation = greatest(0.2, reputation - 0.2) where id = v_uid;
    raise exception 'review_too_fast';
  end if;
  if p_leave_second is not null and p_leave_second > p_watched_seconds then raise exception 'invalid_leave_second'; end if;
  if p_watched_seconds > v_sub.clip_duration_seconds + 2 then raise exception 'invalid_watched_seconds'; end if;

  select reputation into v_rep from profiles where id = v_uid;

  insert into reviews (task_id, submission_id, reviewer_id, thumbnail_index, title_index, picked_candidate,
    picked_position, decision_ms, title_guess, leave_second, watched_seconds, reason_tags, comment, time_spent_seconds, weight)
  values (p_task_id, v_sub.id, v_uid, v_task.thumbnail_index, v_task.title_index, p_picked_candidate,
    p_picked_position, p_decision_ms, p_title_guess, p_leave_second, p_watched_seconds, p_reason_tags, p_comment, p_time_spent, v_rep)
  returning id into v_rid;

  update review_tasks set status='done' where id = p_task_id;
  update submissions set received_reviews = received_reviews + 1 where id = v_sub.id;
  update profiles set reviews_given = reviews_given + 1 where id = v_uid;
  update profiles set reviews_received = reviews_received + 1 where id = v_sub.owner_id;

  if v_rep >= 0.5 then
    insert into credit_ledger (profile_id, delta, reason, ref_id) values (v_uid, 1, 'review_reward', v_rid);
  end if;

  if v_sub.received_reviews + 1 >= v_sub.requested_reviews then
    update submissions set status='completed' where id = v_sub.id;
  end if;
  return v_rid;
end $$;

-- rate_review: owner yararlı/değil + vaat anlaşıldı mı
create or replace function rate_review(p_review_id uuid, p_helpful boolean, p_promise_understood boolean default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_rev reviews%rowtype; v_owner uuid; v_prev boolean;
begin
  select * into v_rev from reviews where id = p_review_id;
  if not found then raise exception 'not_owner'; end if;
  select owner_id into v_owner from submissions where id = v_rev.submission_id;
  if v_owner <> v_uid then raise exception 'not_owner'; end if;
  v_prev := v_rev.helpful;
  update reviews set helpful = p_helpful, promise_understood = coalesce(p_promise_understood, promise_understood) where id = p_review_id;
  if v_prev is distinct from p_helpful then
    update profiles set reputation = least(2.0, greatest(0.2, reputation + case when p_helpful then 0.05 else -0.10 end))
    where id = v_rev.reviewer_id;
  end if;
end $$;

-- register_device: çoklu hesap sınırı
create or replace function register_device(p_device_id text) returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_cnt int;
begin
  select count(*) into v_cnt from profiles where p_device_id = any(device_ids) and id <> v_uid;
  update profiles set device_ids = array_append(array_remove(device_ids, p_device_id), p_device_id) where id = v_uid;
  if v_cnt >= 3 then update profiles set is_flagged = true where id = v_uid; end if;
end $$;

-- submission_results: sonuç ekranı için toplu veri (yalnızca owner)
create or replace function submission_results(p_id uuid, p_uid uuid default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid; v_sub submissions%rowtype; v_out jsonb;
begin
  -- p_uid yalnızca service role (Edge Function) tarafından geçilebilir
  if p_uid is not null and auth.role() <> 'service_role' then raise exception 'forbidden'; end if;
  v_uid := coalesce(p_uid, auth.uid());
  select * into v_sub from submissions where id = p_id;
  if not found or v_sub.owner_id <> v_uid then raise exception 'not_owner'; end if;
  select jsonb_build_object(
    'submission', to_jsonb(v_sub),
    'thumbnails', (select coalesce(jsonb_agg(t order by t.idx), '[]') from (
        select thumbnail_index as idx, count(*) as shown,
               sum(case when picked_candidate then weight else 0 end) as picked_w, sum(weight) as total_w,
               avg(decision_ms)::int as avg_decision_ms
        from reviews where submission_id = p_id group by thumbnail_index) t),
    'titles', (select coalesce(jsonb_agg(t order by t.idx), '[]') from (
        select title_index as idx, count(*) as shown,
               sum(case when promise_understood then 1 else 0 end) as understood
        from reviews where submission_id = p_id group by title_index) t),
    'hook', jsonb_build_object(
        'leave_seconds', (select coalesce(jsonb_agg(leave_second), '[]') from reviews where submission_id = p_id and leave_second is not null),
        'finished_ratio', (select coalesce(avg(case when leave_second is null then 1 else 0 end),0) from reviews where submission_id = p_id),
        'median_leave', (select percentile_cont(0.5) within group (order by leave_second) from reviews where submission_id = p_id and leave_second is not null),
        'tags', (select coalesce(jsonb_object_agg(tag, n), '{}') from (select unnest(reason_tags) tag, count(*) n from reviews where submission_id = p_id group by 1) x)),
    'reviews', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'title_guess',title_guess,'comment',comment,'leave_second',leave_second,
                 'reason_tags',reason_tags,'helpful',helpful,'promise_understood',promise_understood,'created_at',created_at) order by created_at), '[]')
                from reviews where submission_id = p_id)
  ) into v_out;
  return v_out;
end $$;

-- grant_purchase: yalnızca service role (Edge Function) çağırır
create or replace function grant_purchase(p_profile uuid, p_rc_event_id text, p_product text, p_credits int, p_raw jsonb,
                                          p_pro_active boolean default null, p_pro_expires timestamptz default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into purchases (profile_id, rc_event_id, product_id, credits, raw) values (p_profile, p_rc_event_id, p_product, p_credits, p_raw)
  on conflict (rc_event_id) do nothing;
  if not found then return; end if; -- idempotent
  if p_credits > 0 then
    insert into credit_ledger (profile_id, delta, reason, note) values (p_profile, p_credits, 'purchase', p_product);
  end if;
  if p_pro_active is not null then
    insert into subscriptions (profile_id, tier, active, expires_at, source, updated_at)
    values (p_profile, 'pro', p_pro_active, p_pro_expires, 'revenuecat', now())
    on conflict (profile_id) do update set tier='pro', active=excluded.active, expires_at=excluded.expires_at, updated_at=now();
    if p_pro_active and p_product like 'pro_%' then
      insert into credit_ledger (profile_id, delta, reason, note) values (p_profile, 40, 'subscription_grant', p_product);
    end if;
  end if;
end $$;

-- cron: görev süresi, submission kapanışı + iade
create or replace function expire_tasks() returns void language sql security definer set search_path = public as $$
  update review_tasks set status='expired' where status='assigned' and expires_at < now();
$$;
create or replace function close_stale_submissions() returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select * from submissions where status='open' and closes_at < now() for update skip locked loop
    update submissions set status='completed' where id = r.id;
    if r.requested_reviews > r.received_reviews then
      insert into credit_ledger (profile_id, delta, reason, ref_id) values (r.owner_id, r.requested_reviews - r.received_reviews, 'refund', r.id);
    end if;
  end loop;
end $$;
select cron.schedule('expire_tasks','*/10 * * * *', $$select expire_tasks()$$);
select cron.schedule('close_stale_submissions','*/10 * * * *', $$select close_stale_submissions()$$);

-- ---------- RLS ----------
alter table profiles enable row level security;
alter table channels enable row level security;
alter table credit_ledger enable row level security;
alter table subscriptions enable row level security;
alter table purchases enable row level security;
alter table niche_thumbnail_cache enable row level security;
alter table submissions enable row level security;
alter table review_tasks enable row level security;
alter table reviews enable row level security;
alter table reports enable row level security;
alter table niches enable row level security;

create policy "niches read" on niches for select using (true);
create policy "cache read" on niche_thumbnail_cache for select using (true);

create policy "profiles self read" on profiles for select using (auth.uid() = id);
create policy "profiles self update" on profiles for update using (auth.uid() = id)
  with check (auth.uid() = id and reputation = (select reputation from profiles p where p.id = auth.uid()) and is_flagged = (select is_flagged from profiles p where p.id = auth.uid()));
create policy "channels self" on channels for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
create policy "ledger self read" on credit_ledger for select using (auth.uid() = profile_id);
create policy "subs self read" on subscriptions for select using (auth.uid() = profile_id);
create policy "purchases self read" on purchases for select using (auth.uid() = profile_id);
create policy "submissions owner" on submissions for select using (auth.uid() = owner_id);
create policy "tasks reviewer read" on review_tasks for select using (auth.uid() = reviewer_id);
create policy "reviews owner or author" on reviews for select
  using (auth.uid() = reviewer_id or auth.uid() = (select owner_id from submissions s where s.id = submission_id));
create policy "reports insert" on reports for insert with check (auth.uid() = reporter_id);

-- rapor sayacı
create or replace function on_report() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.target_type = 'submission' then
    update submissions set report_count = report_count + 1 where id = new.target_id;
    update submissions set status='hidden' where id = new.target_id and report_count >= 3 and status='open';
  end if;
  return new;
end $$;
create trigger reports_after_insert after insert on reports for each row execute function on_report();

-- ---------- STORAGE ----------
insert into storage.buckets (id, name, public) values ('media','media', false) on conflict do nothing;
create policy "media owner write" on storage.objects for insert
  with check (bucket_id = 'media' and (storage.foldername(name))[2] = auth.uid()::text);
create policy "media owner read" on storage.objects for select
  using (bucket_id = 'media' and (storage.foldername(name))[2] = auth.uid()::text);
-- Değerlendiricinin klip/thumbnail okuması: RPC media_urls(task_id) signed URL üretir (Edge Function 'signed-media'), storage policy'e değil service role'e dayanır.

-- ---------- GRANTS ----------
grant execute on function create_submission, next_review_task, submit_review, rate_review, register_device, submission_results to authenticated;
revoke execute on function grant_purchase, expire_tasks, close_stale_submissions from public, anon, authenticated;
