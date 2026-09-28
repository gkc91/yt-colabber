-- 0029 — rapor eşiği iki yönlü düşünülmüş hâliyle.
--
-- İki karşıt zarar var ve kural ikisini birden gözetmek zorunda:
--
--   A) Zararlı içerik yavaş kaldırılırsa → onu GÖREN insanlar bedelini öder, geri alınamaz.
--      Eski kural her sebep için 3 rapor istiyordu: cinsel ya da taciz içeren bir test için
--      üç kişinin onu açması gerekiyordu.
--
--   B) Eşik 1'e indirilirse → iyi niyetli bir kanal, tek kötü niyetli raporla susturulabilir.
--      Sahibin emeği çöpe gider ve elinde itiraz edecek bir şey kalmaz.
--
-- Kural şöyle kuruldu:
--
--   * Ağır sebepler (inappropriate, abusive) TEK raporla gizler — ama yalnızca rapor
--     "ağırlıklı" bir değerlendiriciden geliyorsa: bayraksız, itibarı ≥ 0.8 ve en az bir
--     değerlendirme yazmış biri. Yeni açılmış bir hesap tek başına kimseyi susturamaz;
--     önce gerçekten iş yapması gerekir.
--   * Ağırlıksız rapor kaybolmuyor, sayılıyor — yalnızca tek başına yetmiyor (3 gerekir).
--   * Spam/telif/diğer 3'te kalıyor: orada acele etmenin karşılığı yok.
--
-- Hedefli saldırı zaten zor: `report_content` raporu yalnızca o test için GÖREVİ OLAN
-- kişiden kabul ediyor ve görevler rastgele dağıtılıyor. Kimse rakibinin testini seçip
-- raporlayamaz; o teste denk gelmesi gerekir.
--
-- Gizlenen testin sebebi artık satırda duruyor: sahibi neden durduğunu görebilsin ve
-- itiraz edebilsin. Otomatik kural ne kadar iyi kurulursa kurulsun, son sözü insan söyler.

alter table submissions add column hidden_reason text;

comment on column submissions.hidden_reason is
  'Testi gizleten rapor sebebi. Sahibine gösterilir ve itiraz değerlendirilirken okunur.';

create or replace function report_threshold(p_reason text, p_weighted boolean)
returns int language sql immutable as $fn$
  select case
    when p_reason in ('inappropriate', 'abusive') and p_weighted then 1
    else 3
  end;
$fn$;

comment on function report_threshold is
  'Gizleme için gereken rapor sayısı. Ağır sebep + ağırlıklı raporcu = 1; diğer her durumda 3.';

/**
 * Raporu "ağırlıklı" sayan koşullar. Hepsi raporcunun daha önce gerçek iş yapmış
 * olmasını istiyor: bayraksız, itibarı düşmemiş ve en az bir değerlendirme yazmış.
 */
create or replace function report_is_weighted(p_reporter uuid) returns boolean
language sql stable security definer set search_path = public as $fn$
  select coalesce(
    (select not p.is_flagged and p.reputation >= 0.8 and p.reviews_given >= 1
       from profiles p where p.id = p_reporter),
    false);
$fn$;

create or replace function on_report() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare v_sub submissions%rowtype; v_limit int;
begin
  if new.target_type = 'submission' then
    update submissions set report_count = report_count + 1 where id = new.target_id;

    select * into v_sub from submissions where id = new.target_id for update;
    v_limit := report_threshold(new.reason, report_is_weighted(new.reporter_id));

    if v_sub.report_count >= v_limit and v_sub.status = 'open' then
      update submissions set status = 'hidden', hidden_reason = new.reason where id = v_sub.id;
      -- Gizlenen test artık değerlendirme alamaz; kullanılmayan kredi askıda kalmamalı.
      -- Yanlış rapor durumunda da kişi kredisini geri alır, yani en kötü ihtimalde
      -- kaybettiği şey zaman olur, kredi değil.
      if v_sub.requested_reviews > v_sub.received_reviews then
        insert into credit_ledger (profile_id, delta, reason, ref_id, note)
        values (v_sub.owner_id, v_sub.requested_reviews - v_sub.received_reviews, 'refund',
                v_sub.id, 'hidden_after_reports');
      end if;
    end if;

  elsif new.target_type = 'review' then
    -- Değerlendirme gizlenmez ve itibar düşürülmez: doğrulanmamış tek taraflı rapor ceza
    -- olamaz, aksi halde olumsuz ama dürüst geri bildirim raporlanarak sildirilebilirdi.
    update reviews set is_reported = true where id = new.target_id;
  end if;

  return new;
end $fn$;
