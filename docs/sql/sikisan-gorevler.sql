select t.status, count(*) as adet,
       round(avg(extract(epoch from (coalesce(r.created_at, t.expires_at) - t.assigned_at)))) as ortalama_saniye
from review_tasks t
left join reviews r on r.task_id = t.id
group by t.status;
