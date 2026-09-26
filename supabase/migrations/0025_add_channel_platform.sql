-- 0025 — kanal eklerken platform da kaydedilsin.
--
-- Platform kullanıcıya SORULMUYOR: adres zaten söylüyor (client'ta parseChannelUrl).
-- Burada yalnızca yazılıyor ve aynı hesabın iki kez bağlanması engelleniyor.
--
-- Tekillik kontrolü platforma göre değişmek zorunda: YouTube'da kararlı bir kanal kimliği
-- (UC…) var, Instagram ve TikTok'ta yok. Oralarda elimizdeki tek kararlı şey normalize
-- edilmiş adres — client adresi tek biçime indiriyor, böylece "instagram.com/@x/" ile
-- "www.instagram.com/x" aynı satıra düşüyor.

-- Eski altı argümanlı sürüm düşürülür: kalsaydı aşırı yükleme olur ve platform
-- geçirmeyen her çağrı sessizce eskisine giderdi.
drop function if exists add_channel(text, int, text, text, subscriber_band, text);

create or replace function add_channel(
  p_youtube_url text, p_niche_id int,
  p_youtube_channel_id text default null, p_channel_title text default null,
  p_band subscriber_band default null, p_language text default 'en',
  p_platform text default 'youtube'
) returns uuid language plpgsql security definer set search_path = public as $fn$
declare v_uid uuid := auth.uid(); v_count int; v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_youtube_url is null or length(trim(p_youtube_url)) = 0 then
    raise exception 'channel_url_required';
  end if;
  if coalesce(p_platform, 'youtube') not in ('youtube', 'instagram', 'tiktok') then
    raise exception 'unknown_platform';
  end if;
  if not exists (select 1 from niches where id = p_niche_id and is_active) then
    raise exception 'unknown_niche';
  end if;

  select count(*) into v_count from channels where profile_id = v_uid;
  if v_count >= 5 then raise exception 'channel_limit'; end if;

  -- Aynı hesabı iki profile bağlamak, aynı testi iki havuza sokmanın yoludur.
  if p_youtube_channel_id is not null
     and exists (select 1 from channels where youtube_channel_id = p_youtube_channel_id) then
    raise exception 'channel_taken';
  end if;
  if exists (select 1 from channels where lower(youtube_url) = lower(trim(p_youtube_url))) then
    raise exception 'channel_taken';
  end if;

  insert into channels (profile_id, youtube_url, youtube_channel_id, channel_title, band,
                        niche_id, language, platform)
  values (v_uid, trim(p_youtube_url), p_youtube_channel_id, p_channel_title, p_band,
          p_niche_id, coalesce(p_language, 'en'), coalesce(p_platform, 'youtube'))
  returning id into v_id;
  return v_id;
end $fn$;

grant execute on function add_channel to authenticated;
