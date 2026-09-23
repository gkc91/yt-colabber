import { describe, expect, it } from 'vitest';

import {
  canAfford,
  cleanTitles,
  creditCost,
  MAX_TITLE_LENGTH,
  PRO_REVIEW_COUNT,
  remainingTime,
  reviewCountOptions,
  submissionErrorCode,
  validateClipDuration,
  validateTitles,
} from './rules';

describe('submission rules', () => {
  it('test_submit_titles_are_trimmed_and_empty_ones_dropped', () => {
    expect(cleanTitles(['  A title  ', '', '   ', 'Another'])).toEqual(['A title', 'Another']);
  });

  it('test_submit_titles_require_at_least_one', () => {
    expect(validateTitles([])).toBe('no_titles');
    expect(validateTitles(['   '])).toBe('no_titles');
    expect(validateTitles(['One good title'])).toBeNull();
  });

  it('test_submit_titles_are_capped_at_three_and_100_chars', () => {
    expect(validateTitles(['a', 'b', 'c'])).toBeNull();
    expect(validateTitles(['a', 'b', 'c', 'd'])).toBe('too_many_titles');
    expect(validateTitles(['x'.repeat(MAX_TITLE_LENGTH)])).toBeNull();
    expect(validateTitles(['x'.repeat(MAX_TITLE_LENGTH + 1)])).toBe('title_too_long');
  });

  it('test_submit_clip_duration_must_be_between_5_and_60_seconds', () => {
    expect(validateClipDuration(30)).toBeNull();
    expect(validateClipDuration(60)).toBeNull();
    expect(validateClipDuration(61)).toBeNull(); // rounding tolerance
    expect(validateClipDuration(62)).toBe('clip_too_long');
    expect(validateClipDuration(4)).toBe('clip_too_short');
  });

  it('test_submit_review_count_25_is_pro_only', () => {
    expect(reviewCountOptions(false)).toEqual([5, 10, 15]);
    expect(reviewCountOptions(true)).toContain(PRO_REVIEW_COUNT);
  });

  it('test_submit_cost_equals_requested_reviews', () => {
    expect(creditCost(5)).toBe(5);
    expect(creditCost(15)).toBe(15);
    expect(canAfford(5, 5)).toBe(true);
    expect(canAfford(4, 5)).toBe(false);
  });

  it('test_submit_server_errors_map_to_known_codes', () => {
    // postgrest hatayı sarmalıyor, mesajın içinde arıyoruz
    expect(submissionErrorCode('insufficient_credits')).toBe('insufficient_credits');
    expect(submissionErrorCode('P0001: pro_required')).toBe('pro_required');
    expect(submissionErrorCode('could not connect')).toBe('unknown');
    expect(submissionErrorCode(undefined)).toBe('unknown');
  });

  it('test_submit_remaining_time_counts_down_and_expires', () => {
    const now = new Date('2026-09-23T10:00:00Z');
    expect(remainingTime('2026-09-23T13:30:00Z', now)).toEqual({
      expired: false,
      hours: 3,
      minutes: 30,
    });
    expect(remainingTime('2026-09-23T09:59:00Z', now).expired).toBe(true);
  });
});
