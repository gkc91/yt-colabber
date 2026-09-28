-- 0038 — başlık tahmini kuralı sunucuda da geçerli olsun.
--
-- BULGU (2026-09-28): PRODUCT §5 Adım 2 "serbest metin, ≥5 kelime" diyor ve istemci bunu
-- uyguluyor (`isGuessLongEnough`, `MIN_GUESS_WORDS = 5`, buton kilitli). `submit_review`
-- ise `p_title_guess`'e hiç bakmıyordu: boş string bile kabul ediliyor, değerlendirme
-- yazılıyor ve kredisi ödeniyordu.
--
-- Bu, 0036'daki hatanın aynı sınıfı ve CLAUDE.md'nin kuralı net: "Client'tan gelen ...
-- sunucuda kontrol edilir." Bir kural yalnızca istemcide yaşıyorsa kural değil, öneridir.
--
-- Neden tarlacılık listesinde en üstteki iş bu: tahmin, üretilmesi otomatikleştirilmesi
-- zor olan tek alan. Konum rastgeleleştirilebilir, saniye rastgeleleştirilebilir, ama beş
-- kelimelik bir cümle test sahibinin sonuç ekranında İNSAN tarafından okunuyor ve
-- "doğru anladı / yanlış anladı" diye işaretleniyor (§7) — o işaret de itibara gidiyor.
-- Yani bu alan zaten bir insan denetim döngüsüne bağlı; tek eksik, doldurulmasının zorunlu
-- olmasıydı.
--
-- KASITLI OLARAK YAPILMAYAN: `decision_ms` için alt sınır konmadı. Makul bir eşik seçecek
-- veri yok (bugün sıfır gerçek değerlendirme var) ve `avg_decision_ms` test sahibine
-- gösterilen bir ürün metriği — körlemesine seçilmiş bir sayı hızlı ama dürüst bir
-- değerlendiriciyi cezalandırır. Gerçek trafik geldiğinde dağılıma bakılıp karar verilir.

/**
 * Kelime sayısı. İstemcideki `countWords` ile aynı tanım: baştaki/sondaki boşluk atılır,
 * aradaki boşluk dizileri tek ayraç sayılır. Boş metin 0 döner (regexp_split_to_array
 * boş girdide tek elemanlı dizi döndürdüğü için ayrıca ele alınıyor).
 */
create or replace function word_count(p_text text) returns int
language sql immutable as $fn$
  select case
    when btrim(coalesce(p_text, '')) = '' then 0
    else array_length(regexp_split_to_array(btrim(p_text), '\s+'), 1)
  end;
$fn$;

comment on function word_count is
  'Sunucu tarafı kelime sayacı; apps/mobile/src/features/review/rules.ts countWords ile aynı tanım.';

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
  -- PRODUCT §5 Adım 2: serbest metin, ≥5 kelime. İstemci de uyguluyor; burası kuralın
  -- gerçekten geçerli olduğu yer.
  if word_count(p_title_guess) < 5 then raise exception 'guess_too_short'; end if;
  if p_leave_second is not null and p_leave_second > p_watched_seconds then raise exception 'invalid_leave_second'; end if;
  -- NULL "sonuna kadar izledim" demek; o hâlde izlenen süre klibin sonuna varmalı (0036).
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
