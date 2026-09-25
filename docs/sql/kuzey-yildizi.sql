select s.id,
       left(s.title_options[1], 40) as baslik,
       s.created_at::date            as acildi,
       count(r.id) filter (where r.created_at <= s.created_at + interval '24 hours') as ilk_24s,
       s.requested_reviews           as istenen,
       s.status
from submissions s
left join reviews r on r.submission_id = s.id
where not s.is_demo
group by s.id
order by s.created_at desc
limit 20;
