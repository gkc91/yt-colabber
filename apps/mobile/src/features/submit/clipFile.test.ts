import { describe, expect, it } from 'vitest';

import { CLIP_MAX_BYTES, validateClipFile } from './rules';

const MB = 1024 * 1024;
const ok = { durationSeconds: 45, bytes: 6 * MB, mimeType: 'video/mp4' };

describe('validateClipFile', () => {
  it('test_clip_file_within_limits_is_accepted', () => {
    expect(validateClipFile(ok)).toBeNull();
  });

  it('test_clip_file_longer_than_a_minute_is_rejected', () => {
    // Kapıda reddediyoruz: ne tarayıcıda ne sunucuda sıkıştırma var (E5).
    expect(validateClipFile({ ...ok, durationSeconds: 92 })).toBe('clip_too_long');
  });

  it('test_clip_file_over_the_size_limit_is_rejected', () => {
    expect(validateClipFile({ ...ok, bytes: CLIP_MAX_BYTES + 1 })).toBe('clip_too_large');
  });

  it('test_clip_file_of_the_wrong_type_is_rejected_before_anything_else', () => {
    // Tür yanlışsa süre/boyut hiç okunmaz; kullanıcıya asıl sebep söylenir.
    expect(validateClipFile({ durationSeconds: 999, bytes: 99 * MB, mimeType: 'video/webm' })).toBe(
      'clip_wrong_type',
    );
  });

  it('test_clip_file_mime_with_codecs_suffix_is_understood', () => {
    expect(validateClipFile({ ...ok, mimeType: 'video/mp4; codecs="avc1.42E01E"' })).toBeNull();
  });

  it('test_clip_file_too_short_is_rejected', () => {
    expect(validateClipFile({ ...ok, durationSeconds: 3 })).toBe('clip_too_short');
  });

  it('test_clip_file_at_exactly_the_size_limit_is_accepted', () => {
    expect(validateClipFile({ ...ok, bytes: CLIP_MAX_BYTES })).toBeNull();
  });
});
