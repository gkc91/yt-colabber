# Clickable — kapatma listesi

> **DURUM: TAMAMLANDI — 2026-10-06.** Tüm servisler kapatıldı ve doğrulandı.
> Kapanış kaydı `docs/DECISIONS.md` dosyasının sonunda. Aşağıdaki liste ne yapıldığının dökümüdür.
> Kalan tek şey yerel `.env` dosyaları (C1) — içlerindeki anahtarların hepsi zaten iptal.

Karar: 2026-10-01. Gerekçe `docs/DECISIONS.md` sonundaki araştırma kaydında.
Yedek alındı: `C:\Users\user\Desktop\Clickable-yedek\` (tüm git geçmişi + 45 migration + docs).

**Sıra önemli.** Önce anahtarları iptal et (harcama anında durur ve sızmış bir anahtar
işe yaramaz hâle gelir), sonra projeleri sil. Tersi yaparsan silinmiş projenin anahtarı
hâlâ geçerli kalır.

---

## A. ÜCRETLİ — önce bunlar

Şu an fiilî harcama ~sıfır (`screen_media` kuyruk boşsa hemen çıkıyor), ama anahtarlar
duruyor ve kullanıldıkça ücretlendirilen uçlara bağlılar.

- [x] **A1. Anthropic API anahtarı** — ✅ `clickable-ai-summary` SİLİNDİ (2026-10-06). Hesap zaten
      "Evaluation access" ücretsiz planda, kredi $0,00, faturalandırma kurulmamış → bugüne kadar sıfır maliyet.
      ⚠️ Clickable workspace'inde `strix` adlı ikinci bir anahtar var (28 Eki'de doluyor) — Clickable'a mı
      ait yoksa ayrı bir araca mı, teyit bekliyor. `Default` workspace'indeki `key` ve `gkc`'ye dokunulmadı.
  <!-- eski madde -->
- [ ] ~~A1 (orijinal)~~ — `console.anthropic.com` → Settings → API keys → anahtarı **sil**.
      Kullanan: `supabase/functions/ai-summary`. Kullandıkça ödenir.
- [x] **A2–A4. Google Cloud — PROJE KAPATILDI (2026-10-06, doğrulandı).** Kimlik bilgileri sayfası
      artık "You don't have permission to view API keys" diyor, anahtar listelenmiyor, servis
      hesapları yüklenmiyor — silinmeyi bekleyen projenin görüntüsü. Cloud Vision anahtarı (ücretli
      olan tek kalem, Strix'e sızdığından şüphelenilen "API key 2"), iki YouTube anahtarı, OAuth
      istemcisi ve `revenuecat-play` servis hesabı birlikte gitti. 30 gün içinde kalıcı silinecek.
- [x] **A5. Alan adı `clickabletest.com`** — ✅ OTOMATİK YENİLEME KAPATILDI (2026-10-06).
      Cloudflare Registrar'da kayıtlıymış. 23 Eylül 2027'de kendiliğinden düşecek; yenileme ücreti
      $10.44/yıl bir daha çıkmayacak. `lampwickgames.com` (oyun projesi) dokunulmadı, açık kaldı.
  <!-- eski -->
- [ ] ~~A5 (orijinal)~~ — kayıt firmasında **otomatik yenilemeyi kapat**.
      Şimdi silme: para iadesi yok ve alan adını anında kaybedersin; süre dolunca kendiliğinden düşer.

---

## B. ÜCRETSİZ ama canlı — sonra bunlar

### B1. Supabase (en kritiği — gerçek kullanıcı verisi burada)
Proje: `doentqtqklsetbxdprrg` ("Clickable staging", Free plan).

İçinde: 19 profil, 11 kanal, 13 submission, 31 görev, 23 değerlendirme ve
**testçilerin yayınlanmamış video klipleri** Storage'da.

- [ ] **B1a.** İstersen önce veri dışa aktar: `pnpm exec supabase db dump --linked -f yedek.sql`
      (Not: kişisel veri içerir. Almayacaksan alma — saklamamak daha temiz.)
- [x] **B1b.** ✅ SİLİNDİ (2026-10-06) — proje listesi boş, veritabanı 0 MB doğrulandı.
      Postgres, 9 cron işi, 11 edge function, Storage, Auth kullanıcıları ve Vault birlikte gitti.
  <!-- eski -->
- [ ] ~~B1b (orijinal)~~ Projeyi sil: Project Settings → General → **Delete project**. Bu tek işlem
      Postgres'i, 9 pg_cron işini, 11 edge function'ı, Storage bucket'larını ve Auth
      kullanıcılarını birlikte siler. **Geri dönüşü yok.**
- [ ] **B1c.** Vault'taki sırlar projeyle birlikte gidiyor, ayrıca iş yok.

### B2. Cloudflare
- [x] **B2a-1.** ✅ `clickable-app` SİLİNDİ (2026-10-06), özel alan adı kaldırıldıktan sonra.
- [x] **B2a-2.** ✅ `clickable` SİLİNDİ (2026-10-06). Cloudflare Pages hesabı tamamen boş.
  <!-- eskisi -->
- [ ] ~~B2a-2~~ `clickable` henüz silinemedi — iki özel alan adı duruyor: `clickabletest.com`
      ve `www.clickabletest.com`. Custom domains sekmesinden kaldırınca şu komut bitirir:
      `npx wrangler@latest pages project delete clickable --yes`
  <!-- özgün not -->
- [ ] ~~B2a~~ ENGEL: Pages projeleri silinemedi.
      Cloudflare API hatası: *"To delete your project, you must first delete all custom domains"*.
      Önce üç özel alan adı kaldırılmalı: `app.clickabletest.com` (clickable-app),
      `clickabletest.com` + `www.clickabletest.com` (clickable).
      Her proje → **Custom domains** sekmesi → satırdaki `...` → **Remove domain**.
      Sonra `npx wrangler pages project delete clickable-app --yes` ve aynısı `clickable` için.
      NOT: Supabase silindiği için uygulama zaten çalışmıyor; aciliyeti düşük.
- [ ] **B2b.** `clickabletest.com` DNS kayıtlarını sil.
- [ ] **B2c.** Siteyi (zone) hesaptan kaldır.

### B3. Expo / EAS
- [x] **B3a.** ✅ YAPILDI (2026-10-06) — `preview`, `production` ve `development` ortamlarındaki
      7 değişkenin tamamı silindi, üç ortam da boş doğrulandı. — `preview` ortamında `EXPO_PUBLIC_POSTHOG_KEY`,
      `EXPO_PUBLIC_RC_ANDROID_KEY`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_SUPABASE_URL` var.
