// YouTube kanal URL'i doğrulama. Yalnızca kanal adresleri kabul edilir (video linki değil).
// Kabul: youtube.com/@handle · youtube.com/channel/UC… · youtube.com/c/name · youtube.com/user/name · bare "@handle".
// Kanal URL'i yalnızca niş/profil içindir; YouTube'a hiçbir istek atılmaz (PRODUCT §9).

export type YouTubeChannelRef =
  | { kind: 'handle'; handle: string; url: string }
  | { kind: 'channel'; channelId: string; url: string }
  | { kind: 'custom'; name: string; url: string }
  | { kind: 'user'; name: string; url: string };

const HOST = /^(?:www\.|m\.)?youtube\.com$/i;
const HANDLE = /^@[A-Za-z0-9._-]{3,30}$/;
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
const NAME = /^[A-Za-z0-9._-]{1,100}$/;

export function parseYouTubeChannelUrl(input: string): YouTubeChannelRef | null {
  const raw = input.trim();
  if (raw.length === 0) return null;

  if (HANDLE.test(raw)) {
    return { kind: 'handle', handle: raw, url: `https://www.youtube.com/${raw}` };
  }

  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (!HOST.test(parsed.hostname)) return null;

  const [first, second] = parsed.pathname.split('/').filter(Boolean);
  if (!first) return null;

  if (HANDLE.test(decodeURIComponent(first))) {
    const handle = decodeURIComponent(first);
    return { kind: 'handle', handle, url: `https://www.youtube.com/${handle}` };
  }
  if (first === 'channel' && second && CHANNEL_ID.test(second)) {
    return { kind: 'channel', channelId: second, url: `https://www.youtube.com/channel/${second}` };
  }
  if (first === 'c' && second && NAME.test(second)) {
    return { kind: 'custom', name: second, url: `https://www.youtube.com/c/${second}` };
  }
  if (first === 'user' && second && NAME.test(second)) {
    return { kind: 'user', name: second, url: `https://www.youtube.com/user/${second}` };
  }
  return null;
}
