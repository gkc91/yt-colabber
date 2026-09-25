-- 0020 — bir hesapta birden fazla kanal.
--
-- Neden: aynı kişi farklı nişlerde kanal yürütebiliyor ve Collab kanal-kanal eşleşmesi;
-- "bir e-posta = bir kanal" varsayımı ikisini de kırıyordu.
--
-- Değişen: testin nişi artık PROFİLDEN değil, testin ait olduğu KANALDAN okunuyor.
-- Bu olmadan finans ve animasyon kanalı olan biri, ikisinin testini de aynı nişe
-- gönderirdi — "aynı nişten gerçek insan" vaadi orada biter.
--
-- Değişmeyen: kredi, itibar ve bayrak hesapta kalır. Değerlendirmeyi insan yapıyor,
-- kanal değil. profiles.niche_id de kalır ama artık tek işi var: kişinin NEYİ
-- DEĞERLENDİRDİĞİ.

alter table channels drop constraint channels_profile_id_key;
alter table channels add column niche_id int references niches(id);
alter table channels add column language text not null default 'en';
alter table channels add column niche_changed_at timestamptz;

-- Var olan kanallar sahibinin nişini devralır: bugüne kadar zaten o nişe gidiyorlardı.
update channels c
   set niche_id = coalesce(p.niche_id, (select id from niches where slug = 'other')),
       language = p.language
  from profiles p
 where p.id = c.profile_id;

alter table channels alter column niche_id set not null;
create index on channels (profile_id, created_at);

alter table submissions add column channel_id uuid references channels(id) on delete set null;
update submissions s set channel_id = c.id from channels c where c.profile_id = s.owner_id;
create index on submissions (channel_id);

-- ---------- RLS ----------
-- Kanal satırını client artık doğrudan yazamaz. Sebep: niş serbestçe değiştirilebilseydi
-- "ayda bir niş değiştirme" kuralı anlamsızlaşır ve kişi testini istediği havuza atardı.
drop policy "channels self" on channels;
create policy "channels self read" on channels for select using (auth.uid() = profile_id);

-- ---------- kanal ekleme ----------
-- İsteğe bağlı alanlar varsayılanlı: kanal kimliği ve başlık URL'den her zaman
-- çıkarılamıyor, band da seçmeli (PRODUCT §2).
create or replace function add_channel(
  p_youtube_url text, p_niche_id int,
  p_youtube_channel_id text default null, p_channel_title text default null,
  p_band subscriber_band default null, p_language text default 'en'
) returns uuid language plpgsql security definer set search_path = public as $fn$
declare v_uid uuid := auth.uid(); v_count int; v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_youtube_url is null or length(trim(p_youtube_url)) = 0 then
    raise exception 'channel_url_required';
  end if;
  if not exists (select 1 from niches where id = p_niche_id and is_active) then
    raise exception 'unknown_niche';
  end if;

  select count(*) into v_count from channels where profile_id = v_uid;
  if v_count >= 5 then raise exception 'channel_limit'; end if;

  -- Aynı YouTube kanalını iki hesaba bağlamak, aynı testi iki havuza sokmanın yoludur.
  if p_youtube_channel_id is not null
     and exists (select 1 from channels where youtube_channel_id = p_youtube_channel_id) then
    raise exception 'channel_taken';
  end if;

  insert into channels (profile_id, youtube_url, youtube_channel_id, channel_title, band,
                        niche_id, language)
  values (v_uid, p_youtube_url, p_youtube_channel_id, p_channel_title, p_band,
          p_niche_id, coalesce(p_language, 'en'))
  returning id into v_id;
  return v_id;
end $fn$;

grant execute on function add_channel to authenticated;

-- ---------- kanalın nişini değiştirme ----------
-- Profildeki kuralın aynısı (0013): ayda bir, kanal başına sayılır.
create or replace function change_channel_niche(p_channel_id uuid, p_niche_id int)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_uid uuid := auth.uid(); v_owner uuid; v_current int; v_last timestamptz;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select profile_id, niche_id, niche_changed_at into v_owner, v_current, v_last
    from channels where id = p_channel_id;
  if v_owner is null then raise exception 'unknown_channel'; end if;
  if v_owner <> v_uid then raise exception 'not_owner'; end if;
  if not exists (select 1 from niches where id = p_niche_id and is_active) then
    raise exception 'unknown_niche';
  end if;
  if p_niche_id = v_current then return; end if;
  if v_last is not null and v_last > now() - interval '30 days' then
    raise exception 'niche_change_too_soon';
  end if;

  update channels set niche_id = p_niche_id, niche_changed_at = now() where id = p_channel_id;
