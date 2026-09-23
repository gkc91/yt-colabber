# TASKS.md — Sıralı görev listesi

Kural: Her oturumda ilk `[ ]` görevi al. Bitince `[x]` yap, `docs/DECISIONS.md`'ye gerekiyorsa not düş, commit'le. Görevi bölmek serbest; sırayı atlamak değil.
Her görevde "Kabul" maddeleri sağlanmadan görev bitmiş sayılmaz.

---
## Faz A — İskelet

- [x] **A1. Monorepo + araçlar**
  - `pnpm` workspace: `apps/mobile`, `apps/landing`. Root `package.json` scriptleri: `dev:mobile`, `dev:landing`, `db:reset`, `db:types`, `test:db`.
  - `apps/mobile`: `npx create-expo-app@latest --template tabs` (TypeScript, expo-router). Sil: örnek ekranlar.
  - Bağımlılıklar: `@supabase/supabase-js`, `@tanstack/react-query`, `expo-video`, `expo-image`, `expo-image-picker`, `react-native-compressor`, `expo-application`, `expo-notifications`, `react-native-purchases`, `posthog-react-native`, `@sentry/react-native`, `zustand`, `zod`.
  - ESLint + Prettier + `tsc --noEmit` CI (GitHub Actions).
  - Kabul: `pnpm dev:mobile` Expo Go'da boş tabs açar; `pnpm lint` temiz.

- [x] **A2. Supabase projesi + migration'lar**
  - `supabase init`, `supabase start` (Docker), `0001_init.sql` ve `0002_collab.sql` uygular. Hata çıkarsa migration'ı düzelt (yorumla belgele).
  - `supabase/seed.sql`: 3 test kullanıcısı (animation nişi), her nişe 10 sahte cache satırı (thumbnail_url için placeholder resimler).
  - `pnpm db:types` → `apps/mobile/src/lib/database.types.ts`.
  - pgTAP: `supabase/tests/001_credits.sql` — signup bonus 5; `create_submission` bakiye yetersizse hata; `submit_review` 20 sn altı reddediyor; `close_stale_submissions` iade yapıyor.
  - Kabul: `supabase test db` yeşil.

- [x] **A3. Auth + onboarding**
  - `src/lib/supabase.ts` (AsyncStorage session), magic link (deep link `clickable://auth`), Google sign-in (expo-auth-session).
  - `(onboarding)/niche` ve `(onboarding)/channel`: profiles + channels günceller, `onboarding_done=true`. YouTube URL doğrulama (regex, `@handle`/`channel/UC...`/`c/...`).
  - `register_device` çağrısı ilk açılışta.
  - Kabul: yeni kullanıcı → onboarding → tabs; bakiye 5 görünür.

- [x] **A4. EAS + mağaza iskeleti**
  - `eas.json` (development/preview/production), `app.json` bundle id `app.clickable.mobile`, icon/splash placeholder.
  - `eas build --profile preview --platform all`; iOS build TestFlight'a, Android internal test'e yüklenir.
  - Kabul: TestFlight'ta ve Play Internal'da uygulama açılıyor, giriş yapılıyor.

## Faz B — Çekirdek döngü

