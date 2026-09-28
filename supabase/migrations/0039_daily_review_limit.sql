-- 0039 — kişi başı günlük değerlendirme tavanı.
--
-- NEDEN (2026-09-28): tarlacılık kredi enflasyonu yaratmıyor — verilen her değerlendirme
-- 1 kredi üretiyor, harcanan her kredi 1 değerlendirme tüketiyor, arz ve talep birbirine
-- bağlı. Gerçek zarar şu: tarlacı, PARASINI ÖDEMİŞ bir kanalın değerlendirme kotasını
-- gürültüyle doldurup karşılığında kendi testine gerçek geri bildirim alıyor. Kaybeden
-- tarlacı değil, karşısındaki kanal.
--
-- O yüzden doğru kol "kredi üretimini kıs" değil, "kalitesiz değerlendirmenin HACMİNİ
-- sınırla". Tavan kaliteyi hiç yargılamıyor; bu bilerek böyle. Desen tespiti (hep aynı
-- konum, hep sıfırıncı saniye) rastgeleleştirilerek atlatılabiliyor, ama hacim tavanı
-- atlatılamaz: tarlacının saatlik verimini doğrudan kesiyor.
--
-- 20 NEREDEN GELİYOR: dürüst tarafa değmeyecek kadar yüksek, tarlacıyı anlamlı biçimde
-- kesecek kadar düşük. Bir değerlendirme en az 20 saniye sürüyor ve pratikte dakikalarca;
-- günde 20 yapan biri zaten olağanüstü bir kullanıcı. Kuzey yıldızımız submission başına
-- ilk 24 saatte gelen değerlendirme sayısı (hedef ≥5) ve bir testin kotası tipik olarak
-- 5-25; yani tek kişinin bir günde doldurabileceği sınır, ürünün ihtiyacının çok üstünde.
-- Gerçek trafik geldiğinde bu sayı tek satırda değiştirilebilsin diye kendi fonksiyonunda.
--
-- KAYAN 24 SAAT, takvim günü değil: takvim günü olsaydı gece yarısı sıfırlanır ve tarlacı
-- iki katını arka arkaya yapardı.
--
-- KONTROL `next_review_task`'TA, `submit_review`'de DEĞİL: işi yaptırıp sonunda reddetmek
-- düşmanca olurdu. Elinde zaten atanmış bir görev varsa onu bitirebiliyor — yarım kalan
-- iş tavana takılıp çöpe gitmiyor.

create or replace function daily_review_limit() returns int
language sql immutable as $fn$ select 20 $fn$;

comment on function daily_review_limit is
  'Kişi başı kayan 24 saatte en fazla kaç değerlendirme. Tarlacılığın hacim tavanı (0039).';

create or replace function next_review_task() returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare
  v_uid uuid := auth.uid();
  v_prof profiles%rowtype;
  v_sub submissions%rowtype;
  v_task review_tasks%rowtype;
  v_decoys jsonb; v_tidx int; v_ttl int; v_pos int; v_today int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_prof from profiles where id = v_uid;
  if v_prof.reputation < 0.3 or v_prof.is_flagged then raise exception 'reviewer_blocked'; end if;

  -- Elindeki iş önce: tavan, başlanmış bir görevi çöpe atmaz.
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

  select count(*)::int into v_today from reviews
   where reviewer_id = v_uid and created_at > now() - interval '24 hours';
  if v_today >= daily_review_limit() then
    -- Sebep satırda: istemci "nişinde test yok" ile "bugünlük doldun"u ayırt edebilsin,
    -- yoksa tavana çarpan kullanıcı ürünün boş olduğunu sanır.
    return jsonb_build_object('task', null, 'reason', 'daily_limit');
  end if;

  select s.* into v_sub
  from submissions s
  where s.status = 'open' and s.closes_at > now()
    and (s.niche_id = v_prof.niche_id or s.niche_id = any(v_prof.also_review_niche_ids))
    and (s.language = v_prof.language or s.language = any(v_prof.also_review_languages))
    and s.owner_id <> v_uid
    and (s.is_demo or s.received_reviews + (select count(*) from review_tasks t where t.submission_id = s.id and t.status='assigned' and t.expires_at > now()) < s.requested_reviews)
    and (
      case when s.is_demo
        then not exists (select 1 from reviews r where r.submission_id = s.id and r.reviewer_id = v_uid)
        else not exists (select 1 from review_tasks t where t.submission_id = s.id and t.reviewer_id = v_uid)
      end
    )
  order by (s.niche_id = v_prof.niche_id) desc, s.is_demo asc, s.is_priority desc, s.created_at asc
  limit 1 for update skip locked;

  if not found then
    select s.* into v_sub
    from submissions s
    where s.is_demo and s.status = 'open' and s.closes_at > now()
      and s.owner_id <> v_uid
      and not exists (select 1 from reviews r where r.submission_id = s.id and r.reviewer_id = v_uid)
    order by (s.language = v_prof.language) desc, s.created_at asc
    limit 1;
  end if;
  if not found then return jsonb_build_object('task', null, 'reason', 'none_available'); end if;

  v_tidx := floor(random() * array_length(v_sub.thumbnail_paths,1))::int;
  v_ttl  := floor(random() * array_length(v_sub.title_options,1))::int;
  v_pos  := floor(random() * 6)::int;
  v_decoys := pick_decoys(v_sub.niche_id, v_sub.title_options[v_ttl + 1], v_sub.is_vertical);
  if jsonb_array_length(v_decoys) < 5 then raise exception 'niche_cache_empty'; end if;

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
end $fn$;

grant execute on function next_review_task to authenticated;
