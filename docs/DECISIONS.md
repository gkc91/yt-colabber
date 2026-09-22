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
