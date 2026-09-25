# STORE.md — Mağaza listeleme (E3)

> Play Console ve App Store Connect'e **kopyalanacak** metinler ve form cevapları.
> Uydurma yok: her cevap ürünün gerçekte yaptığı şeye dayanır, kaynağı yanında yazılıdır.
> Bir şey değişirse (yeni izin, yeni veri alanı) burası da değişir — mağaza formu kodun
> aynası olmalı, yoksa inceleme aşamasında yakalanır ve sürüm haftalarca gecikir.

## 0. Kimlik

| Alan | Değer |
|---|---|
| Uygulama adı | Clickable |
| Paket adı (Android) | `app.clickable.mobile` |
| Bundle ID (iOS) | `app.clickable.mobile` |
| Geliştirici hesabı | Lampwic Games (Google Play Console) |
| Kategori | Video Players & Editors (ikincil: Productivity) |
| Ücretsiz mi | Evet, uygulama içi satın alma var |
| Reklam | Yok |
| Web sitesi | https://clickabletest.com |
| Gizlilik politikası | https://clickabletest.com/privacy |
| Hesap silme | https://clickabletest.com/delete-account |
| Destek e-postası | support@clickabletest.com |

## 1. Kısa açıklama (Play, en fazla 80 karakter)

**EN** (74):
```
Test your thumbnail, title and first 60 seconds before you hit publish.
```

**TR** (75):
```
Thumbnail, başlık ve ilk 60 saniyeni yayından önce gerçek kişilere test et.
```

## 2. Tam açıklama (Play, en fazla 4000 karakter)

**EN**
```
You only find out if a thumbnail works after you publish. By then it is too late to change
the one thing that decides whether anyone clicks.

Clickable puts your thumbnail, your title and your first 60 seconds in front of real people
in your niche — before you publish.

HOW IT WORKS
1. Upload up to 3 thumbnails, up to 3 titles and your first 60 seconds.
2. Reviewers in your niche see your thumbnail in a grid with five real YouTube videos and
   pick the one they would click. They do not know which one is being tested.
3. They write what they expect the video to be about, then watch your opening and mark the
   second they would have stopped.
4. You get numbers, not compliments: click rate per thumbnail, seconds to decide, what they
   expected from each title, where people dropped off and why.

WHY THE GRID MATTERS
A thumbnail shown on its own always looks fine. The same thumbnail next to five competitors
is a different question, and it is the only question YouTube ever asks. That is why the test
screen looks like a feed and not like an opinion poll.

CREDITS, NOT A SUBSCRIPTION
Give one review, earn one credit. One credit buys one review of your own test. Review a few
videos in your niche and your own test is free. Credit packs and Pro exist if you are in a
hurry; you never need them.

NOTHING HAPPENS ON YOUTUBE
No subscribe-for-subscribe, no view swapping, no engagement trading. Every vote happens
inside this app, by people who do not know whose video they are looking at. That is what
makes the numbers worth reading — and it keeps your channel safe.

YOUR UNPUBLISHED VIDEO STAYS PRIVATE
Only reviewers assigned to your test can see it, inside the app, through short-lived links.
Clips are deleted 30 days after a test closes. Nothing is public, nothing is indexed, nothing
is sold.

WHO IT IS FOR
Channels small enough that one flopped video hurts, in any niche: gaming, finance, education,
cooking, fitness, animation and more.
```

