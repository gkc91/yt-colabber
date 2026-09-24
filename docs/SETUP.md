# SETUP.md — Windows'ta sıfırdan kurulum

## Araçlar
```powershell
winget install OpenJS.NodeJS.LTS Git.Git Docker.DockerDesktop
npm i -g pnpm eas-cli
scoop install supabase        # veya: winget install Supabase.CLI
```
Docker Desktop açık olmalı (`supabase start` için).

## Hesaplar (bir kez)
- Supabase: `local` için gerek yok; `staging` ve `prod` için iki proje aç (ücretsiz → Pro'ya geç yayına çıkarken).
- Expo: `eas login`.
- Apple Developer, Google Play Console (mevcut), RevenueCat, PostHog, Sentry, Google Cloud (YouTube Data API v3 anahtarı + OAuth istemcisi, proje `clickable-509507`), Anthropic API.

## İlk çalıştırma
```powershell
git clone <repo> clickable && cd clickable
pnpm install
supabase start                      # yerel Postgres + Auth + Storage
supabase db reset                   # migrations + seed
pnpm db:types                       # database.types.ts üret
copy .env.example apps/mobile/.env  # doldur
pnpm dev:mobile                     # Expo, QR ile Expo Go (Android) / eşinin iPhone'unda Expo Go
```
Yerel Supabase ile `.env` gerekmez: `pnpm dev:mobile:local` (web/simülatör) veya `pnpm dev:mobile:local --lan` (aynı Wi-Fi'deki telefon; Windows güvenlik duvarı 54321 portuna izin vermeli). Script `supabase status`'tan URL ve anon key'i alır.
Yerel test kullanıcıları: `alice@`, `bob@`, `cara@clickable.test`. Magic link e-postaları http://127.0.0.1:54324 (Mailpit) adresine düşer.
Native modüller (react-native-purchases, compressor) Expo Go'da çalışmaz → `eas build --profile development` ile dev client al, onunla test et.

## Medya erişimi kontrolü (B1)
Yüklemeyi ve imzalı adresleri uçtan uca dener (yerel stack + `supabase functions serve` gerekir):
```powershell
node scripts/check-media-access.mjs      # önce db reset yapar; --no-reset ile atlanır
```
Not: `pnpm db:reset` ayrıca `scripts/local-storage-index.mjs` çalıştırır. Yerel Postgres imajı ile
storage servisi sürümleri uyuşmadığı için gereken geçici bir indeks; hosted'a gitmez, imajlar
hizalanınca silinecek.

## Submission kontrolü (B2)
```powershell
node scripts/check-submission.mjs        # 3 thumbnail + 3 başlık + klip, kredi düşümü, 8 MB sınırı
```
Sihirbaz ekranları (galeriden seçme, sıkıştırma) Expo Go'da çalışmaz; cihazda denemek için:
`npx eas-cli@latest build --profile development --platform android` ile dev client al, sonra `pnpm dev:mobile:local --lan`.

## Niş cache (B3)
YouTube Data API v3 anahtarı gerekir (Google Cloud projesi `clickable-509507`, anahtar "Clickable niche cache").
Yerelde `supabase/functions/.env` içine `YOUTUBE_API_KEY=...` yaz (dosya .gitignore'da), sonra:
```powershell
pnpm exec supabase functions serve --env-file supabase/functions/.env
# ayrı terminalde (SERVICE_ROLE_KEY'i `supabase status -o env` verir):
curl -X POST http://127.0.0.1:54321/functions/v1/refresh-niche-cache -H "Authorization: Bearer <service-role-key>" -d '{"niche":"animation"}'
```
Kota: her arama 100 birim, günlük hak 10.000. Tam tur (15 niş × 3 sorgu) 4.500 birim — elle denerken `{"niche":"<slug>"}` ile tek niş çalıştır.
Cache birikir: satırlar kalıcıdır, niş başına 200'ü aşınca en eskiler silinir.

Hosted projede cron'un çalışması için (bir kez):
```sql
select vault.create_secret('https://<ref>.supabase.co', 'project_url');
select vault.create_secret('<service-role-key>', 'service_role_key');
```
ve `supabase secrets set YOUTUBE_API_KEY=...` + `supabase functions deploy refresh-niche-cache`.
Sırlar yoksa günlük iş sessizce atlanır (hata vermez).

## Değerlendirme akışı kontrolü (B4)
```powershell
node scripts/check-review.mjs        # 3 kullanıcı bir submission'ı değerlendirir, received_reviews=3
```

## Sonuç ekranı kontrolü (B5)
```powershell
node scripts/check-results.mjs       # 5 değerlendirme, tüm bölümler, puanlama itibarı değiştiriyor
```

## Bildirim kuyruğu kontrolü (C2)
Expo'ya gerçek istek atmadan dener (sahte push sunucusu):
```powershell
pnpm exec supabase functions serve --env-file supabase/functions/local-test.vars
node scripts/check-notifications.mjs
```
Hosted projede: `supabase secrets set` gerekmez (EXPO_PUSH_URL varsayılanı Expo'dur), ancak cron'un
çalışması için Vault sırları (project_url, service_role_key) girilmiş olmalı — bkz. niş cache bölümü.

## Supabase Edge Functions
```powershell
supabase functions serve            # yerel
supabase secrets set RC_WEBHOOK_SECRET=... YOUTUBE_API_KEY=... ANTHROPIC_API_KEY=... --project-ref <ref>
supabase functions deploy revenuecat-webhook refresh-niche-cache ai-summary signed-media notify delete-account
```

## Landing (apps/landing, Astro → Cloudflare Pages)
```powershell
pnpm dev:landing                 # http://localhost:4321
pnpm check:landing               # build + scripts/check-landing.mjs (CI de bunu koşar)
pnpm --filter landing og         # public/og.png'i yeniden üret (marka değişirse)
```
Cloudflare Pages ayarları:
- Build command: `pnpm install --frozen-lockfile && pnpm --filter landing build`
- Build output directory: `apps/landing/dist`
- Environment variable: `PUBLIC_SITE_URL=https://clickabletest.com` (canonical, hreflang ve sitemap
  bunu kullanır; varsayılan da odur).
Sayfalar `/`, `/thumbnail-test`, `/hook-test`, `/for/<nis>` (14 niş), `/privacy`, `/terms`
ve hepsinin `/tr/...` karşılığı; `sitemap.xml` ve `robots.txt` build'de üretilir.

## RevenueCat (D1)
Webhook adresi (RevenueCat → Project settings → Integrations → Webhooks):

    https://doentqtqklsetbxdprrg.supabase.co/functions/v1/revenuecat-webhook

Authorization header alanına `Bearer <RC_WEBHOOK_SECRET>` yazılır. Sırrı Supabase'e de koy:

```powershell
supabase secrets set RC_WEBHOOK_SECRET=<sır> --project-ref doentqtqklsetbxdprrg
supabase functions deploy revenuecat-webhook
```

Not: `supabase/config.toml` içinde bu fonksiyon için `verify_jwt = false`. RevenueCat Supabase
JWT'si göndermez; doğrulama fonksiyonun içinde `RC_WEBHOOK_SECRET` ile yapılır. Sır tanımlı
değilse fonksiyon hiçbir isteği kabul etmez (500 `webhook_secret_missing`).

Yerelde uçtan uca deneme:
```powershell
supabase functions serve --env-file supabase/functions/local-test.vars
node scripts/check-purchases.mjs
```

İstemci anahtarları `.env` içinde: `EXPO_PUBLIC_RC_IOS_KEY`, `EXPO_PUBLIC_RC_ANDROID_KEY`.
Boşsa satın alma katmanı `not_configured` döner ve paywall satın alma düğmesi göstermez.

## Örnek (demo) testler
```powershell
node scripts/seed-demo.mjs          # yerel stack; manifest seeds/demo/manifest.json
node scripts/seed-demo.mjs --list   # yüklü örnek testler
$env:SUPABASE_URL="https://<ref>.supabase.co"; $env:SERVICE_ROLE_KEY="<key>"; node scripts/seed-demo.mjs
```
Medya `seeds/demo/` altında durur ve repoya girmez; ayrıntı `seeds/demo/README.md`.

## Staging Supabase
Proje: `doentqtqklsetbxdprrg` (bölge eu-west-3). Şema 0001-0003 uygulandı; `clickable://auth` redirect listesinde.
Seed **gönderilmez** — staging'de sahte kullanıcı yoktur. `niche_thumbnail_cache` boş olduğu için B3 (niş cache) tamamlanana kadar
`next_review_task` staging'de `niche_cache_empty` döner; giriş ve onboarding çalışır.

```powershell
pnpm exec supabase login
pnpm exec supabase link --project-ref doentqtqklsetbxdprrg
pnpm exec supabase db push          # yeni migration çıktıkça
pnpm exec supabase migration list --linked
```

## EAS
`apps/mobile/eas.json` hazır: `development` (dev client, internal), `preview` (TestFlight / Play internal test), `production`.
Tüm komutlar `apps/mobile` klasöründe çalıştırılır.

```powershell
cd apps\mobile
npx eas-cli@latest login
npx eas-cli@latest init            # Expo projesi oluşturur, app.json'a projectId yazar
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon-key>
npx eas-cli@latest build --profile preview --platform all
npx eas-cli@latest submit --profile preview --platform ios
npx eas-cli@latest submit --profile preview --platform android
```
iOS sertifikalarını EAS yönetsin (ilk build'de sorar → "let EAS handle").
Ortam değişkenleri EAS'te tutulur, depoda değil; `production` ortamı için aynı iki değişkeni prod Supabase projesiyle oluştur.
Uygulama kimliği: `app.clickable.mobile` (iOS bundle id ve Android package aynı). Derin bağlantı şeması: `clickable://auth` — Supabase projesinin Auth → URL Configuration listesine eklenmeli.

## Mağaza ödeme profili
App Store Connect ve Play Console ödeme bilgilerine yalnızca 20/B istisna hesabını gir. Başka hesaba mağaza ödemesi gelmesin.
