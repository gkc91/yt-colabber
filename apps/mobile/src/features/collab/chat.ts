// Eşleşme listesi ve sohbetin saf mantığı (F3). Ağ yok, React yok.
import { sanitizeTypes, type CollabType } from './rules';

export interface Match {
  id: string;
  partnerId: string;
  displayName: string | null;
  channelTitle: string | null;
  youtubeUrl: string | null;
  band: string | null;
  types: CollabType[];
  lastMessage: string | null;
  lastMessageAt: string | null;
  unread: number;
}

export interface Message {
  id: number;
  matchId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

/** `collab_matches_list()` çıktısını ekranın kullanacağı biçime çevirir. */
export function toMatches(raw: unknown): Match[] {
  if (!Array.isArray(raw)) return [];
  const out: Match[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== 'string' || typeof row.partner_id !== 'string') continue;
    out.push({
      id: row.id,
      partnerId: row.partner_id,
      displayName: typeof row.display_name === 'string' ? row.display_name : null,
      channelTitle: typeof row.channel_title === 'string' ? row.channel_title : null,
      youtubeUrl: typeof row.youtube_url === 'string' ? row.youtube_url : null,
      band: typeof row.band === 'string' ? row.band : null,
      types: sanitizeTypes(row.types),
      lastMessage: typeof row.last_message === 'string' ? row.last_message : null,
      lastMessageAt: typeof row.last_message_at === 'string' ? row.last_message_at : null,
      unread: toCount(row.unread),
    });
  }
  return out;
}

/** Postgres `count(*)` bigint'tir ve supabase-js onu STRING olarak verir. */
function toCount(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : 0;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function matchName(match: Match, fallback: string): string {
  return match.channelTitle ?? match.displayName ?? fallback;
}

/**
 * Yeni mesajı listeye ekler.
 *
 * NEDEN AYRI BİR FONKSİYON: aynı mesaj İKİ YOLDAN gelebiliyor — `send_message`'ın dönüşü
 * ve Realtime yayını. İkisi de gelirse mesaj ekranda iki kez görünür. Kimliğe göre
 * tekilleştirme bu yüzden şart ve tam da bu yüzden test ediliyor.
 */
export function appendMessage(list: Message[], incoming: Message): Message[] {
  if (list.some((message) => message.id === incoming.id)) return list;
  const next = [...list, incoming];
  next.sort((a, b) =>
    a.createdAt === b.createdAt ? a.id - b.id : a.createdAt < b.createdAt ? -1 : 1,
  );
  return next;
}

export function toMessage(raw: unknown): Message | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === 'number' ? row.id : Number(row.id);
  if (!Number.isFinite(id)) return null;
  if (typeof row.match_id !== 'string' || typeof row.sender_id !== 'string') return null;
  if (typeof row.body !== 'string') return null;
  return {
    id,
    matchId: row.match_id,
    senderId: row.sender_id,
    body: row.body,
    createdAt: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
  };
}

export function toMessages(raw: unknown): Message[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(toMessage).filter((message): message is Message => message !== null);
}

/** `messages.body` sütunundaki `check (length(body) between 1 and 2000)` ile aynı. */
export const MESSAGE_MAX = 2000;

export function messageError(draft: string): 'empty' | 'too_long' | null {
  const trimmed = draft.trim();
  if (trimmed.length === 0) return 'empty';
  if (trimmed.length > MESSAGE_MAX) return 'too_long';
  return null;
}
