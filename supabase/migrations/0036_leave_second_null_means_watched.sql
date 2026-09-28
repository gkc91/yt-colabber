-- 0036 — "sonuna kadar izledim" iddiası izlenen süreyle tutarlı olmak zorunda.
--
-- BULGU (2026-09-28, yerelde üretildi): PRODUCT §5'e göre `leave_second = null` "klip sonuna
-- kadar izlendi" demek — en güçlü olumlu sinyal. İstemci bu değişmezi koruyor
-- (`leaveSecondFor` yalnızca `leftAt >= duration` ise null dönüyor), ama SUNUCU hiç
-- kontrol etmiyordu. `leave_second = null, watched_seconds = 0` gönderen bir istek
-- kabul ediliyor, "sonuna kadar izlendi" diye kaydediliyor ve kredisi ödeniyordu.
--
-- CLAUDE.md'nin kuralı açık: "Client'tan gelen watched_seconds, time_spent_seconds
-- sunucuda kontrol edilir." Üst sınırlar kontrol ediliyordu (klip süresini ve geçen süreyi
-- aşamaz), çelişki kontrol edilmiyordu.
--
-- EN KÖTÜ SONUCU tespit tarafında: `flag_suspicious_reviewer` "hep sıfırıncı saniyede
-- bıraktı" kuralını `leave_second = 0` sayarak uyguluyor ve NULL sıfıra eşit değil. Yani
-- `0` gönderen hileci yakalanıyor, `null` gönderen yakalanmıyor — tespit, daha dikkatli
-- saldırgana karşı daha zayıftı. Bu düzeltme o boşluğu kaynağında kapatıyor: null artık
-- gerçekten izlenmiş olmayı gerektiriyor, dolayısıyla kaçış yolu değil.
--
-- Tolerans 2 saniye, mevcut üst sınır kontrolüyle simetrik (`+ 2`): oynatıcının son
-- saniyeyi tam yakalayamaması dürüst bir değerlendiriciyi cezalandırmasın.

create or replace function submit_review(
  p_task_id uuid, p_picked_candidate boolean, p_picked_position integer,
  p_decision_ms integer, p_title_guess text, p_leave_second integer,
  p_watched_seconds integer, p_reason_tags text[], p_comment text, p_time_spent integer
) returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  v_uid uuid := auth.uid();
  v_task review_tasks%rowtype; v_sub submissions%rowtype; v_rep numeric; v_rid uuid;
  v_elapsed int; v_spent int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_task from review_tasks where id = p_task_id and reviewer_id = v_uid for update;
  if not found then raise exception 'task_not_found'; end if;
  if v_task.status <> 'assigned' or v_task.expires_at < now() then raise exception 'task_expired'; end if;
  select * into v_sub from submissions where id = v_task.submission_id for update;
  if v_sub.status <> 'open' then raise exception 'submission_closed'; end if;

  v_elapsed := floor(extract(epoch from now() - v_task.assigned_at))::int;
  v_spent := least(coalesce(p_time_spent, 0), v_elapsed);

  if v_spent < 20 then
    update review_tasks set status='expired' where id = p_task_id;
    update profiles set reputation = greatest(0.2, reputation - 0.2) where id = v_uid;
    return null;
  end if;
  if p_leave_second is not null and p_leave_second > p_watched_seconds then raise exception 'invalid_leave_second'; end if;
  -- NULL "sonuna kadar izledim" demek; o hâlde izlenen süre klibin sonuna varmalı.
  if p_leave_second is null and p_watched_seconds < v_sub.clip_duration_seconds - 2 then
    raise exception 'invalid_leave_second';
  end if;
  if p_watched_seconds > v_sub.clip_duration_seconds + 2 or p_watched_seconds > v_elapsed + 2 then
    raise exception 'invalid_watched_seconds';
  end if;

  select reputation into v_rep from profiles where id = v_uid;

  insert into reviews (task_id, submission_id, reviewer_id, thumbnail_index, title_index, picked_candidate,
    picked_position, decision_ms, title_guess, leave_second, watched_seconds, reason_tags, comment, time_spent_seconds, weight)
  values (p_task_id, v_sub.id, v_uid, v_task.thumbnail_index, v_task.title_index, p_picked_candidate,
    p_picked_position, p_decision_ms, p_title_guess, p_leave_second, p_watched_seconds, p_reason_tags, p_comment, v_spent, v_rep)
  returning id into v_rid;

  update review_tasks set status='done' where id = p_task_id;
  update submissions set received_reviews = received_reviews + 1 where id = v_sub.id;
  update profiles set reviews_given = reviews_given + 1 where id = v_uid;
  update profiles set reviews_received = reviews_received + 1 where id = v_sub.owner_id;

  if v_rep >= 0.5 then
    insert into credit_ledger (profile_id, delta, reason, ref_id) values (v_uid, 1, 'review_reward', v_rid);
  end if;

  -- Demo test 'completed' olmaz: kotası dolsa da havuzda kalır.
  if not v_sub.is_demo and v_sub.received_reviews + 1 >= v_sub.requested_reviews then
    update submissions set status='completed' where id = v_sub.id;
  end if;
  return v_rid;
end $fn$;

grant execute on function submit_review to authenticated;