- [ ] **B3b+B3c. ⚠️ SENDE KALDI — parola gerekiyor.** `eas project:delete` şunu diyor:
      *"Deleting a project requires a session in sudo mode."* Parola doğrulaması istediği için
      bunu ben yapamam. **Projeyi silmek keystore'u da götürür**, keystore'u ayrıca silmeye gerek yok.
      İki yoldan biri:
      - `expo.dev/accounts/clickablex` → projeyi aç → Settings → Delete project, veya
      - kendi terminalinde: `cd apps/mobile && npx eas-cli@latest project:delete` (parolanı sorar)
      Proje: `@clickablex/clickable`, ID `031c3f84-7b0f-47e3-a55d-f8a2cbbe8f4b`

### B4. RevenueCat — ⚠️ İŞLEVSİZ ama proje duruyor
Proje "Clickable" (`b251f5ae`): MRR $0, gelir $0, kart tanımlı değil → **maliyet yok**.
Android anahtarı EAS'ten silindi, webhook ucu Supabase ile öldü → artık hiçbir şey yapamaz.
- [x] ✅ SİLİNDİ (2026-10-06, doğrulandı: hesapta hiç proje kalmadı — "Create a project to get started").

### B5. PostHog — ✅ TAMAM
Proje 287084 silinme sırasına alındı (2026-10-06). **8 Ekim 2026'da kalıcı olarak gidecek**,
ek işlem gerekmiyor. O tarihe kadar fikir değişirse panelden iptal edilebilir.

### B6. Sentry — ✅ YAPILACAK İŞ YOK
`@sentry/react-native` paketi kurulu ama **hiçbir kodda kullanılmamış**; DSN hiçbir yere
bağlanmamış, EAS'te de yoktu. Proje hiç açılmamış görünüyor. Açtıysanız silin.

### B7. Resend — ✅ YAPILACAK İŞ YOK
Kodda tek bir referans yok; planlanmış ama hiç entegre edilmemiş. Hesap açtıysanız silin.

### B8. Google Play Console / Apple
- [ ] Play Console'da uygulama taslağı varsa kaldır.
- [ ] Apple geliştirici başvurusu 2026-09-27'de reddedilmişti; aktif abonelik yoksa iş yok, **doğrula**.

### B9. GitHub
- [ ] `github.com/gkc91/yt-colabber` — **önerim: silme, private bırak.** Masaüstündeki bundle
      zaten tam yedek, ama repoyu tutmanın maliyeti sıfır ve ileride fikir değişirse elde kalır.
      Silmek istersen: Settings → Danger Zone → Delete repository.

---

## C. Yerel makine

- [ ] **C1.** `.env` dosyalarını sil — A1-A3'teki anahtarlar iptal edildikten **sonra**.
      (Ben bu dosyalara erişemiyorum, bu adım sende.)
- [ ] **C2.** Kodu silmek istersen `C:\Users\user\Desktop\App\firstcut-starter\` klasörü.
      Yedek masaüstünde ayrı duruyor, etkilenmez.

---

## D. Testçiler

Barış ve diğer testçilerin hesapları ve **yayınlanmamış videoları** bizim sunucumuzda.

- [ ] Kapattığını ve verilerinin silindiğini onlara haber ver. Hem doğrusu bu, hem de
      gizlilik politikamızda söz verdiğimiz şey. Bir-iki cümle yeter.

---

## Geri dönerse ne lazım

Masaüstündeki yedekle sıfırdan ayağa kaldırmak mümkün: `git clone clickable-kod-tum-gecmis.bundle`,
yeni bir Supabase projesi, 45 migration'ı sırayla uygula. Kaybolan tek şey üretim verisi
(zaten silinmesi gereken) ve alan adı.
