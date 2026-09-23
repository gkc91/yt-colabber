import { describe, expect, it } from 'vitest';

import {
  HISTOGRAM_BUCKETS,
  leaveHistogram,
  percent,
  pickRate,
  sortedTags,
  winnerIndex,
  type ThumbnailStat,
} from './rules';

const stat = (idx: number, picked: number, shown: number, pickedW = picked): ThumbnailStat => ({
  idx,
  shown,
  picked,
  picked_w: pickedW,
  total_w: shown,
  avg_decision_ms: 1500,
});

describe('results rules', () => {
  it('test_results_pick_rate_uses_weighted_votes', () => {
    // Oy ağırlığı = itibar; 2 tam oy / 4 ağırlık = %50
    expect(pickRate(stat(0, 2, 4))).toBe(0.5);
    expect(percent(pickRate(stat(0, 2, 4)))).toBe(50);
    expect(pickRate({ ...stat(0, 0, 0), total_w: 0 })).toBe(0);
  });

  it('test_results_winner_needs_a_three_vote_gap', () => {
    expect(winnerIndex([stat(0, 7, 10), stat(1, 4, 10)])).toBe(0);
    expect(winnerIndex([stat(0, 6, 10), stat(1, 4, 10)])).toBeNull();
    expect(winnerIndex([stat(0, 5, 10), stat(1, 5, 10)])).toBeNull();
  });

  it('test_results_winner_is_not_declared_with_one_thumbnail', () => {
    expect(winnerIndex([stat(0, 9, 9)])).toBeNull();
    expect(winnerIndex([])).toBeNull();
  });

  it('test_results_histogram_spreads_leaves_over_the_clip', () => {
    const buckets = leaveHistogram([0, 4, 5, 59], 60);
    expect(buckets).toHaveLength(HISTOGRAM_BUCKETS);
    expect(buckets[0]).toBe(2); // 0 ve 4. saniye ilk 5 sn kovasında
    expect(buckets[1]).toBe(1);
    expect(buckets[HISTOGRAM_BUCKETS - 1]).toBe(1);
    expect(buckets.reduce((sum, value) => sum + value, 0)).toBe(4);
  });

  it('test_results_histogram_keeps_out_of_range_values_inside', () => {
    const buckets = leaveHistogram([-5, 120], 60);
    expect(buckets[0]).toBe(1);
    expect(buckets[HISTOGRAM_BUCKETS - 1]).toBe(1);
  });

  it('test_results_tags_are_sorted_by_count_then_name', () => {
    expect(sortedTags({ bad_audio: 2, slow_intro: 5, low_energy: 2 })).toEqual([
      { tag: 'slow_intro', count: 5 },
      { tag: 'bad_audio', count: 2 },
      { tag: 'low_energy', count: 2 },
    ]);
  });
});
