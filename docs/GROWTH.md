# GROWTH.md — Dağıtım ve SEO planı

> Bu belge "kullanıcıyı nereden bulacağız" sorusunun cevabı. Ürün kararları PRODUCT.md'de,
> sıralı işler TASKS.md'de. Buradaki her madde ölçülebilir olmalı; ölçülemeyen kanal denenmez.

## 1. Temel kısıt: iki taraflı ürün

Biri test açtığında, **aynı nişte o testi değerlendirecek insanların zaten uygulamada olması**
gerekir. Bu yüzden büyüme sırası şudur ve değiştirilemez:

1. Tek bir nişte yeterli değerlendirici topla (arz).
2. O nişte test açanları çağır (talep).
3. Ancak ondan sonra geniş kanallar (SEO, mağaza araması) açılır.

Sıra bozulursa: gelen kullanıcı boş ekran görür, değerlendirme alamaz, bir daha dönmez.
Pahalı kanaldan gelen trafiği boş bir odaya sokmuş oluruz.

**Kuzey yıldızı (PRODUCT'tan):** submission başına ilk 24 saatte gelen değerlendirme sayısı.
5'in altındaysa yeni kanal açılmaz; önce değerlendirici tarafı düzeltilir.

## 2. Aşama 0 — İlk 100 değerlendirici (elle, ~2-4 hafta)

Hedef: **tek nişte** 60-100 aktif değerlendirici. Niş seçimi: kendi tanıdığımız ve
İngilizce içerik üretenlerin yoğun olduğu bir alan (öneri: gaming ya da animation).

Nerede:
- **r/NewTubers, r/youtubers, r/PartneredYoutube** — "geri bildirim" günlerinde ve kendi
  gönderimizle. Reddit self-promo kurallarına dikkat; önce cevap yazarak katkı ver.
- **YouTube'cu Discord sunucuları** — "feedback" kanalları olanlar. Moderatörden izin al.
- **Türkçe topluluklar** — içerik üretici Facebook/Telegram grupları, üniversite kulüpleri.
- **Küçük kanalların yorumları** — spam değil: videoyu gerçekten izleyip thumbnail hakkında
  somut bir şey söyleyerek, ardından davet.

Mesaj (kısa hali): "Thumbnail'ını yayından önce nişindeki 5 kişiye test ettir. Karşılığında
sen de 5 kişinin videosuna bakarsın. İzlenme/abone takası değil; sadece ilk izlenim testi."

Ölçüm: hafta sonunda kaç kayıt, kaç değerlendirme, kuzey yıldızı.

## 3. Aşama 1 — Mağaza araması (ASO, E3 ile birlikte)

Mağaza araması SEO'dan daha erken karşılık verir; rekabet düşük.

- **App Store / Play başlığı ve alt başlığı:** "Clickable — Thumbnail & Hook Test" gibi,
  aranan kelimeleri taşısın.
- **Anahtar kelimeler:** thumbnail test, thumbnail a/b, youtube ctr, video hook, creator feedback.
- **Ekran görüntüleri:** ilk görsel testin kendisini göstersin (feed ızgarası + sonuç yüzdesi).
- **İlk 10 değerlendirme:** erken kullanıcılardan dürüstçe iste; mağaza sıralamasında ağırlığı var.

## 4. Aşama 2 — SEO (landing E1 yayına girdikten sonra)

Karşılığını 3. aydan sonra verir; bu yüzden **landing'i erken yayına almak** önemlidir.
Saat, sayfa yayınlandığı gün işlemeye başlar.

### Sayfa yapısı (tek sayfa yetmez)
| Sayfa | Hedef arama niyeti |
|---|---|
| `/` | marka + "thumbnail test" |
| `/thumbnail-test` | "youtube thumbnail test", "thumbnail a/b test free" |
| `/hook-test` | "video hook test", "first 60 seconds retention" |
| `/for/<nis>` (15 adet, programatik) | "thumbnail test for gaming channels" gibi uzun kuyruk |
| `/blog/<yazi>` | bilgi amaçlı aramalar |
| `/tr/...` | Türkçe karşılıklar |

### Anahtar kelimeler (öncelik sırası)
- İngilizce: `youtube thumbnail test`, `thumbnail a/b test free`, `test thumbnail before uploading`,
  `youtube ctr improve`, `youtube hook test`, `thumbnail feedback`
- Türkçe: `thumbnail testi`, `youtube kapak fotoğrafı testi`, `tıklanma oranı artırma`,
  `video ilk 60 saniye`

### Teknik gereksinimler (E1'de yapılacak)
- Her sayfada benzersiz `<title>` ve meta açıklama; Open Graph görselleri.
- `sitemap.xml`, `robots.txt`, `hreflang` (en/tr), schema.org `SoftwareApplication`.
- Core Web Vitals: Astro + Cloudflare Pages zaten hızlı; görseller `astro:assets` ile.
- Mağaza bağlantıları ve "uygulamada aç" akışı (PRODUCT §14).

## 5. Aşama 3 — Kendi verimizle içerik

En savunulabilir kanal bu: **veriye kimse sahip değil, biz üretiyoruz.**

Örnek yazılar (test sayısı biriktikçe):
- "500 thumbnail testinden çıkan 7 sonuç"
- "Yüz ifadesi tıklanmayı artırıyor mu? 120 testin cevabı"
- "İnsanlar ilk 60 saniyede en çok kaçıncı saniyede bırakıyor?"

Kural: sayılar gerçek olacak, örneklem büyüklüğü yazılacak, kullanıcı videoları izinsiz
paylaşılmayacak (anonim toplulaştırma).

Yan kanal: aynı içerikten kısa video (Shorts/TikTok) — "3 thumbnail'ı 50 kişiye test ettik".

## 6. Yapmayacaklarımız

- İzlenme/abone vaadi, sub4sub, etkileşim takası (PRODUCT §9; YouTube kanal kapatmaya kadar gider).
- Satın alınmış trafik/bot kayıt; kredi ekonomisini bozar, anti-fraud zaten bayraklar.
- Toplu DM/e-posta spam'i; Reddit ve Discord'da ban, mağazada şikâyet demektir.
- Sahte inceleme ve sahte kullanıcı yorumu.

## 7. Ölçüm

PostHog olayları (E4'te kurulacak) ile:
- `signup` → `onboarding_done` → `review_submitted` → `submission_created` hunisi.
- Kanal ayrımı: landing'e UTM (`?utm_source=reddit`), mağaza için Play/App Store kaynak raporu.
- Haftalık tek tablo: kaynak, kayıt, ilk değerlendirme yapan, kuzey yıldızı.

Karar kuralı: bir kanal 2 hafta üst üste kuzey yıldızını düşürüyorsa (kalitesiz kayıt getiriyorsa)
kapatılır; kayıt sayısı değil, döngüye katılma oranı ölçülür.
