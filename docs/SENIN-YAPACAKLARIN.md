# SENIN-YAPACAKLARIN.md — hesap, ödeme ve cihaz gerektiren işler

> Bu listede **yalnızca senin yapabileceğin** işler var: hesap açma, ödeme bilgisi girme,
> şifre/anahtar girme, telefonda test etme, insanlarla konuşma. Kod tarafı bana ait.
> Sohbetin tamamı gözden geçirilerek çıkarıldı (2026-09-23). Bittikçe `[x]` yap.

---

## 1. Şimdi yapılabilir (kısa işler)

- [x] **`.env.example` commit'lendi** (2026-09-23; içinde gerçek anahtar yok).
- [x] **Docker açılışta başlıyor** (2026-09-23, `AutoStart = True`).
- [x] **Supabase projesi "Clickable staging" oldu** (2026-09-23).
- [ ] **GitHub deposunun adı** `yt-colabber`. İstersen `clickable` yap (Settings → Rename).
      Ben senin deponun adını değiştirmiyorum.
- [x] **Alan adı alındı: `clickabletest.com`** (2026-09-23). Ticari marka taraması hâlâ senin kararın;
      `clickable.app/.com/.io` başkalarında.

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

- [x] **Vault sırları girildi** (2026-09-23; cron → Edge Function yolu doğrulandı). Komutlar:
      **Vault sırlarını gir** (cron'un Edge Function'ları çağırabilmesi için). Supabase → SQL Editor:
      ```sql
      select vault.create_secret('https://doentqtqklsetbxdprrg.supabase.co', 'project_url');
      select vault.create_secret('<service-role-key>', 'service_role_key');
      ```
      Service role key: Settings → API Keys → Secret keys. **Bu anahtarı bana gönderme.**
- [x] **YouTube anahtarı staging'de ve fonksiyonlar deploy edildi** (2026-09-23:
      `signed-media`, `refresh-niche-cache`, `notify`, `delete-account`; 15 nişin hepsinde decoy var).
      Komutlar:
      ```powershell
      pnpm exec supabase secrets set YOUTUBE_API_KEY=<anahtar> --project-ref doentqtqklsetbxdprrg
      pnpm exec supabase functions deploy signed-media refresh-niche-cache notify
      ```
- [x] **Site URL `https://clickabletest.com` oldu** (2026-09-23).
- [ ] **E-posta gönderimi (Resend).** Supabase'in kendi SMTP'si saatte 2-3 e-posta ile sınırlı;
      gerçek kullanıcı gelmeden önce Resend hesabı açıp Supabase → Auth → SMTP'ye bağlamalıyız.

## 4. Mağaza (A4 kısmen bitti, E3'te tamamlanacak)

- [ ] **iOS derlemesi için Apple Developer hesabı** (yıllık 99 $). Alınca:
      `npx eas-cli@latest build --profile preview --platform ios` ve TestFlight'a gönder.
- [ ] **Play Console'a `.aab` yükle** (elindeki preview derlemesi) → Test → Internal testing.
      Kendini test kullanıcısı olarak ekle.