- [x] **B1. StorageAdapter + medya yükleme**
  - `src/lib/storage/StorageAdapter.ts` (`uploadThumbnail`, `uploadClip`, `getSignedUrl`), `SupabaseStorage.ts`.
  - Edge Function `signed-media`: girdi `task_id` veya `submission_id`; yetki kontrolü (reviewer'ın açık görevi var mı / owner mı); 60 dk signed URL döner.
  - Kabul: yüklenen dosya `media/clips/{uid}/...` yolunda; başkası signed URL alamıyor (test).

- [x] **B2. Submission sihirbazı**
  - `submit/new`: 5 adım (PRODUCT §6). Thumbnail 1280×720 resize (`expo-image-manipulator`), klip sıkıştırma + 60 sn kırpma, ilerleme çubuğu, iptal.
  - `rpc('create_submission')`; hata kodları → kullanıcı metinleri (`insufficient_credits` → paywall'a yönlendir).
  - `submit/index`: listem (status, received/requested, kalan süre).
  - Kabul: 8 MB üstü klip yüklenmiyor; 3 thumbnail + 3 başlık + klip ile submission oluşuyor, bakiye düşüyor.

- [x] **B3. Niş cache**
  - Edge Function `refresh-niche-cache`: her niş için 3 arama sorgusu (`niches.queries`, seed'de örnekler var; diğer nişlere sorgu ekle), `search.list` + `videos.list`, izlenme 1k–500k filtre, niş başına 200 satır tut (eskileri sil).
  - pg_cron günlük 04:00 → `net.http_post` ile fonksiyonu çağır (pg_net).
  - Kabul: yerelde elle çağrılınca animation nişi için ≥50 satır oluşuyor.

- [x] **B4. Değerlendirme akışı**
  - `review/index`: `rpc('next_review_task')`; görev yoksa boş durum ("Nişinde bekleyen test yok, bildirim aç").
  - `review/[taskId]`: Adım 1 feed ızgarası (aday `candidate_position`'da), karar süresi ölçümü; Adım 2 metin; Adım 3 `expo-video` + "Buradan çıkardım" + etiketler + yorum. Toplam süre sayacı (ekran açılışından).
  - `rpc('submit_review')`; başarıda "+1 kredi" animasyonu; hata `review_too_fast` → açıklayıcı uyarı.
  - "+1 kredi" ekranında test sahibinin kanalına isteğe bağlı bağlantı (PRODUCT §5). Yalnızca gönderimden sonra; ödül/koşul değil.
  - Kabul: 3 test kullanıcısıyla bir submission'a 3 değerlendirme giriyor, `received_reviews=3`.

- [x] **B5. Sonuç ekranı**
  - `submit/[id]`: `rpc('submission_results')` → thumbnail kartları (seçilme %, kazanan), başlık tahminleri + "doğru/yanlış anladı", hook histogramı (60 kovalı basit bar), etiket dağılımı, yorum listesi + yararlı/değil (`rpc('rate_review')`).
  - Kabul: 5 değerlendirmeli örnekte tüm bölümler doluyor; puanlama reputation'ı değiştiriyor (DB'de doğrula).

- [x] **B6. Çoklu değerlendirme nişi ve dili**
  - Kendi testin tek niş + tek dile gider (sonucun anlamlı kalması için değişmez).
  - `0009_review_scope.sql`: `profiles.also_review_niche_ids int[]`, `profiles.also_review_languages text[]` (EK liste; kendi nişi/dili ayrıca geçerli). `next_review_task` eşleşmesi bu listelere bakar.
  - Profil ekranında "Şunları da değerlendirebilirim" seçimi; onboarding'de varsayılan tek seçim kalır.
  - Kabul: iki niş seçen kullanıcı ikisinden de görev alır; kendi submission'ı hâlâ tek nişe gider; pgTAP testi.

## Faz C — Güven ve kalite

- [x] **C1. Anti-fraud kuralları** — `0010_fraud.sql`: trigger `reviews` insert sonrası son 10 değerlendirmede aynı `picked_position` veya hep `leave_second=0` ise reputation −0.3 + `is_flagged`. pgTAP testi.
- [ ] **C2. Push bildirimleri** — `expo_push_token` kaydı; Edge Function `notify` (Expo push API); tetikleyiciler: submission 3'e ulaşınca, tamamlanınca, nişte 5+ bekleyen görev varken 24 saattir değerlendirme yapmamış kullanıcıya günde en fazla 1.
- [ ] **C3. Rapor / engelle** — submission ve review üzerinde rapor menüsü; `hidden` submission'lar görev havuzundan düşer (zaten status filtresinde).
- [ ] **C4. Profil ekranı** — kredi geçmişi (ledger), itibar, verilen/alınan sayıları, niş değiştirme (ayda 1), çıkış, hesap silme (Apple zorunlu).

## Faz D — Para

- [ ] **D1. RevenueCat** — dashboard'da ürünler (PRODUCT §15), `src/lib/purchases.ts`, entitlement `pro`. Webhook Edge Function `revenuecat-webhook`: bearer doğrula, `INITIAL_PURCHASE/RENEWAL/NON_RENEWING_PURCHASE/EXPIRATION/CANCELLATION` → `grant_purchase`. Idempotent (event id).
- [ ] **D2. Paywall** — modal: kredi paketleri + Pro; "Satın alımları geri yükle"; fiyatlar RevenueCat'ten; web'de "uygulamada aç" ekranı.
- [ ] **D3. AI özeti** — Edge Function `ai-summary` (Claude Haiku), sadece Pro; prompt: değerlendirmeleri 5 maddeye indir + "değiştir" önerileri; `submissions.ai_summary`.
- [ ] **D4. Sandbox test** — iOS sandbox ve Play license tester ile satın alma → ledger doğrula.

## Faz E — Yayın

- [ ] **E1. Landing** — `apps/landing` Astro tek sayfa: vaat, 3 adım, ekran görüntüsü, mağaza butonları, gizlilik/şartlar sayfaları. Cloudflare Pages.
- [ ] **E2. Web/PWA** — `expo export -p web`, Cloudflare Pages; submission/ödeme ekranları web'de "uygulamada aç".
- [ ] **E3. Mağaza hazırlığı** — Play kapalı test (12 kişi, 14 gün); App Store metadata, ekran görüntüleri, gizlilik etiketleri, hesap silme akışı, review notları (test hesabı).
  - Google OAuth izin ekranı doğrulaması: logo + ana sayfa + gizlilik politikası (E1 landing gerekir). Doğrulanmadan onay ekranında uygulama adı yerine `<ref>.supabase.co` görünüyor ve güven kaybı yaratıyor. Alternatif: Supabase özel alan adı (Pro planı).
- [ ] **E4. Ölçüm** — PostHog olayları: `submission_created`, `task_started`, `review_submitted`, `review_rejected`, `paywall_viewed`, `purchase`. Dashboard: submission başına 24 saatte değerlendirme.

## Faz F — Collab

- [ ] **F1. Collab profili** — profil ayarında "Collab'a açığım", türler, bio → `collab_profiles`.
- [ ] **F2. Aday kartları** — `collab/index`: `rpc('collab_candidates')`, kart (kanal, band, türler, bio, "seni X kez değerlendirdi"), beğen / geç / engelle. Eşleşince kutlama + sohbete git.
- [ ] **F3. Sohbet** — `collab/matches`: eşleşme listesi, `messages` Realtime, `rpc('send_message')`, push (C2'ye tetikleyici ekle).
- [ ] **F4. Moderasyon** — mesaj raporu, engelleyince eşleşme gizlenir; günlük mesaj limiti (100).

## Sonrası (planlanmadı, sıraya girmesin)
YouTube read-only OAuth ile gerçek CTR/retention çekme ve oy-CTR korelasyonu · Türkçe dil · Ajans tier · R2 geçişi · Decoy'ları dile göre filtreleme (`niche_thumbnail_cache.language` + arama `relevanceLanguage`; şu an sorgular İngilizce ama sonuçlara başka diller karışabiliyor).
