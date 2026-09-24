-- 0016 — AI özeti: hak kontrolü ve kullanım sınırı (D3).
--
-- Özet bizim Anthropic anahtarımızla üretiliyor, yani her çağrı bizim paramız. Üç koruma:
--   1. Test başına tek özet (zaten `submissions.ai_summary` içinde önbelleklenir).
--   2. Yeterli veri yoksa üretilmez — 5 kişiden "desen" çıkarmak uydurma olur.
--   3. Kişi başına 30 günde en fazla N özet.
--
-- Sayaç `ai_summary_runs` tablosudur: talep ÖNCE yazılır (yer ayrılır), üretim başarısız
-- olursa geri alınır. Böylece iki eşzamanlı istek tek özet üretir ve bizim hatamız
-- kullanıcının hakkından düşmez.

create table ai_summary_runs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  submission_id uuid not null unique references submissions(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index on ai_summary_runs (profile_id, created_at desc);

alter table ai_summary_runs enable row level security;
create policy "ai summary runs self read" on ai_summary_runs
  for select using (profile_id = auth.uid());

comment on table ai_summary_runs is
  'AI özeti kullanım sayacı (D3). Satır = bir test için ayrılmış hak; üretim başarısız olursa silinir.';

create or replace function ai_summary_limit() returns int language sql immutable as $$ select 30 $$;
create or replace function ai_summary_min_reviews() returns int language sql immutable as $$ select 8 $$;

-- ---------- hak talebi (yalnızca Edge Function) ----------
-- Dönüş: ok | no_access | pro_required | already_generated | not_enough_reviews
--        | monthly_limit | in_progress
create or replace function claim_ai_summary(p_profile uuid, p_submission uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_sub submissions%rowtype; v_used int;
begin
  select * into v_sub from submissions where id = p_submission;
  if not found or v_sub.owner_id <> p_profile then return 'no_access'; end if;
  if not is_pro(p_profile) then return 'pro_required'; end if;
  if v_sub.ai_summary is not null then return 'already_generated'; end if;
  if v_sub.received_reviews < ai_summary_min_reviews() then return 'not_enough_reviews'; end if;

  select count(*) into v_used from ai_summary_runs
   where profile_id = p_profile and created_at > now() - interval '30 days';
  if v_used >= ai_summary_limit() then return 'monthly_limit'; end if;

  -- Eşzamanlı iki istek: yalnızca biri satırı yazabilir, diğeri 'in_progress' alır.
  insert into ai_summary_runs (profile_id, submission_id) values (p_profile, p_submission)
    on conflict (submission_id) do nothing;
  if not found then return 'in_progress'; end if;

  return 'ok';
end $$;

-- Üretim başarısız olursa ayrılan hak geri verilir. Yalnızca taze talep silinebilir:
-- eski ve başarılı bir kaydı silip sayacı sıfırlamak mümkün olmasın.
create or replace function release_ai_summary_claim(p_submission uuid)
returns void language sql security definer set search_path = public as $$
  delete from ai_summary_runs
   where submission_id = p_submission and created_at > now() - interval '15 minutes';
$$;

revoke execute on function claim_ai_summary(uuid, uuid) from public, anon, authenticated;
revoke execute on function release_ai_summary_claim(uuid) from public, anon, authenticated;

-- ---------- arayüz için durum ----------
-- Ekran "neden üretemiyorum" sorusunu tahmin etmesin: sunucu söyler.
create or replace function ai_summary_status(p_submission uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_sub submissions%rowtype; v_used int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_sub from submissions where id = p_submission;
  if not found or v_sub.owner_id <> v_uid then raise exception 'no_access'; end if;

  select count(*) into v_used from ai_summary_runs
   where profile_id = v_uid and created_at > now() - interval '30 days';

  return jsonb_build_object(
    'reason', case
      when v_sub.ai_summary is not null then 'already_generated'
      when not is_pro(v_uid) then 'pro_required'
      when v_sub.received_reviews < ai_summary_min_reviews() then 'not_enough_reviews'
      when v_used >= ai_summary_limit() then 'monthly_limit'
      else 'ok' end,
    'used', v_used,
    'limit', ai_summary_limit(),
    'min_reviews', ai_summary_min_reviews(),
    'received_reviews', v_sub.received_reviews);
end $$;
