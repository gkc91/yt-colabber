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

## Supabase Edge Functions
```powershell
supabase functions serve            # yerel
supabase secrets set RC_WEBHOOK_SECRET=... YOUTUBE_API_KEY=... ANTHROPIC_API_KEY=... --project-ref <ref>
supabase functions deploy revenuecat-webhook refresh-niche-cache ai-summary signed-media notify
```

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
