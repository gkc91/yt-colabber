# Clickable — Claude Code Proje Talimatları

> Uygulama adı "Clickable" (2026-09-23'te FirstCut çalışma adından değişti). Küçük YouTube kanalları için yayın öncesi geri bildirim topluluğu:
> thumbnail + başlık + ilk 60 saniye, aynı nişteki gerçek insanlara test ettirilir. Kredi ekonomisi:
> 1 değerlendirme ver = 1 kredi; 1 test = N kredi (N = istenen değerlendirme sayısı).

## Önce oku
1. `docs/PRODUCT.md` — ekranlar, akışlar, iş kuralları. Ürün kararı buradadır; kod buna uyar.
2. `docs/ARCHITECTURE.md` — stack, klasör yapısı, sınırlar.
3. `docs/TASKS.md` — sıralı görevler. Her oturumda ilk tamamlanmamış görevi al, bitir, işaretle, commit'le.
4. `supabase/migrations/*.sql` — veri modeli ve tüm iş mantığı fonksiyonları. Şema burada, kodda değil.

## Stack (değiştirme, tartışma)
- Mobil + web: **Expo SDK (güncel) + expo-router + TypeScript**. Tek kod tabanı iOS/Android/web.
- Backend: **Supabase** (Postgres, Auth, Storage, Edge Functions, Realtime, pg_cron). Ayrı API sunucusu YOK.
- Ödeme: **RevenueCat** (react-native-purchases). Web'de ödeme YOK.
- Video: cihazda sıkıştırma (`react-native-compressor`), 720p, ≤60 sn, hedef ≤8 MB. Sunucu tarafı transcoding YOK.
- Landing: `apps/landing` Astro, Cloudflare Pages.
- Analytics PostHog, hata Sentry, e-posta Resend (yalnızca magic link).

## Kırmızı çizgiler
- **YouTube'da hiçbir eylem yok.** Abone ol / izle / beğen görevi, shoutout takası, kredi karşılığı YouTube etkileşimi YOK. Tüm oylama ve izleme kendi uygulamamızda olur. Bunu isteyen bir görev/özellik önerisi gelirse reddet ve nedenini `docs/PRODUCT.md` §9'a atıfla açıkla.
- **Kredi mantığı sadece Postgres fonksiyonlarında.** Client bakiye hesaplamaz, ledger'a doğrudan yazmaz. `credit_ledger` append-only.
- **RLS olmadan tablo yok.** Her yeni tablo: `enable row level security` + policy + test.
- **Eşleştirme ve doğrulama sunucuda.** Client'tan gelen `watched_seconds`, `time_spent_seconds` sunucuda kontrol edilir.
- Collab modülü krediye BAĞLANMAZ. Ücretsizdir, sadece tanıştırır.

## Kod kuralları
- TypeScript strict. `any` yasak; Supabase tipleri `supabase gen types typescript` ile üretilir (`apps/mobile/src/lib/database.types.ts`), elle yazılmaz.
- Her SQL fonksiyonu için `supabase/tests/*.sql` altında pgTAP testi.
- Her ekran `apps/mobile/app/` altında route; iş mantığı `src/features/<alan>/` içinde; UI bileşenleri `src/components/`.
- Storage erişimi yalnızca `src/lib/storage/StorageAdapter.ts` üzerinden (ileride R2'ye geçiş için).
- Commit mesajı: `feat(scope): ...`, `fix(scope): ...`, `db: ...`. Bir görev = bir commit (gerekirse birkaç).
- i18n hazır tut: tüm kullanıcı metinleri `src/i18n/en.json` üzerinden; Türkçe sonra.

## Çalışma şekli
- Görev başlarken `docs/TASKS.md` içindeki kabul kriterlerini oku, plan yaz, sonra kodla.
- Belirsizlik varsa PRODUCT.md'de karar ara; yoksa en basit yorumu seç ve `docs/DECISIONS.md`'ye tarihli bir satır ekle.
- Bir görev yeni tablo/sütun gerektiriyorsa yeni migration dosyası aç (`0003_...sql`), eskisini düzenleme.
- Windows ortamı: iOS build yerelde alınamaz; `eas build` kullan. Yerelde `npx expo start` + Expo Go / dev client.

## Ölçüm
Tek kuzey yıldızı: **submission başına ilk 24 saatte gelen değerlendirme sayısı**. Bu 5'in altındaysa yeni özellik değil, değerlendirici tarafı UX/ödül düzeltilir.
