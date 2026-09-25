select left(s.title_options[1], 40) as baslik,
       n.name as nis,
       count(distinct r.reviewer_id) as kac_kisi_degerlendirdi
from submissions s
join niches n on n.id = s.niche_id
left join reviews r on r.submission_id = s.id
where s.is_demo
group by s.id, n.name
order by 3 desc;
