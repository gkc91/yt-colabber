-- 0008 — sonuç ekranının eksik alanları (B5).
--   * thumbnails.picked: ham oy sayısı. Kazanan rozeti "≥3 oy farkı" kuralına dayanır
--     (PRODUCT §7); ağırlıklı toplam (picked_w) bu kuralı ölçemez.
--   * reviews[].title_index / thumbnail_index: hangi tahminin hangi başlığa ait olduğunu
--     göstermek için.
create or replace function submission_results(p_id uuid, p_uid uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
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
               count(*) filter (where picked_candidate) as picked,
               sum(case when picked_candidate then weight else 0 end) as picked_w, sum(weight) as total_w,
               avg(decision_ms)::int as avg_decision_ms
        from reviews where submission_id = p_id group by thumbnail_index) t),
    'titles', (select coalesce(jsonb_agg(t order by t.idx), '[]') from (
        select title_index as idx, count(*) as shown,
               count(*) filter (where promise_understood) as understood,
               count(*) filter (where promise_understood is false) as misunderstood
        from reviews where submission_id = p_id group by title_index) t),
    'hook', jsonb_build_object(
        'leave_seconds', (select coalesce(jsonb_agg(leave_second), '[]') from reviews where submission_id = p_id and leave_second is not null),
        'finished_ratio', (select coalesce(avg(case when leave_second is null then 1 else 0 end),0) from reviews where submission_id = p_id),
        'median_leave', (select percentile_cont(0.5) within group (order by leave_second) from reviews where submission_id = p_id and leave_second is not null),
        'tags', (select coalesce(jsonb_object_agg(tag, n), '{}') from (select unnest(reason_tags) tag, count(*) n from reviews where submission_id = p_id group by 1) x)),
    'reviews', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'title_guess',title_guess,'comment',comment,'leave_second',leave_second,
                 'reason_tags',reason_tags,'helpful',helpful,'promise_understood',promise_understood,
                 'title_index',title_index,'thumbnail_index',thumbnail_index,'created_at',created_at) order by created_at), '[]')
                from reviews where submission_id = p_id)
  ) into v_out;
  return v_out;
end $$;
