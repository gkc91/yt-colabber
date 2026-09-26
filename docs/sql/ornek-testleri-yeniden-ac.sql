-- Bir değerlendiricinin ÖRNEK (demo) testlerini yeniden değerlendirilebilir yapar.
--
-- Ne zaman: havuz o kişi için tükendiğinde ve denemeye devam etmesi gerektiğinde.
-- Günlük işleyişte kullanılmaz — 0019 örnek testin aynı kişiye ikinci kez gitmesini
-- bilerek engelliyor (kredi çiftlenmesin diye).
--
-- Neden bu kadar uzun: tek başına `delete from reviews` ekonomiyi bozar.
--   * submissions.received_reviews şişik kalır → sahibinin sonuç ekranı yalan söyler
--   * profiles.reviews_given / reviews_received şişik kalır
--   * kazanılan kredi ledger'da durur ve aynı test ikinci kez kredi kazandırır
-- `credit_ledger` append-only olduğu için kredi SİLİNMEZ; aynı sayıda negatif satırla
-- dengelenir ('admin' sebebiyle, yani "elle yapılmış bir düzeltme" diye okunur).
--
-- Kullanım: aşağıdaki profil kimliğini değiştir, Supabase paneli → SQL Editor'a yapıştır.

with hedef as (select 'e225fc27-9cbe-4f26-be18-6e727a2fea31'::uuid as profile_id),
deleted as (
  delete from reviews r using submissions s, hedef h
  where r.submission_id = s.id and s.is_demo and r.reviewer_id = h.profile_id
  returning r.submission_id, s.owner_id
),
per_sub as (select submission_id, owner_id, count(*)::int as n from deleted group by 1, 2),
total as (select coalesce(sum(n), 0)::int as n from per_sub),
fix_sub as (
  update submissions s set received_reviews = greatest(s.received_reviews - p.n, 0)
  from per_sub p where s.id = p.submission_id returning 1
),
fix_owner as (
  update profiles o set reviews_received = greatest(o.reviews_received - x.n, 0)
  from (select owner_id, sum(n)::int as n from per_sub group by 1) x
  where o.id = x.owner_id returning 1
),
fix_reviewer as (
  update profiles p set reviews_given = greatest(p.reviews_given - (select n from total), 0)
  from hedef h where p.id = h.profile_id returning 1
),
compensate as (
  insert into credit_ledger (profile_id, delta, reason)
  select h.profile_id, -(select n from total), 'admin' from hedef h
  where (select n from total) > 0
  returning 1
)
select (select n from total)        as silinen_degerlendirme,
       (select count(*) from per_sub) as yeniden_acilan_ornek_test;