- [ ] **Play kapalı test:** 12 kişi, 14 gün (Google'ın yeni hesaplar için şartı). Kimleri
      çağıracağını şimdiden düşün; G1'deki ilk kullanıcılar buraya denk gelebilir.
- [x] **Google OAuth yayına alındı** (2026-09-23). Yapılanlar: izin ekranı markası (uygulama adı
      "Clickable", ana sayfa / gizlilik / şartlar bağlantıları `clickabletest.com`, yetkili alan
      adları), ve **Testing → In production**. Kritik: uygulama "Testing" durumundayken yalnızca
      test kullanıcıları giriş yapabiliyordu ve test kullanıcısı listesi BOŞTU — yani proje sahibi
      dışında kimse Google ile giremezdi. Artık herkes girebilir, token'lar da 7 günde düşmüyor.
      Hassas kapsam kullanmadığımız için (yalnızca `email profile`) Google incelemesi gerekmiyor.
- [ ] **Giriş ekranındaki alan adı yazısı.** Hesap seçme ekranı hâlâ
      "doentqtqklsetbxdprrg.supabase.co uygulamasına devam edin" diyor; Google bu satırda
      yönlendirme adresinin alan adını gösteriyor. Marka ayarlarının yayılması birkaç saat
      sürebilir; düzelmezse tek kalıcı çözüm Supabase Custom Domain eklentisi (Pro plan,
      aylık ek ücret) ile adresi `auth.clickabletest.com` yapmak. Karar sende — gerçek
      kullanıcılar gelmeden şart değil.
- [ ] **İkon ve açılış ekranı.** Şu an Expo'nun varsayılanları. E3'te gerçek tasarım gerekecek.

## 5. Para tarafı (Faz D — ilk kullanıcılar gelene kadar bekleyebilir)

- [ ] **RevenueCat hesabı** ve ürünlerin tanımlanması (PRODUCT §15: `credits_10`, `credits_30`,
      `credits_100`, `pro_monthly`, `pro_yearly`). Kod tarafı hazır; sırayla:
      1. RevenueCat projesi aç, iOS/Android uygulamalarını ekle (mağaza hesapları gerekiyor).
      2. Ürünleri yukarıdaki kimliklerle tanımla; `pro_monthly` + `pro_yearly` için
         **entitlement adı `pro`** olmalı (kod bu adı arıyor).
      3. Tek bir Offering yap, beş ürünü de paket olarak ekle.
      4. Webhook: `https://doentqtqklsetbxdprrg.supabase.co/functions/v1/revenuecat-webhook`,
         Authorization `Bearer <kendi ürettiğin sır>`.
      5. Aynı sırrı Supabase'e koy:
         `supabase secrets set RC_WEBHOOK_SECRET=<sır> --project-ref doentqtqklsetbxdprrg`
         (şu an tanımlı değil; fonksiyon bilerek 500 `webhook_secret_missing` dönüyor).
      6. iOS/Android public SDK anahtarlarını `.env` içine `EXPO_PUBLIC_RC_IOS_KEY` /
         `EXPO_PUBLIC_RC_ANDROID_KEY` olarak yaz.
- [ ] **App Store Connect ve Play Console ödeme/vergi bilgileri.** SETUP.md'deki not: ödeme
      bilgilerine yalnızca 20/B istisna hesabını gir.
- [ ] **Anthropic API anahtarı** (D3, Pro kullanıcılara AI özeti için) — **Pro satışa çıkmadan
      hemen önce**, daha erken değil. Anahtar yokken özellik uygulamada hiç görünmüyor.
      Önemli: console.anthropic.com'da **ayrı bir workspace** aç, anahtarı orada üret ve o
      workspace'e aylık harcama limiti koy (10 $ fazlasıyla yeter; özet başına ~0,007 $).
      Böylece kendi Claude Code/API kullanımınla uygulamanın bütçesi birbirini tüketmez.
      Claude Max aboneliğinden bağımsızdır — Max bir sunucudan çağrılamaz.
      `supabase secrets set ANTHROPIC_API_KEY=<anahtar> --project-ref doentqtqklsetbxdprrg`

## 6. Ölçüm ve büyüme (GROWTH.md)

- [ ] **PostHog ve Sentry hesapları** (E4 ve hata takibi için).
- [ ] **G1 — ilk 100 değerlendirici.** Tek nişte 60-100 kişi: Reddit (r/NewTubers), YouTube'cu
      Discord sunucuları, Türkçe içerik üretici grupları. Ayrıntılı oyun planı GROWTH.md §2'de.
      Bu madde ürünün kaderini belirleyen tek iş; kod bitmeden de başlanabilir.
- [ ] **Prod Supabase projesi** (staging'den ayrı) — yayına çıkarken.

---

## 7. Landing yayına alma (E1 kod tarafı bitti)

- [x] **Alan adı alındı: `clickabletest.com`** (Cloudflare Registrar, 2026-09-23, 10,46 $/yıl,
      otomatik yenileme açık). Kodda varsayılan adres bu; `PUBLIC_SITE_URL` vermeye gerek yok.
- [x] **Cloudflare Pages projesi `clickable`** kuruldu (2026-09-23): repo bağlı, her main push'unda
      otomatik deploy. Canlı: https://clickabletest.com (www de bağlı, `clickable.pages.dev` yedek).
- [x] **`support@clickabletest.com`** Cloudflare Email Routing ile gokcekantarci@hotmail.com'a
      yönlendiriliyor (2026-09-23). İlk gerçek postayı alınca çalıştığını teyit et.
- [x] **Google Search Console**: alan adı DNS TXT ile doğrulandı, `sitemap.xml` gönderildi
      (2026-09-23). İlk saatlerde "Getirilemedi" diyebilir; Google birkaç saat içinde tekrar dener,
      1-2 gün sonra "Başarılı" olmalı — olmazsa haber ver.
- [ ] **Bing Webmaster Tools**: Search Console'dan içe aktarma ile 2 dakika sürer (isteğe bağlı).
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
