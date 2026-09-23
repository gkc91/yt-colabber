-- 0013 — profil ekranı (C4): niş değiştirme ve hesap silmeye hazırlık.

-- ---------- niş değiştirme (ayda 1) ----------
alter table profiles add column niche_changed_at timestamptz;

create or replace function change_niche(p_niche_id int) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_last timestamptz; v_current int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from niches where id = p_niche_id and is_active) then
    raise exception 'unknown_niche';
  end if;

  select niche_id, niche_changed_at into v_current, v_last from profiles where id = v_uid;
  if v_current = p_niche_id then return; end if;
  -- Ayda bir: niş sık sık değişirse hem eşleştirme hem sonuçların anlamı bozulur.
  if v_last is not null and v_last > now() - interval '30 days' then
    raise exception 'niche_change_too_soon';
  end if;

  update profiles
     set niche_id = p_niche_id,
         niche_changed_at = now(),
         -- Yeni niş ek listede kalmasın (kendi nişi zaten kapsam içinde).
         also_review_niche_ids = array_remove(also_review_niche_ids, p_niche_id)
   where id = v_uid;
end $$;

grant execute on function change_niche to authenticated;

-- ---------- hesap silme: başkalarının sonuçları bozulmasın ----------
-- Kullanıcı silindiğinde YAZDIĞI değerlendirmeler de siliniyordu: bu, başka insanların
-- kredi ödeyip aldığı geri bildirimi ve submissions.received_reviews sayacını bozuyordu.
-- Artık değerlendirme kalır, kimliği düşer (reviewer_id null).
alter table reviews alter column reviewer_id drop not null;
alter table reviews drop constraint reviews_reviewer_id_fkey;
alter table reviews add constraint reviews_reviewer_id_fkey
  foreign key (reviewer_id) references profiles(id) on delete set null;

-- Görev satırı operasyoneldir ve silinebilir; değerlendirmeyi peşinden götürmemeli.
alter table reviews alter column task_id drop not null;
alter table reviews drop constraint reviews_task_id_fkey;
alter table reviews add constraint reviews_task_id_fkey
  foreign key (task_id) references review_tasks(id) on delete set null;

-- Kimliği düşmüş değerlendirme artık kimseye ait değildir; RLS yalnızca submission sahibine gösterir.
drop policy if exists "reviews owner or author" on reviews;
create policy "reviews owner or author" on reviews for select
  using (
    (reviewer_id is not null and auth.uid() = reviewer_id)
    or auth.uid() = (select owner_id from submissions s where s.id = submission_id)
  );
