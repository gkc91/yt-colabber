import { describe, expect, it } from 'vitest';

import {
  assertWithinLimit,
  clipPath,
  contentTypeForPath,
  extensionFromUri,
  MAX_CLIP_BYTES,
  MAX_THUMBNAIL_BYTES,
  MediaError,
  thumbnailPath,
} from './paths';

const USER = '11111111-1111-1111-1111-111111111111';

describe('media paths', () => {
  it('test_storage_thumbnail_path_puts_user_id_in_second_segment', () => {
    // storage policy: (storage.foldername(name))[2] = auth.uid()
    const path = thumbnailPath(USER, 'abc', 'file:///tmp/photo.JPG');
    expect(path).toBe(`thumbs/${USER}/abc.jpg`);
    expect(path.split('/')[1]).toBe(USER);
  });

  it('test_storage_clip_path_puts_user_id_in_second_segment', () => {
    const path = clipPath(USER, 'abc', 'file:///tmp/movie.mp4?x=1');
    expect(path).toBe(`clips/${USER}/abc.mp4`);
    expect(path.split('/')[1]).toBe(USER);
  });

  it('test_storage_rejects_unsupported_types', () => {
    expect(() => thumbnailPath(USER, 'a', 'file:///tmp/photo.gif')).toThrow(MediaError);
    expect(() => thumbnailPath(USER, 'a', 'file:///tmp/photo')).toThrow(/none/);
    expect(() => clipPath(USER, 'a', 'file:///tmp/movie.avi')).toThrow(MediaError);
    // A clip is not a thumbnail and vice versa
    expect(() => thumbnailPath(USER, 'a', 'file:///tmp/movie.mp4')).toThrow(MediaError);
    expect(() => clipPath(USER, 'a', 'file:///tmp/photo.jpg')).toThrow(MediaError);
  });

  it('test_storage_rejects_user_id_that_would_break_the_path', () => {
    expect(() => thumbnailPath('../other', 'a', 'x.jpg')).toThrow(/Not a user id/);
    expect(() => clipPath('', 'a', 'x.mp4')).toThrow(/Not a user id/);
  });

  it('test_storage_extension_is_read_from_the_last_segment', () => {
    expect(extensionFromUri('file:///a.b/c/movie.MP4')).toBe('mp4');
    expect(extensionFromUri('content://media/42')).toBe('');
    expect(extensionFromUri('https://x.test/a.jpg?token=1#f')).toBe('jpg');
  });

  it('test_storage_content_type_matches_extension', () => {
    expect(contentTypeForPath(`thumbs/${USER}/a.jpg`)).toBe('image/jpeg');
    expect(contentTypeForPath(`thumbs/${USER}/a.png`)).toBe('image/png');
    expect(contentTypeForPath(`clips/${USER}/a.mp4`)).toBe('video/mp4');
    expect(contentTypeForPath(`clips/${USER}/a.mov`)).toBe('video/quicktime');
  });

  it('test_storage_size_limits_follow_the_product_spec', () => {
    expect(MAX_THUMBNAIL_BYTES).toBe(2 * 1024 * 1024);
    expect(MAX_CLIP_BYTES).toBe(8 * 1024 * 1024);
    expect(() => assertWithinLimit(MAX_CLIP_BYTES, MAX_CLIP_BYTES)).not.toThrow();
    expect(() => assertWithinLimit(MAX_CLIP_BYTES + 1, MAX_CLIP_BYTES)).toThrow(MediaError);
    expect(() => assertWithinLimit(MAX_THUMBNAIL_BYTES + 1, MAX_THUMBNAIL_BYTES)).toThrow(
      /limit is 2048 KB/,
    );
  });
});
