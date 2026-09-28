-- 0035 — itirazı kazanan test, geri alınmış raporların yüküyle geri dönmesin.
--
-- BULGU (2026-09-28, yerelde üretildi): `restore_submission` durumu `open` yapıyor,
-- sebebi siliyor, krediyi yeniden düşüyor ve raporları `overturned` işaretliyordu —
-- ama `submissions.report_count`'a dokunmuyordu. `on_report` ise o sayacı ham okuyor,
-- geri alınıp alınmadığına bakmıyor.
--
-- Sonuç: üç haksız raporla gizlenen, itirazı kabul edilen ve geri açılan bir test
-- `report_count = 3` ile açılıyor. Dördüncü rapor sayacı 4'e çıkarıyor, eşik 3 olduğu için
-- test ANINDA yeniden gizleniyor. Yani itiraz kazanmak kişiyi korumuyor, yalnızca bir tur
-- erteliyor — ve 0030'un bütün gerekçesi buydu: tek ağırlıklı raporla gizlemeyi
-- savunulabilir kılan şey itirazın GERÇEKTEN bir karşılık olması.
--
-- Düzeltme: geri açarken sayaç, geri ALINMAMIŞ raporların sayısına çekiliyor. Sıfırlamak
-- yerine yeniden saymak bilerek: ileride raporların bir kısmı haklı bir kısmı haksız
-- bulunursa doğru olan davranış bu, ve bugün de aynı sonucu veriyor.
--
-- Raporları işaretleme adımı yukarı alındı: sayaç onlardan hesaplandığı için önce
-- işaretlenmeleri gerekiyor.

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

  -- Raporu veren(ler) yanılmış: ağırlıkları düşsün. Yanlış raporun bugüne kadar raporcuya
  -- hiçbir maliyeti yoktu. Sayaç bundan hesaplandığı için bu adım ÖNCE geliyor.
  update reports set overturned = true
   where target_type = 'submission' and target_id = v_sub.id;

  update submissions
     set status = 'open',
         hidden_reason = null,
         hidden_at = null,
         requested_reviews = v_sub.received_reviews + v_charge,
         -- Geri alınan raporlar artık saymıyor: yoksa test, aklandığı raporların yüküyle
         -- açılır ve tek yeni rapor onu anında yeniden gizlerdi.
         report_count = (select count(*)::int from reports
                          where target_type = 'submission' and target_id = v_sub.id
                            and not overturned),
         -- Gizli kaldığı süre geri veriliyor: kaybettiği şey zaman olmasın.
         closes_at = now() + (v_sub.closes_at - coalesce(v_sub.hidden_at, now()))
   where id = v_sub.id;

  update appeals set status = 'accepted', resolved_at = now(), resolution_note = p_note
   where submission_id = v_sub.id;
end $fn$;

revoke execute on function restore_submission from public, anon, authenticated;
