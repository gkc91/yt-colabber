import { describe, expect, it } from 'vitest';

import { canChangeNiche, daysUntilNicheChange, NICHE_CHANGE_DAYS } from './nicheChange';

const now = new Date('2026-09-23T12:00:00Z');
const daysAgo = (days: number) =>
  new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

describe('niche change window', () => {
  it('test_profile_first_change_is_always_allowed', () => {
    expect(daysUntilNicheChange(null, now)).toBe(0);
    expect(canChangeNiche(null, now)).toBe(true);
  });

  it('test_profile_change_is_blocked_for_thirty_days', () => {
    expect(daysUntilNicheChange(daysAgo(1), now)).toBe(NICHE_CHANGE_DAYS - 1);
    expect(daysUntilNicheChange(daysAgo(29), now)).toBe(1);
    expect(canChangeNiche(daysAgo(29), now)).toBe(false);
  });

  it('test_profile_change_opens_again_after_the_window', () => {
    expect(daysUntilNicheChange(daysAgo(30), now)).toBe(0);
    expect(daysUntilNicheChange(daysAgo(45), now)).toBe(0);
    expect(canChangeNiche(daysAgo(30), now)).toBe(true);
  });
});
