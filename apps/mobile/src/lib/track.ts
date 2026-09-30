// Uygulamanın tek ölçüm örneği (E4). Anahtar yoksa sessizce devre dışı.
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

import { createAnalytics, type AnalyticsContext } from './analytics';
import { env } from './env';

/**
 * Her olaya eklenen sürüm künyesi (2026-09-30).
 *
 * NEDEN: bundan önce olaylar hangi sürümden geldiğini söylemiyordu. Kapalı testte aynı
 * anda birden fazla build dolaşıyor; "değerlendirme sayısı düştü" gibi bir bulguyu
 * yorumlayabilmek için düşüşün hangi sürümde olduğunu ayırmak şart. Profildeki sürüm
 * satırı (AppVersion) bu soruyu insana cevaplıyor, bu künye panele cevaplıyor.
 *
 * Aynı üç parça orada da kullanılıyor: mağaza sürümü, build numarası, OTA güncelleme
 * kimliği. Yerelde ve web'de yerel sürüm yok; yapılandırmadaki sürüme düşülüyor.
 */
const context: AnalyticsContext = {
  app_version: Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? 'unknown',
  app_build: Application.nativeBuildVersion ?? null,
  update_id: Updates.updateId ?? null,
  platform: Platform.OS,
};

export const track = createAnalytics({
  key: env.EXPO_PUBLIC_POSTHOG_KEY,
  host: env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
  context,
});
