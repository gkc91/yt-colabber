-- 0031 — `screening` durumu.
--
-- Ayrı migration olmasının sebebi teknik: Postgres'te `alter type ... add value` ile
-- eklenen bir enum değeri AYNI transaction içinde kullanılamıyor. Kullanan her şey
-- 0032'de.
--
-- Neden yeni bir durum: yüklenen test, taraması bitene kadar hiç kimseye gösterilmemeli.
-- Bunu client'ın çağırdığı bir kontrole bırakmak olmazdı — client atlayabilir. Test
-- `screening` olarak doğuyor ve `next_review_task` yalnızca `open` olanlara bakıyor,
-- yani taranmamış bir şeyin havuza sızması için ayrıca bir hata gerekir.

alter type submission_status add value if not exists 'screening';
