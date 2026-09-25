# METRICS.md — Neler oluyor, nereden bakılır

> Ayrı bir admin paneli **yok ve şimdilik gerekmiyor**: Supabase'in kendi ekranları
> (Auth → Users, Table Editor, SQL Editor) bu işi görüyor. Aşağıdaki sorgular
> **Supabase paneli → SQL Editor**'a yapıştırılır ve "Save query" ile kaydedilir;
> bir daha yazmak gerekmez. Hepsi yalnızca okur.
>
> Panel yazmak ne zaman mantıklı olur: günde birkaç kez bakmaya başladığında ve
> telefondan bakmak istediğinde. O noktaya gelene kadar panel, bakımı olan ama
> kimseye bir şey kazandırmayan ikinci bir üründür.

## 1. Günlük özet (tek satır)

```sql
select
  (select count(*) from profiles)                                                as kullanici,
  (select count(*) from profiles where created_at > now() - interval '24 hours') as kullanici_24s,
  (select count(*) from submissions where not is_demo)                           as gercek_test,
  (select count(*) from reviews)                                                 as degerlendirme,
  (select count(*) from reviews where created_at > now() - interval '24 hours')  as degerlendirme_24s,
  (select coalesce(sum(delta), 0) from credit_ledger)                            as dolasimdaki_kredi;
```

## 2. Kuzey yıldızı: submission başına ilk 24 saatte gelen değerlendirme

CLAUDE.md'deki tek ölçü. **5'in altındaysa yeni özellik değil, değerlendirici
tarafı düzeltilir.**

```sql
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
```

## 3. Yeni kullanıcılar ve ne yaptıkları

Kayıt olup hiç değerlendirme yapmayan biri, ürünün ilk dakikasının çalışmadığını
söyler. Sayı değil, oran önemlidir.

```sql
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
```

## 4. Kredi ekonomisi dengede mi

`credit_ledger` append-only; bakiye buradan türetilir. Kazanılan çok, harcanan az
ise testler açılmıyor demektir; tersi ise değerlendirici sıkıntısı var demektir.

```sql
select reason, count(*) as adet, sum(delta) as toplam
from credit_ledger
group by reason
order by abs(sum(delta)) desc;
```

## 5. Sıkışan yerler (değerlendirici tarafı)

Açılıp bitmeyen görev, akışın bir yerinde takılan insan demektir. Süresi dolan
görevlerin oranı yükseliyorsa, sebebi genelde teknikdir (2026-09-25'te medya
yüklenmiyordu ve üç görev de böyle düştü).

```sql
select t.status, count(*) as adet,
       round(avg(extract(epoch from (coalesce(r.created_at, t.expires_at) - t.assigned_at)))) as ortalama_saniye
from review_tasks t
left join reviews r on r.task_id = t.id
group by t.status;
```

## 6. Örnek (demo) testler tükendi mi

Yeni gelen biri boş ekran görmesin diye en az birkaç örnek testin **hiç
değerlendirilmemiş** olması gerekir. Herkes hepsini değerlendirdiyse havuz boştur;
yeni örnek yüklenir (`seeds/demo/README.md`).

```sql
select left(s.title_options[1], 40) as baslik,
       n.name as nis,
       count(distinct r.reviewer_id) as kac_kisi_degerlendirdi
from submissions s
join niches n on n.id = s.niche_id
left join reviews r on r.submission_id = s.id
where s.is_demo
group by s.id, n.name
order by 3 desc;
```

## 7. Olay tarafı (PostHog)

Yukarıdakiler "ne oldu" sorusuna cevap verir; "nerede bıraktı" sorusuna PostHog
cevap verir (E4'te sekiz adlandırılmış olay gönderiliyor). Huni:
`onboarding_done → task_started → review_submitted` ve `submission_created`.
Hesap kurulumu `docs/SENIN-YAPACAKLARIN.md` §6'da.

## Yerelde çalıştırmak

```powershell
pnpm exec supabase db query --linked -f docs/sql/ozet.sql   # canlı (okuma)
pnpm exec supabase db query --local  -f docs/sql/ozet.sql   # yerel
```
