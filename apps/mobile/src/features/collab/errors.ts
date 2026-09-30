// Sunucunun `raise exception` ile attığı kodlar → ekranın gösterdiği sebep (F4).
//
// Saf modül, çünkü buradaki SIRALAMA sessizce yanlış olabilecek bir şey ve testi olmadan
// fark edilmez: `collab_closed` mesajı da "blocked" kelimesini içerebilir ve önce eşleşen
// kazanır. Daha spesifik kodlar önce denenir.

export type CollabErrorCode =
  'collab_closed' | 'blocked' | 'daily_limit' | 'not_in_match' | 'own_message' | 'unknown';

export class CollabError extends Error {
  constructor(readonly code: CollabErrorCode) {
    super(code);
  }
}

/** `blocked` en sonda: bkz. dosya başı. */
const CODES: CollabErrorCode[] = [
  'collab_closed',
  'daily_limit',
  'not_in_match',
  'own_message',
  'blocked',
];

export function toCollabError(error: { message?: string } | null | undefined): CollabError {
  const message = error?.message ?? '';
  const found = CODES.find((code) => message.includes(code));
  return new CollabError(found ?? 'unknown');
}
