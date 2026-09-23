-- 0012 — rapor akışı (C3, PRODUCT §11).
-- Eksikler: (1) raporu kimin verebileceği kontrol edilmiyordu, (2) 3 rapora ulaşıp gizlenen
-- testin kullanılmayan kredisi sahibinde askıda kalıyordu, (3) rapor sebebi serbest metindi.

-- Sebep sabit kodlardan seçilir; serbest metin ayrı alanda (analiz ve moderasyon için).
alter table reports
  add column note text,
  add constraint reports_reason_check
    check (reason in ('inappropriate', 'spam', 'abusive', 'copyright', 'other'));

alter table reviews add column is_reported boolean not null default false;

-- Raporu yalnızca içeriği GÖRMÜŞ kişi verebilir:
--   submission → o submission için görevi olan değerlendirici
--   review     → o değerlendirmeyi alan submission'ın sahibi
-- Doğrudan insert kapalı; herkes bu fonksiyondan geçer.
create or replace function report_content(
  p_target_type text, p_target_id uuid, p_reason text, p_note text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_ok boolean;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_target_type not in ('submission', 'review') then raise exception 'invalid_target'; end if;
  if p_reason not in ('inappropriate','spam','abusive','copyright','other') then
    raise exception 'invalid_reason';
  end if;

  if p_target_type = 'submission' then
    select exists (
      select 1 from review_tasks t where t.submission_id = p_target_id and t.reviewer_id = v_uid
    ) into v_ok;
  else
    select exists (
      select 1 from reviews r join submissions s on s.id = r.submission_id
      where r.id = p_target_id and s.owner_id = v_uid
    ) into v_ok;
  end if;
  if not v_ok then raise exception 'no_access'; end if;

  insert into reports (reporter_id, target_type, target_id, reason, note)
  values (v_uid, p_target_type, p_target_id, p_reason, p_note)
  on conflict (reporter_id, target_type, target_id) do nothing;
end $$;

grant execute on function report_content to authenticated;
revoke insert on reports from anon, authenticated;

drop policy if exists "reports insert" on reports;
create policy "reports self read" on reports for select using (auth.uid() = reporter_id);

-- Rapor sonrası: sayaç, gizleme ve İADE.
-- Gizlenen testin kalan kredisi sahibine döner: test artık değerlendirme alamaz, kredi askıda kalmamalı.
create or replace function on_report() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_sub submissions%rowtype;
begin
  if new.target_type = 'submission' then
    update submissions set report_count = report_count + 1 where id = new.target_id;

    select * into v_sub from submissions where id = new.target_id for update;
    if v_sub.report_count >= 3 and v_sub.status = 'open' then
      update submissions set status = 'hidden' where id = v_sub.id;
      if v_sub.requested_reviews > v_sub.received_reviews then
        insert into credit_ledger (profile_id, delta, reason, ref_id, note)
        values (v_sub.owner_id, v_sub.requested_reviews - v_sub.received_reviews, 'refund',
                v_sub.id, 'hidden_after_reports');
      end if;
    end if;

  elsif new.target_type = 'review' then
    -- Değerlendirme gizlenmez ve itibar düşürülmez: doğrulanmamış tek taraflı rapor ceza olamaz,
    -- aksi halde olumsuz ama dürüst geri bildirim raporlanarak sildirilebilirdi. İşaret bırakılır.
    update reviews set is_reported = true where id = new.target_id;
  end if;

  return new;
end $$;
