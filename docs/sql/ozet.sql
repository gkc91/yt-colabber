select
  (select count(*) from profiles)                                                as kullanici,
  (select count(*) from profiles where created_at > now() - interval '24 hours') as kullanici_24s,
  (select count(*) from submissions where not is_demo)                           as gercek_test,
  (select count(*) from reviews)                                                 as degerlendirme,
  (select count(*) from reviews where created_at > now() - interval '24 hours')  as degerlendirme_24s,
  (select coalesce(sum(delta), 0) from credit_ledger)                            as dolasimdaki_kredi;