**TR**
```
Bir thumbnail'ın işe yarayıp yaramadığını ancak yayınladıktan sonra öğreniyorsun. O noktada
tıklanmayı belirleyen tek şeyi değiştirmek için çok geç.

Clickable, thumbnail'ını, başlığını ve ilk 60 saniyeni senin nişindeki gerçek insanlara
yayınlamadan önce gösterir.

NASIL ÇALIŞIR
1. 3'e kadar thumbnail, 3'e kadar başlık ve ilk 60 saniyeni yükle.
2. Nişindeki değerlendiriciler thumbnail'ını beş gerçek YouTube videosuyla aynı ızgarada
   görür ve tıklayacakları videoyu seçer. Hangisinin test edildiğini bilmezler.
3. Videonun ne hakkında olduğunu yazarlar, sonra açılışını izleyip bırakacakları saniyeyi
   işaretlerler.
4. Sana övgü değil sayı döner: thumbnail başına tıklanma oranı, karar süresi, her başlıktan
   ne anladıkları, nerede ve neden bıraktıkları.

IZGARA NEDEN ÖNEMLİ
Tek başına duran bir thumbnail hep iyi görünür. Aynı thumbnail beş rakibin yanındayken başka
bir sorudur ve YouTube'un sorduğu tek soru budur. Test ekranının anket değil akış gibi
görünmesinin sebebi bu.

ABONELİK DEĞİL, KREDİ
Bir değerlendirme ver, bir kredi kazan. Bir kredi, kendi testine bir değerlendirme alır.
Nişinden birkaç video değerlendir, kendi testin bedava olsun. Acelen varsa kredi paketi ve
Pro var; mecbur değilsin.

YOUTUBE'DA HİÇBİR ŞEY OLMAZ
Abone ol-abone ol yok, izlenme takası yok, etkileşim ticareti yok. Bütün oylar bu uygulamanın
içinde, kimin videosuna baktığını bilmeyen insanlar tarafından verilir. Sayıları okunmaya
değer kılan da, kanalını güvende tutan da budur.

YAYINLANMAMIŞ VİDEON GİZLİ KALIR
Yalnızca testine atanan değerlendiriciler, uygulama içinde, kısa ömürlü bağlantılarla görür.
Klipler test kapandıktan 30 gün sonra silinir. Hiçbir şey herkese açık değildir, dizine
girmez, satılmaz.

KİMİN İÇİN
Tek bir başarısız videonun canını yaktığı küçük kanallar için — her nişten: oyun, finans,
eğitim, yemek, fitness, animasyon ve diğerleri.
```

## 3. Görseller

