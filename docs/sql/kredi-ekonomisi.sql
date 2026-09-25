select reason, count(*) as adet, sum(delta) as toplam
from credit_ledger
group by reason
order by abs(sum(delta)) desc;
