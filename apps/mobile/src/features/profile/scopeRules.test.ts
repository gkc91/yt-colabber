import { describe, expect, it } from 'vitest';

import { MAX_EXTRA_LANGUAGES, MAX_EXTRA_NICHES, toggleWithin } from './scopeRules';

describe('review scope', () => {
  it('test_scope_toggle_adds_and_removes', () => {
    expect(toggleWithin<number>([], 2, MAX_EXTRA_NICHES)).toEqual([2]);
    expect(toggleWithin([2, 5], 2, MAX_EXTRA_NICHES)).toEqual([5]);
  });

  it('test_scope_toggle_respects_the_limit', () => {
    const full = [1, 2, 3];
    expect(toggleWithin(full, 4, MAX_EXTRA_NICHES)).toEqual(full);
    // sınırdayken seçili olanı kaldırmak her zaman çalışır
    expect(toggleWithin(full, 2, MAX_EXTRA_NICHES)).toEqual([1, 3]);
  });

  it('test_scope_limits_match_the_database_constraints', () => {
    // 0009: also_review_niche_ids <= 3, also_review_languages <= 2
    expect(MAX_EXTRA_NICHES).toBe(3);
    expect(MAX_EXTRA_LANGUAGES).toBe(2);
  });
});
