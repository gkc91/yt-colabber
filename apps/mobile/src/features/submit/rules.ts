// Submission kuralları (PRODUCT §6, §8). Saf mantık: birim testleri buradadır.
// Sunucu tarafı karşılığı create_submission (0001) — buradaki kontroller yalnızca
// kullanıcıya erken ve anlaşılır geri bildirim içindir, güvenlik sınırı değildir.

export const MAX_THUMBNAILS = 3;
export const MAX_TITLES = 3;
export const MAX_TITLE_LENGTH = 100;
export const CLIP_MAX_SECONDS = 60;
export const CLIP_MIN_SECONDS = 5; // create_submission alt sınırı
export const THUMBNAIL_SIZE = { width: 1280, height: 720 } as const;

export const FREE_REVIEW_COUNTS = [5, 10, 15] as const;
export const PRO_REVIEW_COUNT = 25;

export type ReviewCount = (typeof FREE_REVIEW_COUNTS)[number] | typeof PRO_REVIEW_COUNT;

export function reviewCountOptions(isPro: boolean): ReviewCount[] {
  return isPro ? [...FREE_REVIEW_COUNTS, PRO_REVIEW_COUNT] : [...FREE_REVIEW_COUNTS];
}

/** 1 değerlendirme = 1 kredi (PRODUCT §8). */
export const creditCost = (requested: ReviewCount): number => requested;

export const canAfford = (balance: number, requested: ReviewCount): boolean =>
  balance >= creditCost(requested);

export type TitlesProblem = 'no_titles' | 'too_many_titles' | 'title_too_long';

export function cleanTitles(titles: string[]): string[] {
  return titles.map((title) => title.trim()).filter((title) => title.length > 0);
}

export function validateTitles(titles: string[]): TitlesProblem | null {
  const cleaned = cleanTitles(titles);
  if (cleaned.length === 0) return 'no_titles';
  if (cleaned.length > MAX_TITLES) return 'too_many_titles';
  if (cleaned.some((title) => title.length > MAX_TITLE_LENGTH)) return 'title_too_long';
  return null;
}

export type ClipProblem = 'clip_too_long' | 'clip_too_short';

export function validateClipDuration(seconds: number): ClipProblem | null {
  // Seçici 60 sn ile sınırlı; yine de bir saniyelik yuvarlama payı bırakıyoruz.
  if (seconds > CLIP_MAX_SECONDS + 1) return 'clip_too_long';
  if (seconds < CLIP_MIN_SECONDS) return 'clip_too_short';
  return null;
}

/** create_submission'ın fırlattığı hata → uygulama içi kod. */
export type SubmissionError =
  | 'insufficient_credits'
  | 'pro_required'
  | 'onboarding_incomplete'
  | 'not_authenticated'
  | 'unknown';

export function submissionErrorCode(message: string | undefined): SubmissionError {
  const known: SubmissionError[] = [
    'insufficient_credits',
    'pro_required',
    'onboarding_incomplete',
    'not_authenticated',
  ];
  return known.find((code) => message?.includes(code)) ?? 'unknown';
}

/** Submission listesi için kalan süre. 72 saat açık kalır (PRODUCT §6). */
export function remainingTime(closesAt: string | Date, now: Date = new Date()) {
  const end = typeof closesAt === 'string' ? new Date(closesAt) : closesAt;
  const totalMinutes = Math.floor((end.getTime() - now.getTime()) / 60000);
  if (totalMinutes <= 0) return { expired: true as const, hours: 0, minutes: 0 };
  return {
    expired: false as const,
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };
}
