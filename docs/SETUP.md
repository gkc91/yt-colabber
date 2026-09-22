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
- Apple Developer, Google Play Console (mevcut), RevenueCat, PostHog, Sentry, Google Cloud (YouTube Data API v3 anahtarı), Anthropic API.

## İlk çalıştırma
```powershell
git clone <repo> firstcut && cd firstcut
pnpm install
supabase start                      # yerel Postgres + Auth + Storage
supabase db reset                   # migrations + seed
pnpm db:types                       # database.types.ts üret
copy .env.example apps/mobile/.env  # doldur
pnpm dev:mobile                     # Expo, QR ile Expo Go (Android) / eşinin iPhone'unda Expo Go
```
Native modüller (react-native-purchases, compressor) Expo Go'da çalışmaz → `eas build --profile development` ile dev client al, onunla test et.

## Supabase Edge Functions
```powershell
supabase functions serve            # yerel
supabase secrets set RC_WEBHOOK_SECRET=... YOUTUBE_API_KEY=... ANTHROPIC_API_KEY=... --project-ref <ref>
supabase functions deploy revenuecat-webhook refresh-niche-cache ai-summary signed-media notify
```

## EAS
```powershell
eas build:configure
eas build --profile preview --platform ios      # Mac gerekmez
eas submit --platform ios
eas build --profile preview --platform android
```
iOS sertifikalarını EAS yönetsin (ilk build'de sorar → "let EAS handle").

## Mağaza ödeme profili
App Store Connect ve Play Console ödeme bilgilerine yalnızca 20/B istisna hesabını gir. Başka hesaba mağaza ödemesi gelmesin.
