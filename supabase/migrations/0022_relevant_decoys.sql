-- 0022 — ızgaradaki diğer beş video konuyla ilgili olsun.
--
-- Bulgu (2026-09-26, sahibin denemesi): "bazıları alakasız olabiliyor". Decoy'lar nişten
-- RASTGELE seçiliyordu (`order by random() limit 5`), yani finans nişinde bir emeklilik
-- videosunun yanına kripto, vergi ve borsa videoları kadar alakasız bir şey de düşebiliyordu.
--
-- Neden önemli: ızgara "bu thumbnail YouTube'da tıklanır mıydı" sorusunu ölçüyor. Gerçek
-- YouTube ana sayfası konu komşusu videolar gösterir; alakasız komşular arasında aday
-- kolayca sırıtır ve test gerçekte olacağından daha iyi bir sonuç verir.
--
-- Yöntem: adayın GÖSTERİLEN başlığındaki anlamlı kelimeler (4+ harf) decoy başlıklarında
-- aranır, çok eşleşen öne geçer, eşit eşleşenler arasında sıra rastgeledir. Trigram ya da
-- tam metin araması yerine bu seçildi: eklenti gerektirmiyor, SQL'i okuyan herkes neyin
-- neden seçildiğini görebiliyor ve pgTAP ile doğrudan test edilebiliyor.
--
-- Sınır: önbellekte yalnızca BAŞLIK var, açıklama yok (0001). Açıklamaya göre eşleştirmek
-- için `niche_thumbnail_cache` şemasının ve YouTube tarama fonksiyonunun değişmesi gerekir.

create or replace function pick_decoys(p_niche_id int, p_title text)
returns jsonb language sql stable security definer set search_path = public as $fn$
  with kelimeler as (
    select distinct w from unnest(
      string_to_array(lower(regexp_replace(coalesce(p_title, ''), '[^a-zA-Z0-9]+', ' ', 'g')), ' ')
    ) as w
    -- Kısa kelimeler konu taşımıyor ("the", "and", "you"); eşleşmeleri gürültü olurdu.
    where length(w) >= 4
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'video_id', video_id, 'title', title,
           'thumbnail_url', thumbnail_url, 'channel_title', channel_title)), '[]'::jsonb)
  from (
    select c.*,
           (select count(*) from kelimeler k where position(k.w in lower(c.title)) > 0) as ortak
    from niche_thumbnail_cache c
    where c.niche_id = p_niche_id
    order by ortak desc, random()
    limit 5
  ) d;
$fn$;

revoke execute on function pick_decoys from public, anon, authenticated;

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
  v_decoys := pick_decoys(v_sub.niche_id, v_sub.title_options[v_ttl + 1]);
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
    'is_demo', v_sub.is_demo);
end $$;
