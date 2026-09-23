// Değerlendirme akışının kuralları (PRODUCT §5). Saf mantık: birim testleri buradadır.

export const DECOY_COUNT = 5;
export const GRID_SIZE = DECOY_COUNT + 1;
export const MIN_GUESS_WORDS = 5;
export const MIN_REVIEW_SECONDS = 20; // sunucu da ölçer (0003)

/** Sabit sebep etiketleri; sunucu bunları serbest metin olarak saklar. */
export const REASON_TAGS = [
  'slow_intro',
  'unclear_promise',
  'bad_audio',
  'low_energy',
  'too_long_setup',
  'visual_quality',
  'didnt_match_thumbnail',
  'kept_watching',
] as const;

export type ReasonTag = (typeof REASON_TAGS)[number];

export type Decoy = {
  video_id: string;
  title: string;
  thumbnail_url: string;
  channel_title: string | null;
};

export type FeedItem =
  | { kind: 'candidate'; title: string; thumbnailUrl: string }
  | { kind: 'decoy'; title: string; thumbnailUrl: string; videoId: string };

/**
 * Aday thumbnail'i decoy'ların arasına `position`'a yerleştirir (sunucu seçer).
 * Kanal adları ızgarada gösterilmez: aday için gerçek kanalı göstermek testi ele verir,
 * boş bırakmak da adayı belli eder — bu yüzden hiçbir öğede gösterilmiyor.
 */
export function buildFeedItems(
  candidate: { title: string; thumbnailUrl: string },
  decoys: Decoy[],
  position: number,
): FeedItem[] {
  const items: FeedItem[] = decoys.slice(0, DECOY_COUNT).map((decoy) => ({
    kind: 'decoy',
    title: decoy.title,
    thumbnailUrl: decoy.thumbnail_url,
    videoId: decoy.video_id,
  }));
  const index = Math.min(Math.max(position, 0), items.length);
  items.splice(index, 0, {
    kind: 'candidate',
    title: candidate.title,
    thumbnailUrl: candidate.thumbnailUrl,
  });
  return items;
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export const isGuessLongEnough = (text: string): boolean => countWords(text) >= MIN_GUESS_WORDS;

/** Klip sonuna kadar izlendiyse leave_second null olur (PRODUCT §5). */
export function leaveSecondFor(leftAt: number | null, durationSeconds: number): number | null {
  if (leftAt === null) return null;
  const clamped = Math.max(0, Math.min(Math.floor(leftAt), durationSeconds));
  return clamped >= durationSeconds ? null : clamped;
}

export function watchedSecondsFor(leftAt: number | null, durationSeconds: number): number {
  if (leftAt === null) return durationSeconds;
  return Math.max(0, Math.min(Math.floor(leftAt), durationSeconds));
}

export function toggleTag(tags: ReasonTag[], tag: ReasonTag): ReasonTag[] {
  return tags.includes(tag) ? tags.filter((current) => current !== tag) : [...tags, tag];
}

export const secondsSince = (startedAt: number, now: number = Date.now()): number =>
  Math.max(0, Math.floor((now - startedAt) / 1000));
