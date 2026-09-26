-- 0026 — örnek test de dikey olabilsin.
--
-- 0024 dikey testi getirdi ama `create_demo_submission` yönü bilmiyordu, yani havuzdaki
-- her örnek test yatay açılıyordu. Sonuç: yeni akışı uçtan uca görecek tek bir test yok.
-- Değerlendirici tarafını denemenin tek yolu örnek testler olduğu için bu, dikey desteğin
-- test edilemez olması demekti.

drop function if exists create_demo_submission(uuid, text, text[], text[], text, int, text);

create or replace function create_demo_submission(
  p_owner uuid, p_niche_slug text, p_title_options text[], p_thumbnail_paths text[],
  p_clip_path text, p_clip_duration int, p_language text default 'en',
  p_is_vertical boolean default false
) returns uuid language plpgsql security definer set search_path = public as $fn$
declare v_niche int; v_id uuid;
begin
  select id into v_niche from niches where slug = p_niche_slug;
  if v_niche is null then raise exception 'unknown_niche'; end if;
  if not exists (select 1 from profiles where id = p_owner) then raise exception 'unknown_owner'; end if;

  insert into submissions (owner_id, niche_id, language, title_options, thumbnail_paths, clip_path,
                           clip_duration_seconds, requested_reviews, is_demo, closes_at,
                           is_vertical)
  values (p_owner, v_niche, p_language, p_title_options, p_thumbnail_paths, p_clip_path,
          p_clip_duration, 15, true, now() + interval '100 years',
          coalesce(p_is_vertical, false))
  returning id into v_id;
  return v_id;
end $fn$;

revoke execute on function create_demo_submission from public, anon, authenticated;
