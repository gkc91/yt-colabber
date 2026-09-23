-- 0010 — desen tabanlı anti-fraud (C1, PRODUCT §11).
-- Zaten çalışanlar: 20 sn kuralı (0003), cihaz sınırı (register_device), 3 raporda gizleme (0001).
-- Buradaki kural: son 10 değerlendirmede HEP aynı ızgara pozisyonunu seçmek ya da HEP
-- 0. saniyede çıkmak. İkisi de insan davranışı değil; rastgele seçimde aynı pozisyonun
-- 10 kez üst üste gelme olasılığı milyonda birin altında.

-- Bayrağın nedeni ve zamanı: destek/itiraz için ve C3'te rapor ekranında lazım olacak.
alter table profiles
  add column flagged_at timestamptz,
  add column flagged_reason text;

create or replace function flag_suspicious_reviewer() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_positions int;
  v_zero_leaves int;
  v_total int;
  v_reason text;
begin
  -- Son 10 değerlendirme (bu satır dahil)
  with recent as (
    select picked_position, leave_second
    from reviews
    where reviewer_id = new.reviewer_id
    order by created_at desc
    limit 10
  )
  select count(*),
         count(distinct picked_position),
         count(*) filter (where leave_second = 0)
    into v_total, v_positions, v_zero_leaves
  from recent;

  -- 10 değerlendirme dolmadan karar vermeyiz: az veriyle suçlamak yanlış.
  if v_total < 10 then return new; end if;

  if v_positions = 1 then
    v_reason := 'same_position_10';
  elsif v_zero_leaves = 10 then
    v_reason := 'always_left_at_zero';
  else
    return new;
  end if;

  update profiles
     set reputation = greatest(0.2, reputation - 0.3),
         is_flagged = true,
         flagged_at = now(),
         flagged_reason = v_reason
   where id = new.reviewer_id
     and not is_flagged;  -- aynı kişi için ceza bir kez uygulanır

  return new;
end $$;

create trigger reviews_flag_patterns after insert on reviews
  for each row execute function flag_suspicious_reviewer();

-- Bayraklı kullanıcı görev alamaz (next_review_task zaten is_flagged'a bakıyor);
-- kredi kazancı da durur: submit_review reputation >= 0.5 şartına bağlı ve ceza 0.7'ye düşürür.
