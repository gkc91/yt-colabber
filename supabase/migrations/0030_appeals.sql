-- 0030 — itiraz akışı: gizlenen testin geri dönüş yolu.
--
-- 0029 ağır sebeplerde tek ağırlıklı raporun testi gizlemesini getirdi. Araştırma
-- (2026-09-28) şunu gösterdi: YouTube, Meta ve TikTok'un hiçbiri tek raporla içerik
-- kaldırmıyor — YouTube'un Trusted Flagger'larının bile yetkisi yalnızca raporu inceleme
-- sırasında öne almak. Bizim daha sert davranmamızın tek savunulabilir gerekçesi var:
-- onların kullanıcısı içeriği kaydırıp geçiyor, bizimki kredi karşılığı iki dakika bakmak
-- zorunda. Maruziyet daha derin, o yüzden eşik daha alçak.
--
-- Ama bu gerekçe ancak KARŞILIĞI varsa geçerli: üç platformda da itiraz var ve haklı çıkan
-- içerik geri geliyor. Bizde `hidden` tek yönlüydü — sahibi neden durduğunu bile
-- göremiyordu. Bu migration o eksiği kapatıyor.
--
-- Üç parça:
--   1. Sahibi haberdar olur (bildirim türü `submission_hidden`)
--   2. İtiraz edebilir (`appeal_submission`)
--   3. Haklıysa test geri açılır — kredisi yeniden düşülerek, kaybettiği süre eklenerek
--      (`restore_submission`), ve o raporu veren kişinin rapor ağırlığı düşer.
--
-- Üçüncüsü döngüyü kapatıyor: yanlış raporun şimdiye kadar raporcuya hiçbir maliyeti yoktu.

alter type notification_kind add value if not exists 'submission_hidden';

alter table submissions add column hidden_at timestamptz;

-- Geri alınan rapor: hem raporcunun ağırlığını düşürür hem de ileride "kimler sürekli
-- yanlış rapor veriyor" sorusunun cevabı olur.
alter table reports add column overturned boolean not null default false;

create table appeals (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  note text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  resolution_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (submission_id)
);

alter table appeals enable row level security;
create policy "appeals self read" on appeals for select using (auth.uid() = profile_id);

-- ---------- 1) gizlenince haber ver ----------
create or replace function on_report() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare v_sub submissions%rowtype; v_limit int;
begin
  if new.target_type = 'submission' then
    update submissions set report_count = report_count + 1 where id = new.target_id;

    select * into v_sub from submissions where id = new.target_id for update;
    v_limit := report_threshold(new.reason, report_is_weighted(new.reporter_id));

    if v_sub.report_count >= v_limit and v_sub.status = 'open' then
      update submissions
         set status = 'hidden', hidden_reason = new.reason, hidden_at = now()
       where id = v_sub.id;

      if v_sub.requested_reviews > v_sub.received_reviews then
        insert into credit_ledger (profile_id, delta, reason, ref_id, note)
        values (v_sub.owner_id, v_sub.requested_reviews - v_sub.received_reviews, 'refund',
                v_sub.id, 'hidden_after_reports');
      end if;

      -- Sahibi bunu uygulamayı açtığında tesadüfen öğrenmemeli.
      insert into notifications (profile_id, kind, payload)
      values (v_sub.owner_id, 'submission_hidden',
              jsonb_build_object('submission_id', v_sub.id, 'reason', new.reason));
    end if;

  elsif new.target_type = 'review' then
    update reviews set is_reported = true where id = new.target_id;
  end if;

  return new;
end $fn$;

-- ---------- 2) itiraz ----------
create or replace function appeal_submission(p_submission_id uuid, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare v_uid uuid := auth.uid(); v_sub submissions%rowtype; v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_sub from submissions where id = p_submission_id;
  if v_sub.id is null then raise exception 'unknown_submission'; end if;
  if v_sub.owner_id <> v_uid then raise exception 'not_owner'; end if;
  if v_sub.status <> 'hidden' then raise exception 'not_hidden'; end if;

  insert into appeals (submission_id, profile_id, note)
  values (p_submission_id, v_uid, nullif(trim(coalesce(p_note, '')), ''))
  on conflict (submission_id) do nothing
  returning id into v_id;

  -- İkinci kez itiraz edilemez: aynı testi tekrar tekrar göndermek sırayı tıkardı.
  if v_id is null then raise exception 'already_appealed'; end if;
  return v_id;
end $fn$;

grant execute on function appeal_submission to authenticated;

-- ---------- 3) geri açma ----------
-- Yalnızca service_role. Kararı insan verir; otomatik kural ne kadar iyi kurulursa kurulsun
-- son sözü o söyler (araştırmadaki üç platformda da böyle).
create or replace function restore_submission(p_submission_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_sub submissions%rowtype; v_refunded int; v_balance int; v_charge int;
begin
  select * into v_sub from submissions where id = p_submission_id for update;
  if v_sub.id is null then raise exception 'unknown_submission'; end if;
  if v_sub.status <> 'hidden' then raise exception 'not_hidden'; end if;

  -- Gizlenince iade edilen kredi geri alınır, yoksa test bedava değerlendirme toplardı.
  select coalesce(sum(delta), 0)::int into v_refunded from credit_ledger
   where ref_id = v_sub.id and reason = 'refund' and note = 'hidden_after_reports';

  v_balance := balance_of(v_sub.owner_id);
  -- Bakiye yetmiyorsa istenen değerlendirme sayısı ödeyebildiği kadarına çekilir; kimseyi
  -- eksi bakiyeye düşürmüyoruz.
  v_charge := least(v_refunded, greatest(v_balance, 0));

  if v_charge > 0 then
    insert into credit_ledger (profile_id, delta, reason, ref_id, note)
    values (v_sub.owner_id, -v_charge, 'submission_cost', v_sub.id, 'restored_after_appeal');
  end if;

  update submissions
     set status = 'open',
         hidden_reason = null,
         hidden_at = null,
         requested_reviews = v_sub.received_reviews + v_charge,
         -- Gizli kaldığı süre geri veriliyor: kaybettiği şey zaman olmasın.
         closes_at = now() + (v_sub.closes_at - coalesce(v_sub.hidden_at, now()))
   where id = v_sub.id;

  update appeals set status = 'accepted', resolved_at = now(), resolution_note = p_note
   where submission_id = v_sub.id;

  -- Raporu veren(ler) yanılmış: ağırlıkları düşsün. Yanlış raporun bugüne kadar raporcuya
  -- hiçbir maliyeti yoktu.
  update reports set overturned = true
   where target_type = 'submission' and target_id = v_sub.id;
end $fn$;

revoke execute on function restore_submission from public, anon, authenticated;

create or replace function reject_appeal(p_submission_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  update appeals set status = 'rejected', resolved_at = now(), resolution_note = p_note
   where submission_id = p_submission_id and status = 'pending';
end $fn$;

revoke execute on function reject_appeal from public, anon, authenticated;

-- ---------- raporcu ağırlığı geri alınan raporları sayar ----------
create or replace function report_is_weighted(p_reporter uuid) returns boolean
language sql stable security definer set search_path = public as $fn$
  select coalesce(
    (select not p.is_flagged
        and p.reputation >= 0.8
        and p.reviews_given >= 1
        -- İki kez geri alınmış rapor: bu kişinin tek başına kimseyi susturmasına izin yok.
        and (select count(*) from reports r
              where r.reporter_id = p.id and r.overturned) < 2
       from profiles p where p.id = p_reporter),
    false);
$fn$;
