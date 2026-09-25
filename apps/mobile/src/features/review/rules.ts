// Değerlendirme akışının kuralları (PRODUCT §5). Saf mantık: birim testleri buradadır.

export const DECOY_COUNT = 5;
export const GRID_SIZE = DECOY_COUNT + 1;
export const MIN_GUESS_WORDS = 5;
export const MIN_REVIEW_SECONDS = 20; // sunucu da ölçer (0003)

/**
 * Sebep etiketleri iki ayrı listedir ve hangisinin sorulacağını kararın KENDİSİ belirler:
 * sonuna kadar izleyen birine "neden bıraktın" diye sormak anlamsızdır ve sahibe yanlış
 * veri gider (2026-09-25, sahibin uyarısı). Bıraktıysa neyin kaçırdığını, izlediyse neyin
 * tuttuğunu sorarız.
 *
 * Sunucu etiketleri serbest metin olarak saklar; doğrulama burada.
 */
export const LEAVE_TAGS = [
  'slow_intro',
  'unclear_promise',
  'bad_audio',
  'low_energy',
  'too_long_setup',
  'visual_quality',
  'didnt_match_thumbnail',
] as const;

export const STAY_TAGS = [
  'strong_hook',
  'clear_promise',
  'got_to_the_point',
  'good_energy',
  'good_visuals',
  'wanted_the_answer',
] as const;

/** `kept_watching` artık seçilmiyor ama eski değerlendirmelerde var; sonuçlarda gösterilir. */
export const LEGACY_POSITIVE_TAGS = ['kept_watching'] as const;

export const REASON_TAGS = [...LEAVE_TAGS, ...STAY_TAGS, ...LEGACY_POSITIVE_TAGS] as const;

export type ReasonTag = (typeof REASON_TAGS)[number];

/** leftAt null = sonuna kadar izledi. */
export function tagsFor(leftAt: number | null): readonly ReasonTag[] {
  return leftAt === null ? STAY_TAGS : LEAVE_TAGS;
}

const POSITIVE = new Set<string>([...STAY_TAGS, ...LEGACY_POSITIVE_TAGS]);

/** Sonuç ekranı etiketleri iki başlık altında toplar. */
export const isPositiveTag = (tag: string): boolean => POSITIVE.has(tag);

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