| Dosya | Boyut | Nerede |
|---|---|---|
| `store/icon-512.png` | 512×512 | Play mağaza ikonu |
| `store/feature-graphic-1024x500.png` | 1024×500 | Play öne çıkan görsel |
| `apps/mobile/assets/images/icon.png` | 1024×1024 | Uygulama ikonu (build'e girer) |

Hepsi `node scripts/make-icons.mjs` ile üretilir; renkler `docs/DESIGN.md` §3'ten gelir.

**Ekran görüntüleri (eksik, senin çekmen gerekiyor):** Play en az 2, en fazla 8 telefon
görüntüsü ister (16:9 ya da 9:16, kısa kenar ≥ 320 px). Telefonda `app.clickabletest.com`
açıkken şu dört ekran: (1) değerlendirme ızgarası "Which one would you click?",
(2) sonuç ekranı yüzdeleriyle, (3) ilk 60 saniye histogramı, (4) test listesi.
Ekranda başkasının yayınlanmamış videosu OLMAMALI — kendi örnek testlerimizi kullan.

## 4. Data safety (Play → App content → Data safety)

Kaynak: `docs/PRODUCT.md`, `supabase/migrations/0001_init.sql`, `apps/mobile/src/lib/analytics.ts`.

| Soru | Cevap |
|---|---|
| Veri topluyor musunuz? | Evet |
| Aktarımda şifreleniyor mu? | Evet (HTTPS) |
| Kullanıcı silme isteyebilir mi? | Evet — uygulama içinden ve `/delete-account` adresinden |

Toplanan veriler:

| Tür | Toplanıyor | Paylaşılıyor | Zorunlu | Amaç |
|---|---|---|---|---|
| E-posta adresi | Evet | Hayır | Evet | Hesap yönetimi (giriş yalnızca sihirli bağlantı ya da Google) |
| Ad (Google ile girişte) | Evet | Hayır | Hayır | Hesap yönetimi |
| Fotoğraf | Evet | Hayır | Evet | Uygulama işlevi — test ettiğin thumbnail'lar |
| Video | Evet | Hayır | Evet | Uygulama işlevi — test ettiğin ilk 60 saniye |
| Diğer kullanıcı içeriği | Evet | Hayır | Evet | Başlıklar ve değerlendirme yorumları |
| Uygulama etkileşimi | Evet | Hayır | Hayır | Analiz (PostHog, sekiz adlandırılmış olay) |
| Çökme kayıtları | Evet | Hayır | Hayır | Hata ayıklama (Sentry) |
| Cihaz ya da diğer kimlikler | Evet | Hayır | Hayır | Bildirim anahtarı ve çok hesap sınırı |
| Satın alma geçmişi | Evet | Hayır | Hayır | Uygulama işlevi (RevenueCat üzerinden) |

Toplanmayanlar (formda işaretlenmez): konum, kişiler, takvim, SMS, telefon rehberi,
sağlık, finans bilgisi, tarayıcı geçmişi, reklam kimliği.

"Paylaşılıyor" hiçbir satırda Evet değil: Supabase, RevenueCat, PostHog ve Sentry bizim adımıza
işleyen hizmet sağlayıcıları, Play'in tanımında "paylaşım" değil.

## 5. Content rating (Play → İçerik derecelendirme anketi)

| Soru | Cevap | Neden |
|---|---|---|
| Şiddet, cinsellik, küfür, uyuşturucu, kumar | Hayır | Uygulamada böyle içerik üretilmiyor |
| Kullanıcılar içerik paylaşabiliyor mu? | **Evet** | Yüklenen klip ve thumbnail, atanan değerlendiricilere gösteriliyor |
| Kullanıcılar birbiriyle iletişim kurabiliyor mu? | **Hayır** | Mesajlaşma yok; yalnızca yapılandırılmış değerlendirme |
| Konum paylaşımı | Hayır | Konum hiç istenmiyor |
| Kullanıcı içeriği moderasyonu var mı? | **Evet** | Uygulama içi şikâyet (`report_content`), şikâyet eşiğinde otomatik gizleme (0012_reports.sql) |
| Hedef yaş | 18+ | Kanal sahipleri; Families politikası kapsamı dışında |

## 6. İnceleme notları (Play → App access)

```
Sign-in has no password. Two ways in:

1. "Continue with Google" — works with any Google account, including the reviewer's own.
2. "Email me a sign-in link" — a one-time link is sent to any address you control.

After signing in, pick a niche (any) and paste any YouTube channel URL to finish onboarding.
The Review tab will have a practice test waiting; it takes about two minutes and earns a
credit. Creating your own test needs 5 credits, so review a few first, or write to
support@clickabletest.com and we will top up the account you signed in with.

Account deletion: Profile tab -> Account -> Delete my account. Also documented at
https://clickabletest.com/delete-account
```

## 6b. Play Console'da yapılanlar (25 Eylül 2026)

Uygulama oluşturuldu: **Clickable**, `app.clickable.mobile`, Lampwick Games hesabı
(uygulama kimliği 4972807803680658983). Tamamlananlar:

- [x] Mağaza girişi: ad, kısa ve tam açıklama, uygulama simgesi, öne çıkan görsel (taslak kaydedildi)
- [x] Gizlilik politikası: https://clickabletest.com/privacy
- [x] Reklam beyanı: reklam yok
- [x] İçerik derecelendirmesi: IARC anketi dolduruldu ve gönderildi → ESRB 13+, PEGI Ebeveyn Rehberliği, USK 12+
- [x] Oturum açma bilgileri: şifresiz giriş talimatı eklendi

- [x] Hedef kitle: 18 yaş ve üstü
- [x] Veri güvenliği: `store/play/data-safety.csv` içe aktarıldı (aşağıya bak)
- [x] Reklam kimliği: kullanılmıyor
- [x] Resmi kurum / finans / sağlık: hiçbiri
- [x] Kategori: Video Oynatıcılar ve Düzenleyiciler · iletişim: support@clickabletest.com, clickabletest.com

**Kalan tek şey: telefon ekran görüntüleri** (§3).

### Veri güvenliği formu CSV ile dolduruldu

Play Console "CSV'ye aktar / CSV'den içe aktar" düğmeleri boş anketi indirip dolu hâlini geri
yüklemeye izin veriyor. Yüzlerce onay kutusunu elle tıklamak yerine:

```powershell
# 1) Konsolda "CSV'ye aktar" → indirilen dosya
node scripts/data-safety-csv.mjs <indirilen.csv> store/play/data-safety.csv
# 2) Konsolda "CSV'den içe aktar" → store/play/data-safety.csv
```

Cevapların kuralı `scripts/data-safety-csv.mjs` içinde ve gerekçesi §4'te. Ürün yeni bir veri
toplamaya başlarsa script güncellenir, form yeniden üretilir — hangi kutunun neden işaretli
olduğu kaybolmaz.

## 7. Sürüm öncesi kontrol listesi

- [ ] `node scripts/make-icons.mjs` çalıştırıldı, ikonlar güncel
- [ ] Ekran görüntüleri çekildi (yukarıdaki dört ekran)
- [ ] `eas build --platform android --profile production` yeşil
- [ ] Play Console: Data safety, İçerik derecelendirme, Hedef kitle, Reklam beyanı dolduruldu
- [ ] Gizlilik politikası ve hesap silme adresleri girildi
- [ ] Kapalı test: 12 test kullanıcısı davet edildi, 14 günlük sayaç başladı
- [ ] RevenueCat ürünleri Play'de tanımlandı ve `docs/SENIN-YAPACAKLARIN.md` §7 ile eşleşiyor
