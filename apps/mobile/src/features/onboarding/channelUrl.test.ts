import { describe, expect, it } from 'vitest';

import { parseChannelUrl } from './channelUrl';

describe('parseChannelUrl', () => {
  it('test_channel_url_reads_the_platform_from_the_address', () => {
    expect(parseChannelUrl('https://www.instagram.com/moneyrematch')?.platform).toBe('instagram');
    expect(parseChannelUrl('https://www.tiktok.com/@moneyrematch')?.platform).toBe('tiktok');
    expect(parseChannelUrl('https://www.youtube.com/@moneyrematch')?.platform).toBe('youtube');
  });

  it('test_channel_url_normalises_the_address', () => {
    // Aynı hesap iki farklı yazımla iki kez eklenebilmemeli.
    expect(parseChannelUrl('instagram.com/@letmefinish/')?.url).toBe(
      'https://www.instagram.com/letmefinish',
    );
    expect(parseChannelUrl('tiktok.com/letmefinish')?.url).toBe(
      'https://www.tiktok.com/@letmefinish',
    );
  });

  it('test_channel_url_keeps_the_youtube_channel_id_when_there_is_one', () => {
    const ref = parseChannelUrl('https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv');
    expect(ref?.channelId).toBe('UCabcdefghijklmnopqrstuv');
    // Instagram/TikTok'ta kimlik yok: aynı hesabı iki kez bağlama kontrolü adrese düşer.
    expect(parseChannelUrl('https://www.instagram.com/x_y_z')?.channelId).toBeNull();
  });

  // Gönderi adresi hesap adresi değildir. Elenmezse hesap adı "p" ya da "video" olur ve
  // değerlendirme sonrası gösterilen bağlantı hiçbir yere gitmez.
  it('test_channel_url_rejects_a_post_link', () => {
    expect(parseChannelUrl('https://www.instagram.com/p/ABC123/')).toBeNull();
    expect(parseChannelUrl('https://www.instagram.com/reel/ABC123/')).toBeNull();
    expect(parseChannelUrl('https://www.tiktok.com/video/7123456789')).toBeNull();
    expect(parseChannelUrl('https://www.tiktok.com/tag/fyp')).toBeNull();
  });

  it('test_channel_url_rejects_rubbish', () => {
    expect(parseChannelUrl('')).toBeNull();
    expect(parseChannelUrl('not a url at all')).toBeNull();
    expect(parseChannelUrl('https://www.instagram.com/')).toBeNull();
  });
});
