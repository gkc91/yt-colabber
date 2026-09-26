-- 0023 — konu taşımayan kelimeler eşleşme saymasın.
--
-- Bulgu (2026-09-26, canlıda denendi): 0022 sonrası "Is Time Travel Possible?" için seçilen
-- beş decoy'dan yalnızca biri eşleşiyordu, o da "possible" kelimesinden — yani konu değil
-- dolgu. Education nişinin önbelleğinde "explained", "simply", "possible" neredeyse her
-- başlıkta geçiyor; bu kelimeler üzerinden kurulan eşleşme rastgeleden iyi değil.
--
-- Elle stopword listesi yazmadık. İki sebep: liste dile bağlı (nişler İngilizce dışında da
-- olacak) ve bakımı kimseye ait olmayan bir dosya haline gelir. Bunun yerine kelimenin
-- bilgi taşıyıp taşımadığı NİŞİN KENDİ VERİSİNDEN okunuyor: bir kelime o nişin başlıklarının
-- beşte birinden fazlasında geçiyorsa ayırt edici değildir ve sayılmaz (küçük
-- önbelleklerde taban 3: 8 videoluk bir nişte eşik 1 olurdu ve konu kelimesi bile elenirdi). Arama motorlarının
-- IDF'i ile aynı fikir, tek sorguluk hâli.
--
-- Sonuç olarak liste kendi kendini güncelliyor: önbellek tazelendiğinde hangi kelimenin
-- klişe olduğu da tazeleniyor.

-- Kural ayrı bir fonksiyonda: "hangi kelime sayılır" sorusu rastgeleliğe bulaşmadan
-- test edilebilsin. pick_decoys'un içinde kalsaydı yalnızca dolaylı, rastgele sonuçlar
-- üzerinden iddia kurulabilirdi.
create or replace function decoy_keywords(p_niche_id int, p_title text)
returns text[] language sql stable security definer set search_path = public as $fn$
  with havuz as (
    select count(*)::int as n from niche_thumbnail_cache where niche_id = p_niche_id
  ),
  kelimeler as (
    select distinct w from unnest(
      string_to_array(lower(regexp_replace(coalesce(p_title, ''), '[^a-zA-Z0-9]+', ' ', 'g')), ' ')
    ) as w
    -- Kısa kelimeler konu taşımıyor ("the", "and", "you").
    where length(w) >= 4
  )
  select coalesce(array_agg(k.w order by k.w), '{}')
  from kelimeler k, havuz h
  where (
    select count(*) from niche_thumbnail_cache c
    where c.niche_id = p_niche_id and position(k.w in lower(c.title)) > 0
  ) <= greatest(3, h.n / 5);
$fn$;

revoke execute on function decoy_keywords from public, anon, authenticated;

create or replace function pick_decoys(p_niche_id int, p_title text)
returns jsonb language sql stable security definer set search_path = public as $fn$
  select coalesce(jsonb_agg(jsonb_build_object(
           'video_id', video_id, 'title', title,
           'thumbnail_url', thumbnail_url, 'channel_title', channel_title)), '[]'::jsonb)
  from (
    select c.*,
           (select count(*) from unnest(decoy_keywords(p_niche_id, p_title)) w
             where position(w in lower(c.title)) > 0) as ortak
    from niche_thumbnail_cache c
    where c.niche_id = p_niche_id
    order by ortak desc, random()
    limit 5
  ) d;
$fn$;

revoke execute on function pick_decoys from public, anon, authenticated;
