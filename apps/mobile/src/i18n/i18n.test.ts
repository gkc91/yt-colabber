import { describe, expect, it } from 'vitest';

import { t } from './index';

describe('t', () => {
  it('test_i18n_returns_the_message_for_a_key', () => {
    expect(t('tabs.review')).toBe('Review');
  });

  it('test_i18n_fills_placeholders', () => {
    expect(t('submit.reviewsProgress', { received: 2, requested: 5 })).toBe('2 of 5 reviews');
  });

  it('test_i18n_leaves_unknown_placeholders_untouched', () => {
    expect(t('submit.remaining', { hours: 3 })).toBe('3h {minutes}m left');
  });
});
