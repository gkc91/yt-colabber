-- 0011 — push bildirimleri (C2, PRODUCT §13).
-- Tasarım: tetikleyiciler bildirimi KUYRUĞA yazar, Edge Function 'notify' kuyruğu boşaltır.
-- Gerekçe: kural tarafı pgTAP ile test edilebilir; Expo'ya gönderim hatası veri kaybettirmez,
-- satır kuyrukta kalır ve tekrar denenir.

create type notification_kind as enum (
  'reviews_arriving',  -- test 3 değerlendirmeye ulaştı
  'test_completed',    -- test tamamlandı
  'tasks_waiting'      -- nişinde bekleyen testler var (günde en fazla 1)
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  kind notification_kind not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  attempts int not null default 0,
  error text
);
create index on notifications (sent_at, created_at) where sent_at is null;
create index on notifications (profile_id, kind, created_at desc);

alter table notifications enable row level security;
create policy "notifications self read" on notifications for select using (auth.uid() = profile_id);

-- ---------- submission olayları ----------
create or replace function queue_submission_notifications() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- İlk 3 değerlendirme: "sonuçlar gelmeye başladı"
  if new.received_reviews >= 3 and old.received_reviews < 3 then
    insert into notifications (profile_id, kind, payload)
    values (new.owner_id, 'reviews_arriving',
            jsonb_build_object('submission_id', new.id, 'received', new.received_reviews));
  end if;

  if new.status = 'completed' and old.status <> 'completed' then
    insert into notifications (profile_id, kind, payload)
    values (new.owner_id, 'test_completed',
            jsonb_build_object('submission_id', new.id, 'received', new.received_reviews,
                               'requested', new.requested_reviews));
  end if;

  return new;
end $$;

create trigger submissions_queue_notifications after update on submissions
  for each row execute function queue_submission_notifications();

-- ---------- bekleyen görev hatırlatması ----------
-- Kime: push token'ı olan, bayraksız, son 24 saatte değerlendirme yapmamış ve kapsamındaki
-- (kendi nişi + ek nişler) açık testlerde en az 5 boş slot olan kullanıcılar.
-- Sıklık: 24 saatte en fazla 1 (PRODUCT §13).
create or replace function queue_task_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  with waiting as (
    select p.id as profile_id
    from profiles p
    where p.expo_push_token is not null
      and not p.is_flagged
      and p.reputation >= 0.3
      and p.onboarding_done
      -- son 24 saatte değerlendirme yapmamış
      and not exists (
        select 1 from reviews r
        where r.reviewer_id = p.id and r.created_at > now() - interval '24 hours')
      -- son 24 saatte bu bildirimi almamış
      and not exists (
        select 1 from notifications n
        where n.profile_id = p.id and n.kind = 'tasks_waiting'
          and n.created_at > now() - interval '24 hours')
      -- kapsamında en az 5 boş slot
      and (
        select coalesce(sum(s.requested_reviews - s.received_reviews), 0)
        from submissions s
        where s.status = 'open' and s.closes_at > now()
          and s.owner_id <> p.id
          and (s.niche_id = p.niche_id or s.niche_id = any(p.also_review_niche_ids))
          and (s.language = p.language or s.language = any(p.also_review_languages))
          and not exists (select 1 from review_tasks t
                          where t.submission_id = s.id and t.reviewer_id = p.id)
      ) >= 5
  )
  insert into notifications (profile_id, kind, payload)
  select profile_id, 'tasks_waiting', '{}'::jsonb from waiting;

  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke execute on function queue_task_reminders from public, anon, authenticated;

-- ---------- cron ----------
-- Kuyruğu boşalt: her 5 dakikada bir 'notify' Edge Function'ı (Vault sırları 0006'daki gibi).
create or replace function trigger_notify() returns void
language plpgsql security definer set search_path = public as $$
declare v_url text; v_key text;
begin
  if not exists (select 1 from notifications where sent_at is null and attempts < 5) then
    return;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_url is null or v_key is null then
    raise notice 'notify atlandı: project_url / service_role_key Vault''ta yok';
    return;
  end if;

  perform net.http_post(
    url := v_url || '/functions/v1/notify',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
    body := '{}'::jsonb);
end $$;

revoke execute on function trigger_notify from public, anon, authenticated;

select cron.schedule('drain_notifications', '*/5 * * * *', $$select trigger_notify()$$);
-- Hatırlatmalar: günde bir kez, akşam (kullanıcıların uygulamayı açtığı saat).
select cron.schedule('queue_task_reminders', '0 18 * * *', $$select queue_task_reminders()$$);
