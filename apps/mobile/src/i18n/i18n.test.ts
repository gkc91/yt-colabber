import { describe, expect, it } from 'vitest';

import { caps, t } from './index';

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

describe('caps', () => {
  it('test_caps_uppercases_english_labels', () => {
    expect(caps('practice test')).toBe('PRACTICE TEST');
  });

  // Asıl mesele bu: Türkçe yerel ayarda 'i' → 'İ' olur ve Türkçe bir telefonda
  // İngilizce etiket "PRACTİCE TEST" diye görünüyordu. caps() metnin dilini kullanır.
  it('test_caps_ignores_the_turkish_dotted_i_rule', () => {
    expect('practice'.toLocaleUpperCase('tr')).toBe('PRACTİCE');
    expect(caps('practice')).not.toContain('İ');
  });
});

describe('t plurals', () => {
  it('test_i18n_picks_the_singular_at_exactly_one', () => {
    expect(t('paywall.balance', { count: 1 })).toContain('1 credit.');
    expect(t('paywall.balance', { count: 1 })).not.toContain('credits');
  });

  it('test_i18n_picks_the_plural_for_everything_else', () => {
    expect(t('paywall.balance', { count: 0 })).toContain('0 credits');
    expect(t('paywall.balance', { count: 2 })).toContain('2 credits');
    expect(t('paywall.balance', { count: 40 })).toContain('40 credits');
  });

  it('test_i18n_leaves_a_plural_alone_when_the_variable_is_missing', () => {
    // Eksik değişken sessizce yanlış biçim seçmemeli; ham hâli kalsın ki gözden kaçmasın.
    expect(t('paywall.balance')).toContain('{count:credit|credits}');
  });
});
