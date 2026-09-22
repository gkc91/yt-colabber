-- 0002_collab.sql — Collab modülü (Faz F). Krediyle bağlantısı yoktur.

create type collab_type as enum ('joint_video','guest','shorts','end_screen_swap','live');

create table collab_profiles (
  profile_id uuid primary key references profiles(id) on delete cascade,
  is_open boolean not null default false,
  types collab_type[] not null default '{}',
  bio text check (length(bio) <= 280),
  updated_at timestamptz not null default now()
);
create table collab_likes (
  from_id uuid not null references profiles(id) on delete cascade,
  to_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id),
  check (from_id <> to_id)
);
create table collab_matches (
  id uuid primary key default gen_random_uuid(),
  a_id uuid not null references profiles(id) on delete cascade,
  b_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (a_id, b_id),
  check (a_id < b_id)
);
create table messages (
  id bigserial primary key,
  match_id uuid not null references collab_matches(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index on messages (match_id, created_at);
create table blocks (
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

-- adaylar: aynı niş+dil, band ±1, engellenmemiş, beğenilmemiş; önce aralarında değerlendirme geçmişi olanlar
create or replace function collab_candidates(p_limit int default 20) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_me profiles%rowtype; v_band int;
begin
  select * into v_me from profiles where id = v_uid;
  if not exists (select 1 from collab_profiles where profile_id = v_uid and is_open) then raise exception 'collab_closed'; end if;
  select coalesce(array_position(enum_range(null::subscriber_band), c.band), 3) into v_band from channels c where c.profile_id = v_uid;
  return (select coalesce(jsonb_agg(row_to_json(x)), '[]') from (
    select p.id, p.display_name, c.channel_title, c.youtube_url, c.band, cp.types, cp.bio, p.reputation,
           (select count(*) from reviews r join submissions s on s.id=r.submission_id where r.reviewer_id = p.id and s.owner_id = v_uid) as reviewed_me,
           (select count(*) from reviews r join submissions s on s.id=r.submission_id where r.reviewer_id = v_uid and s.owner_id = p.id) as i_reviewed
    from profiles p
    join collab_profiles cp on cp.profile_id = p.id and cp.is_open
    join channels c on c.profile_id = p.id
    where p.id <> v_uid and p.niche_id = v_me.niche_id and p.language = v_me.language and not p.is_flagged
      and abs(coalesce(array_position(enum_range(null::subscriber_band), c.band), 3) - v_band) <= 1
      and not exists (select 1 from blocks b where (b.blocker_id = v_uid and b.blocked_id = p.id) or (b.blocker_id = p.id and b.blocked_id = v_uid))
      and not exists (select 1 from collab_likes l where l.from_id = v_uid and l.to_id = p.id)
    order by (reviewed_me + i_reviewed) desc, p.reputation desc, cp.updated_at desc
    limit p_limit) x);
end $$;

-- beğen; karşılıklıysa match oluştur ve id döndür
create or replace function collab_like(p_to uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_match uuid;
begin
  insert into collab_likes (from_id, to_id) values (v_uid, p_to) on conflict do nothing;
  if exists (select 1 from collab_likes where from_id = p_to and to_id = v_uid) then
    insert into collab_matches (a_id, b_id) values (least(v_uid,p_to), greatest(v_uid,p_to))
    on conflict (a_id,b_id) do update set created_at = collab_matches.created_at returning id into v_match;
  end if;
  return v_match;
end $$;

create or replace function send_message(p_match uuid, p_body text) returns bigint language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id bigint;
begin
  if not exists (select 1 from collab_matches m where m.id = p_match and v_uid in (m.a_id, m.b_id)) then raise exception 'not_in_match'; end if;
  insert into messages (match_id, sender_id, body) values (p_match, v_uid, p_body) returning id into v_id;
  return v_id;
end $$;

alter table collab_profiles enable row level security;
alter table collab_likes enable row level security;
alter table collab_matches enable row level security;
alter table messages enable row level security;
alter table blocks enable row level security;

create policy "collab self" on collab_profiles for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
create policy "likes self read" on collab_likes for select using (auth.uid() = from_id);
create policy "matches member" on collab_matches for select using (auth.uid() in (a_id, b_id));
create policy "messages member" on messages for select
  using (exists (select 1 from collab_matches m where m.id = match_id and auth.uid() in (m.a_id, m.b_id)));
create policy "blocks self" on blocks for all using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);

alter publication supabase_realtime add table messages;
grant execute on function collab_candidates, collab_like, send_message to authenticated;
