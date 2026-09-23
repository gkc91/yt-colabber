# ARCHITECTURE.md

## Klasör yapısı
```
clickable/
  CLAUDE.md
  docs/                      PRODUCT, ARCHITECTURE, TASKS, SETUP, DECISIONS
  supabase/
    config.toml
    migrations/              0001_init.sql, 0002_collab.sql, ...
    functions/               Edge Functions (Deno)
      revenuecat-webhook/
      refresh-niche-cache/
      ai-summary/
    tests/                   pgTAP
  apps/
    mobile/                  Expo (iOS, Android, web/PWA)
      app/                   expo-router rotaları
      src/
        lib/supabase.ts      client
        lib/database.types.ts  (üretilir)
        lib/storage/StorageAdapter.ts, SupabaseStorage.ts
        lib/purchases.ts     RevenueCat
        lib/analytics.ts     PostHog
        features/
          auth/ onboarding/ review/ submit/ results/ credits/ collab/ profile/
        components/
        i18n/en.json
    landing/                 Astro
```

## Veri akışları
**Submission:** client sıkıştırır → Storage `clips/{userId}/{uuid}.mp4` + `thumbs/{userId}/{uuid}.jpg` (private bucket) → `rpc('create_submission', ...)` → ledger −N, submission `open`, `review_tasks` henüz yok (görevler talep edilince atanır).

**Görev alma:** `rpc('next_review_task')` → sunucu uygun bir `open` submission seçer (aynı niş, kendisinin değil, daha önce değerlendirmediği, kalan slotu olan, öncelik: Pro > eski), `review_tasks` satırı açar (30 dk süre), decoy listesini (5 cache öğesi) ve aday thumbnail/başlık indeksini döner. Client signed URL ile medyayı çeker.

**Değerlendirme:** `rpc('submit_review', ...)` → doğrulama, `reviews` insert, task `done`, ledger +1, gerekiyorsa submission `completed` + owner'a push.

**Puanlama:** `rpc('rate_review', review_id, helpful)` → `review_ratings`, trigger reputation'ı günceller.

**Süre dolumu:** pg_cron her 10 dk `expire_tasks()` ve `close_stale_submissions()`.

**Ödeme:** RevenueCat webhook → Edge Function (`revenuecat-webhook`) → imza doğrula → `purchases` upsert (event id idempotent) → `rpc('grant_purchase', ...)` → ledger +kredi / `subscriptions` güncelle.

**Niş cache:** pg_cron günlük → Edge Function `refresh-niche-cache` → YouTube Data API v3 `search.list` + `videos.list` (public, API key) → `niche_thumbnail_cache` upsert (niş başına 200, <200k izlenme filtrelenmez; decoy'lar küçük-orta kanallardan olsun: 1k–500k izlenme).

**AI özet (Pro):** sonuç ekranından `rpc('request_summary')` → Edge Function `ai-summary` (Claude Haiku) → `submissions.ai_summary` yazar.

**Collab (Faz F):** `rpc('collab_candidates')`, `rpc('collab_like')` (karşılıklıysa match oluşturur), `messages` Realtime kanal `match:{id}`.

## Güvenlik
- Bucket'lar private; okuma signed URL (60 dk) ile, yalnızca ilgili task/submission sahibi için RPC üzerinden üretilir.
- RLS: kullanıcı kendi satırlarını görür; `reviews` yalnızca submission sahibi + yazan görebilir; `credit_ledger` salt okunur.
- Edge Functions service role key kullanır; client'a asla service key verilmez.
- RevenueCat webhook `Authorization: Bearer <secret>` doğrulanır.

## Client kuralları
- Tüm sunucu çağrıları `src/features/*/api.ts` içinde; ekranlar doğrudan `supabase.from` çağırmaz.
- TanStack Query ile cache; `queryKey` konvansiyonu `[alan, id]`.
- Video: `expo-video`. Sıkıştırma: `react-native-compressor` (`compress(uri, {compressionMethod:'manual', maxSize:1280, bitrate: 2_000_000})`), süre `expo-av`/metadata ile okunur, >60 sn ise `trim`.
- Cihaz kimliği: `expo-application` (`getAndroidId` / `getIosIdForVendorAsync`), `profiles.device_ids` dizisine eklenir.

## Ortamlar
- `local`: `supabase start` (Docker) + `npx expo start`.
- `staging`: ayrı Supabase projesi, EAS `preview` profili, TestFlight/Play internal.
- `prod`: EAS `production`.

## Ölçek notları (sonra)
- Storage egress 250 GB/ay'ı geçince `R2Storage.ts` adaptörü + Worker (signed URL) — client değişmez.
- `reviews` tablosu 1M satırı geçince aylık partisyon.
