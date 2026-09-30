import { describe, expect, it } from 'vitest';

import {
  BIO_MAX,
  COLLAB_TYPES,
  bioError,
  collabProfileChanged,
  collabProfileError,
  isCollabType,
  normalizeBio,
  sanitizeTypes,
  toggleType,
  type CollabProfile,
} from './rules';

const profile = (over: Partial<CollabProfile> = {}): CollabProfile => ({
  isOpen: false,
  types: [],
  bio: null,
  ...over,
});

describe('collab rules', () => {
  it('test_catalogue_matches_the_database_enum', () => {
    // 0002_collab.sql: create type collab_type as enum (...). Sıra ve içerik aynı olmalı,
    // yoksa ekranda seçilen bir tür insert'te düşer.
    expect([...COLLAB_TYPES]).toEqual([
      'joint_video',
      'guest',
      'shorts',
      'end_screen_swap',
      'live',
    ]);
  });

  it('test_is_collab_type_rejects_anything_outside_the_catalogue', () => {
    expect(isCollabType('guest')).toBe(true);
    expect(isCollabType('sub4sub')).toBe(false);
    expect(isCollabType(null)).toBe(false);
    expect(isCollabType(3)).toBe(false);
  });

  it('test_sanitize_drops_unknown_values', () => {
    expect(sanitizeTypes(['guest', 'sub4sub', 'live'])).toEqual(['guest', 'live']);
  });

  it('test_sanitize_removes_duplicates', () => {
    expect(sanitizeTypes(['live', 'live', 'guest'])).toEqual(['guest', 'live']);
  });

  it('test_sanitize_puts_types_back_in_catalogue_order', () => {
    expect(sanitizeTypes(['live', 'joint_video', 'guest'])).toEqual([
      'joint_video',
      'guest',
      'live',
    ]);
  });

  it('test_sanitize_tolerates_junk_instead_of_throwing', () => {
    expect(sanitizeTypes(null)).toEqual([]);
    expect(sanitizeTypes('guest')).toEqual([]);
    expect(sanitizeTypes(undefined)).toEqual([]);
  });

  it('test_toggle_adds_and_removes_and_keeps_order', () => {
    expect(toggleType([], 'live')).toEqual(['live']);
    expect(toggleType(['live'], 'joint_video')).toEqual(['joint_video', 'live']);
    expect(toggleType(['joint_video', 'live'], 'live')).toEqual(['joint_video']);
  });

  it('test_blank_bio_becomes_null_not_an_empty_string', () => {
    expect(normalizeBio('')).toBeNull();
    expect(normalizeBio('   \n ')).toBeNull();
    expect(normalizeBio('  hello  ')).toBe('hello');
  });

  it('test_bio_error_uses_the_trimmed_length', () => {
    expect(bioError('a'.repeat(BIO_MAX))).toBeNull();
    expect(bioError('a'.repeat(BIO_MAX + 1))).toBe('too_long');
    // Sondaki boşluklar kırpıldığı için sınırı aşmıyor.
    expect(bioError('a'.repeat(BIO_MAX) + '    ')).toBeNull();
  });

  it('test_open_without_a_type_cannot_be_saved', () => {
    expect(collabProfileError(profile({ isOpen: true, types: [] }))).toBe('no_type');
    expect(collabProfileError(profile({ isOpen: true, types: ['guest'] }))).toBeNull();
  });

  it('test_closed_profile_needs_no_type', () => {
    expect(collabProfileError(profile({ isOpen: false, types: [] }))).toBeNull();
  });

  it('test_too_long_bio_beats_the_missing_type', () => {
    const draft = profile({ isOpen: true, types: [], bio: 'a'.repeat(BIO_MAX + 1) });
    expect(collabProfileError(draft)).toBe('too_long');
  });

  it('test_changed_sees_every_field', () => {
    const saved = profile({ isOpen: true, types: ['guest'], bio: 'hi' });
    expect(collabProfileChanged(saved, saved)).toBe(false);
    expect(collabProfileChanged(saved, { ...saved, isOpen: false })).toBe(true);
    expect(collabProfileChanged(saved, { ...saved, bio: null })).toBe(true);
    expect(collabProfileChanged(saved, { ...saved, types: ['live'] })).toBe(true);
    expect(collabProfileChanged(saved, { ...saved, types: ['guest', 'live'] })).toBe(true);
  });
});
