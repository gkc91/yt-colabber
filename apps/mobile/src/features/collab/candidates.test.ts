import { describe, expect, it } from 'vitest';

import {
  candidateName,
  historyKind,
  removeCandidate,
  toCandidates,
  type Candidate,
} from './candidates';

const row = (over: Record<string, unknown> = {}) => ({
  id: '11111111-1111-1111-1111-111111111111',
  display_name: 'Ada',
  channel_title: 'Ada Makes Things',
  youtube_url: 'https://www.youtube.com/@ada',
  band: 'b1k_10k',
  types: ['joint_video', 'live'],
  bio: 'Animation, weekly.',
  reviewed_me: '3',
  i_reviewed: '0',
  ...over,
});

const candidate = (over: Partial<Candidate> = {}): Candidate => ({
  ...toCandidates([row()])[0],
  ...over,
});

describe('collab candidates', () => {
  it('test_maps_a_row_into_a_candidate', () => {
    const [first] = toCandidates([row()]);
    expect(first.id).toBe('11111111-1111-1111-1111-111111111111');
    expect(first.channelTitle).toBe('Ada Makes Things');
    expect(first.types).toEqual(['joint_video', 'live']);
    expect(first.bio).toBe('Animation, weekly.');
  });

  it('test_counts_arrive_as_strings_from_postgres_and_become_numbers', () => {
    // count(*) bigint'tir ve supabase-js onu string olarak verir; '3' > 0 karşılaştırması
    // JS'te doğru sonuç verirdi ama '3' + 1 = '31' olurdu. Sayıya çevriliyor.
    const [first] = toCandidates([row({ reviewed_me: '3', i_reviewed: '12' })]);
    expect(first.reviewedMe).toBe(3);
    expect(first.iReviewed).toBe(12);
    expect(typeof first.reviewedMe).toBe('number');
  });

  it('test_missing_or_junk_counts_become_zero', () => {
    const [first] = toCandidates([row({ reviewed_me: null, i_reviewed: 'nope' })]);
    expect(first.reviewedMe).toBe(0);
    expect(first.iReviewed).toBe(0);
  });

  it('test_a_row_without_an_id_is_dropped_not_rendered', () => {
    const list = toCandidates([row(), { display_name: 'no id here' }, row({ id: '' })]);
    expect(list).toHaveLength(1);
  });

  it('test_unknown_collab_types_are_dropped', () => {
    const [first] = toCandidates([row({ types: ['guest', 'sub4sub'] })]);
    expect(first.types).toEqual(['guest']);
  });

  it('test_blank_bio_becomes_null_so_the_card_can_skip_it', () => {
    expect(toCandidates([row({ bio: '   ' })])[0].bio).toBeNull();
    expect(toCandidates([row({ bio: null })])[0].bio).toBeNull();
  });

  it('test_junk_payload_returns_an_empty_deck_instead_of_throwing', () => {
    expect(toCandidates(null)).toEqual([]);
    expect(toCandidates('[]')).toEqual([]);
    expect(toCandidates([null, 7, 'x'])).toEqual([]);
  });

  it('test_name_prefers_the_channel_then_the_profile_then_the_fallback', () => {
    expect(candidateName(candidate(), 'Creator')).toBe('Ada Makes Things');
    expect(candidateName(candidate({ channelTitle: null }), 'Creator')).toBe('Ada');
    expect(candidateName(candidate({ channelTitle: null, displayName: null }), 'Creator')).toBe(
      'Creator',
    );
  });

  it('test_history_kind_covers_all_four_cases', () => {
    expect(historyKind(candidate({ reviewedMe: 0, iReviewed: 0 }))).toBe('none');
    expect(historyKind(candidate({ reviewedMe: 2, iReviewed: 0 }))).toBe('they_reviewed');
    expect(historyKind(candidate({ reviewedMe: 0, iReviewed: 2 }))).toBe('i_reviewed');
    expect(historyKind(candidate({ reviewedMe: 1, iReviewed: 1 }))).toBe('both');
  });

  it('test_remove_takes_one_card_out_and_leaves_the_rest', () => {
    const deck = toCandidates([row(), row({ id: 'b' }), row({ id: 'c' })]);
    const left = removeCandidate(deck, 'b');
    expect(left.map((c) => c.id)).toEqual(['11111111-1111-1111-1111-111111111111', 'c']);
  });

  it('test_remove_is_a_no_op_for_an_unknown_id', () => {
    const deck = toCandidates([row()]);
    expect(removeCandidate(deck, 'nope')).toHaveLength(1);
  });
});
