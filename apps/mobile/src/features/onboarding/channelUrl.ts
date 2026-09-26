// Kanal/hesap adresi çözümleme. YouTube'un yanına Instagram ve TikTok eklendi (0024).
//
// Platform KULLANICIYA SORULMUYOR: adres zaten söylüyor. Bir soru daha sormak, cevabı
// ekranda duran bir şeyi tekrar istemek olurdu.
//
// Adres yalnızca profil/niş ve değerlendirme sonrası gösterilen bağlantı içindir; hiçbir
// platforma istek atılmaz (PRODUCT §9).
import { parseYouTubeChannelUrl, type YouTubeChannelRef } from './youtube';

export type ChannelPlatform = 'youtube' | 'instagram' | 'tiktok';

export type ChannelRef = {
  platform: ChannelPlatform;
  url: string;
  /** Yalnızca YouTube'da ve yalnızca UC… biçimindeyse dolu olur. */
  channelId: string | null;
};

const INSTAGRAM_HOST = /^(?:www\.)?instagram\.com$/i;
const TIKTOK_HOST = /^(?:www\.|m\.)?tiktok\.com$/i;
const USERNAME = /^[A-Za-z0-9._]{1,30}$/;

// Adresin ilk parçası her zaman hesap adı değil: gönderi, etiket ve arama adresleri de
// aynı biçimde. Bunları elemezsek "instagram.com/p/ABC" hesabı "p" diye kaydedilir.
const RESERVED: Record<'instagram' | 'tiktok', ReadonlySet<string>> = {
  instagram: new Set([
    'p',
    'reel',
    'reels',
    'tv',
    'stories',
    'explore',
    'accounts',
    'direct',
    'about',
  ]),
  tiktok: new Set([
    'video',
    'tag',
    'music',
    'discover',
    'foryou',
    'following',
    'live',
    'search',
    'upload',
  ]),
};

const accountName = (raw: string, platform: 'instagram' | 'tiktok'): string | null => {
  const name = decodeURIComponent(raw ?? '').replace(/^@/, '');
  if (!USERNAME.test(name)) return null;
  if (RESERVED[platform].has(name.toLowerCase())) return null;
  return name;
};

function hostOf(input: string): { host: string; path: string[] } | null {
  try {
    const parsed = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    return { host: parsed.hostname, path: parsed.pathname.split('/').filter(Boolean) };
  } catch {
    return null;
  }
}

export function parseChannelUrl(input: string): ChannelRef | null {
  const raw = input.trim();
  if (raw.length === 0) return null;

  const parts = hostOf(raw);

  if (parts && INSTAGRAM_HOST.test(parts.host)) {
    const name = accountName(parts.path[0], 'instagram');
    if (!name) return null;
    return { platform: 'instagram', url: `https://www.instagram.com/${name}`, channelId: null };
  }

  if (parts && TIKTOK_HOST.test(parts.host)) {
    const name = accountName(parts.path[0], 'tiktok');
    if (!name) return null;
    return { platform: 'tiktok', url: `https://www.tiktok.com/@${name}`, channelId: null };
  }

  // Kalan her şey YouTube kurallarına girer — çıplak "@handle" dahil, eskiden olduğu gibi.
  const youtube: YouTubeChannelRef | null = parseYouTubeChannelUrl(raw);
  if (!youtube) return null;
  return {
    platform: 'youtube',
    url: youtube.url,
    channelId: youtube.kind === 'channel' ? youtube.channelId : null,
  };
}
