-- 0024 — dikey video ve YouTube dışı hesaplar.
--
-- İki şey aynı işin parçası: Reels/TikTok/Shorts dikey çekiliyor ve bu üç yüzeyde de test
-- edilen şey aynı — kapak, başlık ve ilk saniyeler.
--
-- Üç karar burada yazılı:
--
-- 1. Yön TESTTE tutuluyor, kanalda değil. Aynı kanal hem uzun hem dikey video yayınlıyor;
--    kanala yapıştırsaydık her test için yalan söylerdi. Yön klibin en-boy oranından gelir.
--
-- 2. Değerlendirici havuzu yöne göre BÖLÜNMÜYOR. Bölseydik zaten küçük olan havuz ikiye
--    inerdi; dikey videoyu yatay izleyen biri de değerlendirebilir, değişen tek şey
--    ızgaranın nasıl göründüğü.
--
-- 3. Izgara yöne göre değişiyor. Dikey bir aday 16:9 komşular arasında sırıtır ve test
--    gerçekte olacağından iyi sonuç verir — 0022'de yazdığımız hatanın aynısı, bu kez
--    konuda değil biçimde. Dikey testin decoy'ları dikey olmalı.

alter table channels add column platform text not null default 'youtube'
  check (platform in ('youtube', 'instagram', 'tiktok'));

comment on column channels.platform is
  'Hesabın yayınladığı yer. Eşleştirmeyi etkilemez; bitiş ekranındaki bağlantı ve sahibin kendi listesi için.';

alter table submissions add column is_vertical boolean not null default false;

comment on column submissions.is_vertical is
  'Klip dikey mi (Shorts/Reels/TikTok). Izgaranın hangi decoy havuzundan besleneceğini belirler.';

alter table niche_thumbnail_cache add column is_vertical boolean not null default false;

create index on niche_thumbnail_cache (niche_id, is_vertical);

-- ---------- decoy seçimi yöne göre ----------
-- Eski iki argümanlı sürüm DÜŞÜRÜLÜR. Kalsaydı aşırı yükleme olurdu: iki argümanla
-- yapılan her çağrı sessizce yön filtresi olmayan eskisine giderdi.
drop function if exists pick_decoys(int, text);

create or replace function pick_decoys(p_niche_id int, p_title text, p_vertical boolean default false)
returns jsonb language sql stable security definer set search_path = public as $fn$
  select coalesce(jsonb_agg(jsonb_build_object(
           'video_id', video_id, 'title', title,
           'thumbnail_url', thumbnail_url, 'channel_title', channel_title)), '[]'::jsonb)
  from (
    select c.*,
           (select count(*) from unnest(decoy_keywords(p_niche_id, p_title)) w
             where position(w in lower(c.title)) > 0) as ortak
    from niche_thumbnail_cache c
    where c.niche_id = p_niche_id and c.is_vertical = coalesce(p_vertical, false)
    order by ortak desc, random()
    limit 5
  ) d;
$fn$;

revoke execute on function pick_decoys(int, text, boolean) from public, anon, authenticated;

-- ---------- test açma: yön klipten gelir ----------
drop function if exists create_submission(text[], text[], text, int, int, uuid);

create or replace function create_submission(
  p_title_options text[], p_thumbnail_paths text[], p_clip_path text,
  p_clip_duration int, p_requested int, p_channel_id uuid default null,
  p_is_vertical boolean default false
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
                           requested_reviews, is_priority, is_vertical)
  values (v_uid, v_channel.id, v_channel.niche_id, v_channel.language, p_title_options,
          p_thumbnail_paths, p_clip_path, p_clip_duration, p_requested, v_pro,
          coalesce(p_is_vertical, false))
  returning id into v_id;

  insert into credit_ledger (profile_id, delta, reason, ref_id)
  values (v_uid, -p_requested, 'submission_cost', v_id);
  return v_id;
end $fn$;

grant execute on function create_submission to authenticated;

-- ---------- görev dağıtımı ----------
-- Izgara artık testin yönüne göre besleniyor; ekran da klibi doğru oranda çizebilmek için
-- yönü öğreniyor.
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
      'is_vertical', v_sub.is_vertical,
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
    -- Gerçek testte bir kez görev açmak yeter: aynı ızgarayı ikinci kez gören kişi adayı
    -- hatırlar ve seçimi artık YouTube davranışını temsil etmez. Örnek testte ölçüm diye
    -- bir şey yok; orada ölçüt "değerlendirme yazıldı mı" (0019).
    and (
      case when s.is_demo
        then not exists (select 1 from reviews r where r.submission_id = s.id and r.reviewer_id = v_uid)
        else not exists (select 1 from review_tasks t where t.submission_id = s.id and t.reviewer_id = v_uid)
      end
    )
  -- Kendi nişi önce; sonra gerçek testler; demo en sona.
  order by (s.niche_id = v_prof.niche_id) desc, s.is_demo asc, s.is_priority desc, s.created_at asc
  limit 1 for update skip locked;
  -- Nişinde (ve kapsamında) hiçbir şey yoksa boş ekran yerine herhangi bir nişten örnek
  -- test (0018). Yeni gelen biri ilk dakikada ürünün ne yaptığını görebilsin. Yalnızca
  -- demo: gerçek testler yine yalnızca doğru nişe gider, sonuçlar anlamlı kalır.
  if not found then
    select s.* into v_sub
    from submissions s
    where s.is_demo and s.status = 'open' and s.closes_at > now()
      and s.owner_id <> v_uid
      and not exists (select 1 from reviews r where r.submission_id = s.id and r.reviewer_id = v_uid)
    -- Dili tutan örnek önce; sonra en eski.
    order by (s.language = v_prof.language) desc, s.created_at asc
    limit 1;
  end if;
  if not found then return jsonb_build_object('task', null); end if;

  v_tidx := floor(random() * array_length(v_sub.thumbnail_paths,1))::int;
  v_ttl  := floor(random() * array_length(v_sub.title_options,1))::int;
  v_pos  := floor(random() * 6)::int;
  v_decoys := pick_decoys(v_sub.niche_id, v_sub.title_options[v_ttl + 1], v_sub.is_vertical);
  if jsonb_array_length(v_decoys) < 5 then raise exception 'niche_cache_empty'; end if;

  -- (submission_id, reviewer_id) tekil: yarım kalan örnek testi yeniden verirken YENİ satır
  -- açamayız, var olanı tazeleriz. Buraya yalnızca değerlendirme yazılmamışken gelinir, o
  -- yüzden üzerine yazılan bir şey yok. Izgara ve gösterilen başlık yeniden çekilir.
  insert into review_tasks (submission_id, reviewer_id, thumbnail_index, title_index, decoys, candidate_position)
  values (v_sub.id, v_uid, v_tidx, v_ttl, v_decoys, v_pos)
  on conflict (submission_id, reviewer_id) do update
    set status = 'assigned',
        assigned_at = now(),
        expires_at = now() + interval '30 minutes',
        thumbnail_index = excluded.thumbnail_index,
        title_index = excluded.title_index,
        decoys = excluded.decoys,
        candidate_position = excluded.candidate_position
  returning * into v_task;

  return jsonb_build_object(
    'task', to_jsonb(v_task),
    'title', v_sub.title_options[v_ttl + 1],
    'clip_duration_seconds', v_sub.clip_duration_seconds,
    'is_vertical', v_sub.is_vertical,
    'is_demo', v_sub.is_demo);
end $$;
