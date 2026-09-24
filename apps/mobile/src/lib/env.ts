import { z } from 'zod';

// Expo inlines EXPO_PUBLIC_* only for static `process.env.NAME` access, so list each one.
const schema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.url(),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  // RevenueCat (D1). Geliştirme derlemesinde boş olabilir: satın alma katmanı o zaman
  // 'not_configured' döner ve paywall satın alma düğmelerini göstermez.
  EXPO_PUBLIC_RC_IOS_KEY: z.string().optional(),
  EXPO_PUBLIC_RC_ANDROID_KEY: z.string().optional(),
});

export const env = schema.parse({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_RC_IOS_KEY: process.env.EXPO_PUBLIC_RC_IOS_KEY,
  EXPO_PUBLIC_RC_ANDROID_KEY: process.env.EXPO_PUBLIC_RC_ANDROID_KEY,
});
