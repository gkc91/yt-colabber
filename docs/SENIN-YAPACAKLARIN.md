# SENIN-YAPACAKLARIN.md — hesap, ödeme ve cihaz gerektiren işler

> Bu listede **yalnızca senin yapabileceğin** işler var: hesap açma, ödeme bilgisi girme,
> şifre/anahtar girme, telefonda test etme, insanlarla konuşma. Kod tarafı bana ait.
> Sohbetin tamamı gözden geçirilerek çıkarıldı (2026-09-23). Bittikçe `[x]` yap.

---

## 1. Şimdi yapılabilir (kısa işler)

- [ ] **`.env.example` dosyasını commit'le.** Ortamım `.env` dosyalarını okumayı engelliyor, bu yüzden
      göremediğim bir dosyayı push'lamadım. İçinde gerçek anahtar yoksa:
      `git add .env.example && git commit -m "chore: add env example"`
- [ ] **Docker Desktop'ı açılışta başlat.** Ayarlar → "Start Docker Desktop when you sign in".
      Yerel Supabase bunsuz çalışmıyor.
- [ ] **Supabase projesinin adını değiştir.** Şu an "gokcekantarci@hotmail.com's Project";
      Settings → General → "Clickable staging" yap.
- [ ] **GitHub deposunun adı** `yt-colabber`. İstersen `clickable` yap (Settings → Rename).
      Ben senin deponun adını değiştirmiyorum.
- [ ] **Marka ve alan adı kontrolü.** Mağazada "Clickable" çakışması yok ama ticari marka taraması
      ve `clickable.app` benzeri bir alan adı alma kararı sende. Landing (E1) bunu bekliyor.

## 2. Cihazda test (kod hazır, doğrulama sende)

- [ ] **Submission sihirbazını telefonda dene.** Galeriden seçme ve video sıkıştırma Expo Go'da
      çalışmaz; geliştirme derlemesi gerekir:
      ```powershell
      cd apps\mobile
      npx eas-cli@latest build --profile development --platform android
      ```
      Kurduktan sonra bilgisayarda `pnpm dev:mobile:local --lan` çalıştır ve o derlemeyle aç.
- [ ] **Push bildirimlerini dene.** Expo Go'da token alınamaz; yukarıdaki geliştirme derlemesi ya da
      `preview` derlemesi gerekir. Değerlendir sekmesinin boş ekranındaki "Tell me when a test arrives"
      düğmesiyle izin ver, sonra bana haber ver; kuyruğa bildirim düşürüp gerçekten geldiğini görelim.
- [ ] **Gerçek videoyla değerlendirme akışı.** Yereldeki klip sahte bir dosya; gerçek bir videoyla
      klip oynatmayı (adım 3) cihazda görmek gerekiyor.

## 3. Staging'i tam çalışır hale getirme

- [ ] **Vault sırlarını gir** (cron'un Edge Function'ları çağırabilmesi için). Supabase → SQL Editor:
      ```sql
      select vault.create_secret('https://doentqtqklsetbxdprrg.supabase.co', 'project_url');
      select vault.create_secret('<service-role-key>', 'service_role_key');
      ```
      Service role key: Settings → API Keys → Secret keys. **Bu anahtarı bana gönderme.**
- [ ] **YouTube anahtarını staging'e ekle ve fonksiyonları deploy et:**
      ```powershell
      pnpm exec supabase secrets set YOUTUBE_API_KEY=<anahtar> --project-ref doentqtqklsetbxdprrg
      pnpm exec supabase functions deploy signed-media refresh-niche-cache notify
      ```
- [ ] **Site URL'i düzelt.** Auth → URL Configuration → Site URL şu an `http://localhost:3000`.
      Landing yayına girince gerçek adresi koy.
- [ ] **E-posta gönderimi (Resend).** Supabase'in kendi SMTP'si saatte 2-3 e-posta ile sınırlı;
      gerçek kullanıcı gelmeden önce Resend hesabı açıp Supabase → Auth → SMTP'ye bağlamalıyız.

## 4. Mağaza (A4 kısmen bitti, E3'te tamamlanacak)

- [ ] **iOS derlemesi için Apple Developer hesabı** (yıllık 99 $). Alınca:
      `npx eas-cli@latest build --profile preview --platform ios` ve TestFlight'a gönder.
