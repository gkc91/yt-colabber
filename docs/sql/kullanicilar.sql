select p.id,
       p.created_at::date as kayit,
       n.name             as nis,
       p.language         as dil,
       p.onboarding_done  as kurulum_bitti,
       p.reviews_given    as verdigi,
       p.reviews_received as aldigi,
       p.reputation       as itibar,
       (select coalesce(sum(delta), 0) from credit_ledger c where c.profile_id = p.id) as kredi
from profiles p
left join niches n on n.id = p.niche_id
order by p.created_at desc
limit 50;
