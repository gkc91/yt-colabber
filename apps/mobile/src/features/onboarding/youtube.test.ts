import { describe, expect, it } from 'vitest';

import { parseYouTubeChannelUrl } from './youtube';

describe('parseYouTubeChannelUrl', () => {
  it('test_youtube_handle_url_is_accepted_and_normalised', () => {
    expect(parseYouTubeChannelUrl('https://www.youtube.com/@alice-animates')).toEqual({
      kind: 'handle',
      handle: '@alice-animates',
      url: 'https://www.youtube.com/@alice-animates',
    });
  });

  it('test_youtube_url_without_scheme_or_www_is_accepted', () => {
    expect(parseYouTubeChannelUrl('youtube.com/@alice')?.url).toBe(
      'https://www.youtube.com/@alice',
    );
    expect(parseYouTubeChannelUrl('m.youtube.com/@alice/videos')?.url).toBe(
      'https://www.youtube.com/@alice',
    );
  });

  it('test_youtube_bare_handle_is_accepted', () => {
    expect(parseYouTubeChannelUrl('  @bob_draws  ')?.url).toBe(
      'https://www.youtube.com/@bob_draws',
    );
  });

  it('test_youtube_channel_id_url_keeps_the_id', () => {
    const ref = parseYouTubeChannelUrl(
      'https://youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw?si=abc',
    );
    expect(ref).toEqual({
      kind: 'channel',
      channelId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
      url: 'https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw',
    });
  });

  it('test_youtube_custom_and_user_urls_are_accepted', () => {
    expect(parseYouTubeChannelUrl('https://www.youtube.com/c/CaraFrames')?.kind).toBe('custom');
    expect(parseYouTubeChannelUrl('https://www.youtube.com/user/oldname')?.kind).toBe('user');
  });

  it.each([
    ['empty', ''],
    ['video link', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
    ['short link', 'https://youtu.be/dQw4w9WgXcQ'],
    ['shorts link', 'https://www.youtube.com/shorts/dQw4w9WgXcQ'],
    ['other host', 'https://notyoutube.com/@alice'],
    ['lookalike host', 'https://youtube.com.evil.test/@alice'],
    ['channel id too short', 'https://www.youtube.com/channel/UC123'],
    ['channel id wrong prefix', 'https://www.youtube.com/channel/XX_x5XG1OV2P6uZZ5FSM9Ttw'],
    ['handle too short', '@ab'],
    ['home page', 'https://www.youtube.com/'],
    ['plain text', 'my channel'],
  ])('test_youtube_%s_is_rejected', (_label, input) => {
    expect(parseYouTubeChannelUrl(input)).toBeNull();
  });
});