- [ ] **Play Console'a `.aab` yükle** (elindeki preview derlemesi) → Test → Internal testing.
      Kendini test kullanıcısı olarak ekle.
- [ ] **Play kapalı test:** 12 kişi, 14 gün (Google'ın yeni hesaplar için şartı). Kimleri
      çağıracağını şimdiden düşün; G1'deki ilk kullanıcılar buraya denk gelebilir.
- [ ] **Google OAuth doğrulaması.** Şu an giriş onay ekranında uygulama adı yerine
      `doentqtqklsetbxdprrg.supabase.co` yazıyor; kullanıcıda güven kaybı yaratır.
      Çözüm: landing + gizlilik politikası yayınlanınca izin ekranını doğrulamaya göndermek.
      Alternatif: Supabase özel alan adı (Pro planı, aylık ek ücret).
- [ ] **İkon ve açılış ekranı.** Şu an Expo'nun varsayılanları. E3'te gerçek tasarım gerekecek.

## 5. Para tarafı (Faz D — ilk kullanıcılar gelene kadar bekleyebilir)

- [ ] **RevenueCat hesabı** ve ürünlerin tanımlanması (PRODUCT §15: `credits_10`, `credits_30`,
      `credits_100`, `pro_monthly`, `pro_yearly`).
- [ ] **App Store Connect ve Play Console ödeme/vergi bilgileri.** SETUP.md'deki not: ödeme
      bilgilerine yalnızca 20/B istisna hesabını gir.
- [ ] **Anthropic API anahtarı** (D3, Pro kullanıcılara AI özeti için).

## 6. Ölçüm ve büyüme (GROWTH.md)

- [ ] **PostHog ve Sentry hesapları** (E4 ve hata takibi için).
- [ ] **G1 — ilk 100 değerlendirici.** Tek nişte 60-100 kişi: Reddit (r/NewTubers), YouTube'cu
      Discord sunucuları, Türkçe içerik üretici grupları. Ayrıntılı oyun planı GROWTH.md §2'de.
      Bu madde ürünün kaderini belirleyen tek iş; kod bitmeden de başlanabilir.
- [ ] **Prod Supabase projesi** (staging'den ayrı) — yayına çıkarken.

---

## 7. Landing yayına alma (E1 kod tarafı bitti)

- [ ] **Alan adı al** ve `PUBLIC_SITE_URL` olarak Cloudflare Pages'e gir. Sayfalar şu an
      `https://clickable.app` varsayıyor.
- [ ] **Cloudflare Pages projesi**: repoyu bağla, build `pnpm install --frozen-lockfile &&
      pnpm --filter landing build`, çıktı `apps/landing/dist` (ayrıntı SETUP.md'de).
- [ ] **Destek e-postası** (`support@<alan-adı>`) — gizlilik ve şartlar sayfalarında yazıyor,
      `apps/landing/src/data/site.ts` içindeki `CONTACT_EMAIL` ile değiştirilecek.
- [ ] **Google Search Console + Bing**: alan adını doğrula, `sitemap.xml` gönder. SEO'nun saati
      burada işlemeye başlar.
- [ ] **Mağaza linkleri** E3'ten sonra `site.ts` içindeki `STORE` sabitine yazılacak; şimdilik
      butonlar "Coming soon" diyor.

## 8. Örnek test içeriği (G0b)

- [ ] **Kendi kanallarından ilk 60 saniyeler.** Somebody Had To Do It, Let Me Finish, finans
      kanalı ve çocuk kanalı — her biri farklı niş demek. Klipleri `seeds/demo/` içine koy,
      `manifest.json`'a gir (biçim `seeds/demo/README.md`'de), sonra
      `SUPABASE_URL=... SERVICE_ROLE_KEY=... node scripts/seed-demo.mjs`.
- [ ] **Thumbnail'lar** üretilmiş olabilir (test edilen şey zaten o); klip üretilmiş olmamalı.
- [ ] Not: bu testler uygulamada "Örnek test" rozetiyle görünür ve gerçek testlerin arkasında
      sıraya girer; gerçek kullanıcı testi geldiği an o öne geçer.

---

## Kararını beklediğim konular
- **Decoy dili.** Niş cache'inde sorgular İngilizce ama YouTube bazen başka dilde video döndürüyor.
  Değerlendirme kalitesini gözle görülür biçimde bozarsa dile göre filtreleme öne alınır
  (şu an TASKS "Sonrası" listesinde).
