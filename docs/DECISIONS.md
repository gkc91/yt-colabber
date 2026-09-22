# DECISIONS.md — Tarihli kararlar (append-only)

- 2026-09-22 Çalışma adı FirstCut. Mağaza adı sonra.
- 2026-09-22 YouTube üzerinde hiçbir etkileşim üretilmez; collab modülü krediye bağlanmaz. (PRODUCT §9, §12)
- 2026-09-22 Backend Supabase all-in-one; ayrı API yok. Storage başta Supabase, R2 adaptörle sonra.
- 2026-09-22 Ödeme yalnızca App Store / Google Play (RevenueCat). Web'de ödeme yok. Gerekçe: GVK mük. 20/B kapsamı.
- 2026-09-22 1 değerlendirme = 1 kredi; submission maliyeti = istenen değerlendirme sayısı.
- 2026-09-22 A1: Expo SDK 57 (tabs şablonu). Rotalar `apps/mobile/app/`, rota dışı kod `apps/mobile/src/`; `@/*` → `src/*`. Şablonun iç `CLAUDE.md`/`AGENTS.md`'si bu düzene göre düzeltildi.
- 2026-09-22 A1: Tab'lar şimdilik review / submit / profile. Collab tab'ı F1'de eklenir (Faz F'ye kadar boş sekme göstermemek için).
- 2026-09-22 A1: pnpm `node-linker=hoisted` (Metro düz node_modules ister). Kurulum script'ine izin: `@sentry/cli`, `esbuild`; `unrs-resolver` kapalı (hazır binary kullanıyor).
- 2026-09-22 A1: Landing TypeScript 6'da sabit; `@astrojs/check` henüz TS 7 (native) ile doğrulanmadı.
- 2026-09-22 A1: Kullanıcı metinleri `src/i18n/en.json` + tipli `t('a.b')` yardımcı (anahtar yanlışsa tsc hata verir). i18n kütüphanesi Türkçe eklenince seçilir.
- 2026-09-22 A2: `submit_review` 20 sn altı değerlendirmede exception yerine NULL döner; itibar cezası (−0.2) ve görevin expired olması böylece kalıcı olur (exception aynı transaction'ı geri alıyordu). Client NULL'u `review_too_fast` uyarısı olarak gösterir. (0003)
- 2026-09-22 A2: Değerlendirme süresi sunucuda ölçülür: `min(client time_spent, now() − assigned_at)`; `watched_seconds` geçen süreyi aşamaz. (0003, CLAUDE.md kırmızı çizgi)
- 2026-09-22 A2: `profile_balances` view `security_invoker=true` — önceki hali RLS'i atlayıp herkesin bakiyesini gösteriyordu. (0003)
- 2026-09-22 A2: Supabase CLI root devDependency (`pnpm exec supabase`), global kurulum gerekmez. Yerelde analytics kapalı (Windows'ta Docker TCP ister).
