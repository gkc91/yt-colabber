import type { MessageKey } from '@/i18n';

import type { SubscriberBand } from './api';

// Content language of the channel; reviewers are matched on it. Endonyms are not translated.
export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
] as const;

export const BANDS: { value: SubscriberBand; label: MessageKey }[] = [
  { value: 'b0_100', label: 'onboarding.bands.b0_100' },
  { value: 'b100_1k', label: 'onboarding.bands.b100_1k' },
  { value: 'b1k_10k', label: 'onboarding.bands.b1k_10k' },
  { value: 'b10k_100k', label: 'onboarding.bands.b10k_100k' },
  { value: 'b100k_plus', label: 'onboarding.bands.b100k_plus' },
];
