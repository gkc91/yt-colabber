-- 0004 — medya erişimi (B1).
-- Kim hangi dosyayı görebilir kararı Postgres'te; Edge Function 'signed-media' yalnızca imzalar.

-- media kovası: sunucu tarafı boyut ve tür sınırı (client zaten sıkıştırıyor, bu ikinci savunma).
-- 8 MB = klip tavanı (PRODUCT §6). Thumbnail tavanı (2 MB) client tarafında; kova tek limit tutuyor.
update storage.buckets
   set file_size_limit = 8388608,
       allowed_mime_types = array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime']
 where id = 'media';

-- media_paths: çağıranın görmeye hakkı olan yolları döner.
--   p_task_id      → değerlendirici: YALNIZCA kendisine atanan thumbnail + klip.
--                    (Tüm adayları görmek testin tasarımını ele verirdi.)
--   p_submission_id → submission sahibi: tüm thumbnail'lar + klip.
create or replace function media_paths(p_task_id uuid default null, p_submission_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_task review_tasks%rowtype;
  v_sub submissions%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if (p_task_id is null) = (p_submission_id is null) then raise exception 'invalid_arguments'; end if;

  if p_task_id is not null then
    select * into v_task from review_tasks where id = p_task_id and reviewer_id = v_uid;
    if not found then raise exception 'no_access'; end if;
    if v_task.status <> 'assigned' or v_task.expires_at < now() then raise exception 'task_expired'; end if;

    select * into v_sub from submissions where id = v_task.submission_id;
    if v_sub.status <> 'open' then raise exception 'submission_closed'; end if;

    return jsonb_build_object(
      'role', 'reviewer',
      -- thumbnail_index 0 tabanlı, Postgres dizisi 1 tabanlı
      'thumbnails', jsonb_build_array(v_sub.thumbnail_paths[v_task.thumbnail_index + 1]),
      'clip', v_sub.clip_path);
  end if;

  select * into v_sub from submissions where id = p_submission_id;
  if not found or v_sub.owner_id <> v_uid then raise exception 'no_access'; end if;

  return jsonb_build_object(
    'role', 'owner',
    'thumbnails', to_jsonb(v_sub.thumbnail_paths),
    'clip', v_sub.clip_path);
end $$;

grant execute on function media_paths to authenticated;
