import { describe, expect, it } from 'vitest';

import {
  GRID_SIZE,
  LEAVE_TAGS,
  REASON_TAGS,
  STAY_TAGS,
  buildFeedItems,
  countWords,
  isGuessLongEnough,
  isPositiveTag,
  leaveSecondFor,
  secondsSince,
  tagsFor,
  toggleTag,
  type Decoy,
  watchedSecondsFor,
} from './rules';

const decoys: Decoy[] = Array.from({ length: 5 }, (_, i) => ({
  video_id: `v${i}`,
  title: `Decoy ${i}`,
  thumbnail_url: `https://example.test/${i}.jpg`,
  channel_title: `Channel ${i}`,
}));
const candidate = { title: 'The candidate title', thumbnailUrl: 'https://example.test/c.jpg' };

describe('review rules', () => {
  it('test_review_grid_places_the_candidate_at_the_server_position', () => {
    for (const position of [0, 3, 5]) {
      const items = buildFeedItems(candidate, decoys, position);
      expect(items).toHaveLength(GRID_SIZE);
      expect(items[position].kind).toBe('candidate');
      expect(items.filter((item) => item.kind === 'candidate')).toHaveLength(1);
    }
  });

  it('test_review_grid_clamps_an_out_of_range_position', () => {
    expect(buildFeedItems(candidate, decoys, 99)[5].kind).toBe('candidate');
    expect(buildFeedItems(candidate, decoys, -2)[0].kind).toBe('candidate');
  });

  it('test_review_grid_hides_channel_names', () => {
    // Aday için kanal göstermek testi ele verir, boş bırakmak adayı belli eder.
    const items = buildFeedItems(candidate, decoys, 2);
    expect(items.every((item) => !('channelTitle' in item))).toBe(true);
  });

  it('test_review_guess_needs_five_words', () => {
    expect(countWords('  one   two three ')).toBe(3);
    expect(isGuessLongEnough('this is only four words')).toBe(true);
    expect(isGuessLongEnough('too short here')).toBe(false);
  });

  it('test_review_watching_to_the_end_reports_no_leave_second', () => {
    expect(leaveSecondFor(null, 45)).toBeNull();
    expect(watchedSecondsFor(null, 45)).toBe(45);
    // Sona ulaşıldıysa "ayrıldı" sayılmaz
    expect(leaveSecondFor(45, 45)).toBeNull();
    expect(leaveSecondFor(46, 45)).toBeNull();
  });

  it('test_review_leaving_early_is_recorded_within_the_clip', () => {
    expect(leaveSecondFor(12.7, 45)).toBe(12);
    expect(watchedSecondsFor(12.7, 45)).toBe(12);
    expect(leaveSecondFor(-3, 45)).toBe(0);
  });

  it('test_review_tags_toggle_and_stay_in_the_fixed_list', () => {
    expect(toggleTag([], 'slow_intro')).toEqual(['slow_intro']);
    expect(toggleTag(['slow_intro', 'bad_audio'], 'slow_intro')).toEqual(['bad_audio']);
    // REASON_TAGS iki sorunun birleşimi; sayıyı sabitlemek yerine kapsamı doğruluyoruz.
    expect(REASON_TAGS).toHaveLength(LEAVE_TAGS.length + STAY_TAGS.length + 1);
    expect(REASON_TAGS).toContain('didnt_match_thumbnail');
    expect(REASON_TAGS).toContain('strong_hook');
  });

  it('test_review_elapsed_seconds_never_go_negative', () => {
    const start = 1_000_000;
    expect(secondsSince(start, start + 25_400)).toBe(25);
    expect(secondsSince(start, start - 5_000)).toBe(0);
  });
});

describe('tagsFor', () => {
  it('test_leaving_early_asks_what_went_wrong', () => {
    expect(tagsFor(12)).toEqual(LEAVE_TAGS);
  });

  it('test_watching_to_the_end_asks_what_worked', () => {
    // Sonuna kadar izleyene "neden bıraktın" sorulamaz: sahibe yanlış veri gider.
    expect(tagsFor(null)).toEqual(STAY_TAGS);
    expect(tagsFor(null)).not.toContain('slow_intro');
  });

  it('test_the_two_sets_never_overlap', () => {
    const leave = new Set<string>(LEAVE_TAGS);
    expect(STAY_TAGS.some((tag) => leave.has(tag))).toBe(false);
  });

  it('test_positive_tags_are_recognised_for_the_results_screen', () => {
    expect(isPositiveTag('strong_hook')).toBe(true);
    expect(isPositiveTag('slow_intro')).toBe(false);
    // Eski değerlendirmelerde duran etiket; sonuçlarda olumlu tarafta görünmeli.
    expect(isPositiveTag('kept_watching')).toBe(true);
  });
});
