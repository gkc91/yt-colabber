// Uygulamanın tek ölçüm örneği (E4). Anahtar yoksa sessizce devre dışı.
import { createAnalytics } from './analytics';
import { env } from './env';

export const track = createAnalytics({
  key: env.EXPO_PUBLIC_POSTHOG_KEY,
  host: env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
});