end $fn$;

grant execute on function change_channel_niche to authenticated;

-- ---------- test açma ----------
-- Niş ve dil artık kanaldan. Kanal verilmezse hesabın tek kanalı kullanılır; birden
-- fazlaysa seçim zorunludur — sessizce "ilkini" seçmek testi yanlış havuza gönderirdi.
drop function if exists create_submission(text[], text[], text, int, int);

create or replace function create_submission(
  p_title_options text[], p_thumbnail_paths text[], p_clip_path text,
  p_clip_duration int, p_requested int, p_channel_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  v_uid uuid := auth.uid();
  v_channel channels%rowtype;
  v_pro boolean; v_id uuid; v_count int;
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

  insert into submissions (owner_id, channel_id, niche_id, language, title_options,
                           thumbnail_paths, clip_path, clip_duration_seconds,
                           requested_reviews, is_priority)
  values (v_uid, v_channel.id, v_channel.niche_id, v_channel.language, p_title_options,
          p_thumbnail_paths, p_clip_path, p_clip_duration, p_requested, v_pro)
  returning id into v_id;

  insert into credit_ledger (profile_id, delta, reason, ref_id)
  values (v_uid, -p_requested, 'submission_cost', v_id);
  return v_id;
end $fn$;

grant execute on function create_submission to authenticated;

-- ---------- değerlendirme sonrası kanal bağlantısı ----------
-- Testin kendi kanalı gösterilir; sahibin başka bir kanalı değil (PRODUCT §5).
create or replace function reviewed_channel(p_submission_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare v_uid uuid := auth.uid(); v_channel channels%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from reviews r
                 where r.submission_id = p_submission_id and r.reviewer_id = v_uid) then
    raise exception 'no_access';
  end if;

  select c.* into v_channel
    from submissions s join channels c on c.id = s.channel_id
   where s.id = p_submission_id;
  if not found then return jsonb_build_object('channel_title', null, 'youtube_url', null); end if;

  return jsonb_build_object('channel_title', v_channel.channel_title,
                            'youtube_url', v_channel.youtube_url);
end $fn$;

grant execute on function reviewed_channel to authenticated;

-- ---------- Collab ----------
-- 0002 tek kanal varsayıyordu: `join channels c on c.profile_id = p.id` artık her kanal
-- için bir aday satırı üretir, yani iki kanallı biri listede iki kez çıkardı. Collab
-- kanal-kanal eşleşmesi olacağı için (F1) bu geçici bir düzeltme: hesabın ilk kanalı.
create or replace function collab_candidates(p_limit int default 20) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare v_uid uuid := auth.uid(); v_me profiles%rowtype; v_band int;
begin
  select * into v_me from profiles where id = v_uid;
  if not exists (select 1 from collab_profiles where profile_id = v_uid and is_open) then
    raise exception 'collab_closed';
  end if;
  select coalesce(array_position(enum_range(null::subscriber_band), c.band), 3) into v_band
    from channels c where c.profile_id = v_uid order by c.created_at, c.id limit 1;

  return (select coalesce(jsonb_agg(row_to_json(x)), '[]') from (
    select p.id, p.display_name, c.channel_title, c.youtube_url, c.band, cp.types, cp.bio,
           p.reputation,
           (select count(*) from reviews r join submissions s on s.id=r.submission_id
             where r.reviewer_id = p.id and s.owner_id = v_uid) as reviewed_me,
           (select count(*) from reviews r join submissions s on s.id=r.submission_id
             where r.reviewer_id = v_uid and s.owner_id = p.id) as i_reviewed
    from profiles p
    join collab_profiles cp on cp.profile_id = p.id and cp.is_open
    join lateral (select * from channels ch where ch.profile_id = p.id
                   order by ch.created_at, ch.id limit 1) c on true
    where p.id <> v_uid and p.niche_id = v_me.niche_id and p.language = v_me.language
      and not p.is_flagged
      and abs(coalesce(array_position(enum_range(null::subscriber_band), c.band), 3) - v_band) <= 1
      and not exists (select 1 from blocks b
                       where (b.blocker_id = v_uid and b.blocked_id = p.id)
                          or (b.blocker_id = p.id and b.blocked_id = v_uid))
      and not exists (select 1 from collab_likes l where l.from_id = v_uid and l.to_id = p.id)
    order by (reviewed_me + i_reviewed) desc, p.reputation desc, cp.updated_at desc
    limit p_limit) x);
end $fn$;
