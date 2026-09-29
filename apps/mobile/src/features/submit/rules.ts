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

/** Masaüstünden seçilen dosyanın kapıda reddedilme sebepleri (E5). */
export type ClipFileProblem = ClipProblem | 'clip_too_large' | 'clip_wrong_type';

export const CLIP_MAX_BYTES = 8 * 1024 * 1024; // PRODUCT §6
export const CLIP_TYPES = ['video/mp4', 'video/quicktime'] as const;

/**
 * Tarayıcıda sıkıştırma yapmıyoruz (sunucuda da yok): dosya zaten kurallara uyuyorsa
 * kabul, uymuyorsa net sebep. Kullanıcı neyi beklediğimizi ekranda önceden görüyor.
 */
export function validateClipFile(file: {
  durationSeconds: number;
  bytes: number;
  mimeType: string;
}): ClipFileProblem | null {
  const type = file.mimeType.split(';')[0].trim().toLowerCase();
  if (!(CLIP_TYPES as readonly string[]).includes(type)) return 'clip_wrong_type';
  const duration = validateClipDuration(file.durationSeconds);
  if (duration) return duration;
  if (file.bytes > CLIP_MAX_BYTES) return 'clip_too_large';
  return null;
}

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

/**
 * Geri sayım yalnızca kapanacak testlerde gösterilir. Örnek testler kapanmaz (0014:
 * closes_at yüz yıl ileride) ve listede "876567 saat kaldı" yazıyordu — sayı doğru,
 * gösterilmesi yanlıştı.
 */
export const showsCountdown = (isDemo: boolean, status: string): boolean =>
  !isDemo && status === 'open';

/** Test açılırken ilk sorulan şey: video hangi orana çekildi. */
export type ClipFormat = 'horizontal' | 'vertical';

/**
 * Seçilen format ile klibin gerçek oranı uyuşuyor mu. Uyuşmazsa ızgara yanlış havuzdan
 * beslenir (0024) ve sonuç gerçekte olacağından iyi çıkar — sessiz bir ölçüm hatası,
 * o yüzden yüklemeden önce durduruluyor.
 */
export const orientationMatches = (format: ClipFormat, clipIsVertical: boolean): boolean =>
  (format === 'vertical') === clipIsVertical;

/** Sihirbazın adımları, ekranda göründükleri sırayla. */
export const WIZARD_STEPS = [
  'format',
  'thumbnails',
  'titles',
  'clip',
  'quantity',
  'review',
] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

export type WizardState = {
  format: ClipFormat | null;
  /** Birden fazla kanal varsa biri seçilmiş mi. Tek kanallıda her zaman true. */
  channelChosen: boolean;
  thumbnailCount: number;
  titlesProblem: TitlesProblem | null;
  hasClip: boolean;
  affordable: boolean;
};

/**
 * O adımda "Devam" açılabilir mi.
 *
 * Neden burada ve neden adım ADIYLA (2026-09-28): bu mantık ekranın içinde, adım
 * numarasıyla indekslenen bir dizi olarak duruyordu. `FormatStep` sihirbazın başına
 * eklendiğinde dizi kaydırılmayı unuttu ve sihirbazın TAMAMI bir adım kaydı: ilk adım
 * henüz yüklenmemiş thumbnail'ları soruyor, başlıklar adımı daha sonra seçilecek klibi
 * bekliyordu. Test açmak tamamen imkânsız hâle geldi ve bu canlıya çıktı.
 *
 * Sıra numarası yerine ad kullanmak o hatayı imkânsız kılıyor: yeni bir adım araya
 * girdiğinde eşleşme bozulmuyor, ve buradaki `switch` eksik bir adımda derlenmiyor.
 */
export function canContinue(step: WizardStep, state: WizardState): boolean {
  switch (step) {
    case 'format':
      return state.format !== null;
    case 'thumbnails':
      // Kanal seçicisi BU adımda çiziliyor, o yüzden kapı da burada. Genel bir koşul
      // olarak uygulanınca (2026-09-29) ilk adımı kilitliyordu ve kilidi açacak kontrol
      // bir sonraki adımdaydı — çıkışsız. Kapı, kontrolün göründüğü adıma ait.
      return state.thumbnailCount > 0 && state.channelChosen;
    case 'titles':
      return state.titlesProblem === null;
    case 'clip':
      return state.hasClip;
    case 'quantity':
      return state.affordable;
    case 'review':
      return true;
  }
}

// ---------- klip sıkıştırma planı ----------

/** Sıkıştırılmış klipte hedeflenen en yüksek çözünürlük kenarı (PRODUCT §6: 720p). */
export const CLIP_MAX_EDGE = 1280;
/** Ses için ayrılan pay; bütçeden düşülür. */
const CLIP_AUDIO_BITRATE = 128_000;
/** Konteyner ve değişken bit hızı payı: hedefi bütçenin biraz altında tutar. */
const CLIP_BUDGET_SAFETY = 0.9;
/** Altına inmeyeceğimiz taban: daha düşüğü izlenemeyecek hâle getirir. */
const CLIP_MIN_BITRATE = 400_000;

export type ClipSource = {
  bytes: number;
  durationSeconds: number;
  width: number;
  height: number;
};

export type ClipPlan = { skip: true } | { skip: false; bitrate: number; maxSize: number };

/**
 * Klip yeniden kodlanmalı mı, kodlanacaksa hangi bit hızıyla.
 *
 * BULGU (2026-09-29, kullanıcı gerçek cihazda bildirdi): sıkıştırma SABİT 2 Mbps ile
 * çağrılıyordu. 58 saniyelik bir klip bu hızda ~14 MB ediyor, yani sıkıştırıcı 1.17 MB'lık
 * bir dosyayı 14 MB'a BÜYÜTÜYOR ve sonra kendi 8 MB sınırımıza takılıyordu. Ürün zaten
 * 60 saniye istediği için bu bir kenar durum değil, normal durumdu: uzun her klip
 * reddediliyordu ve hata mesajı "daha kısa bir klip dene" diyerek kullanıcıyı yanlış
 * yöne gönderiyordu.
 *
 * İki kural: (1) bit hızı süreye göre 8 MB bütçesinden hesaplanır, (2) kaynağın kendi
 * bit hızını hiç aşmaz — sıkıştırma dosyayı asla büyütmemeli. Zaten sınırların içinde ve
 * 720p'yi aşmayan bir klip hiç yeniden kodlanmaz; yeniden kodlamak onu yalnızca
 * bozardı.
 */
export function clipCompressionPlan(source: ClipSource): ClipPlan {
  const longestEdge = Math.max(source.width, source.height);
  const fitsBudget = source.bytes <= CLIP_MAX_BYTES;
  const fitsResolution = longestEdge > 0 && longestEdge <= CLIP_MAX_EDGE;
  if (fitsBudget && fitsResolution) return { skip: true };

  const seconds = Math.max(source.durationSeconds, 1);
  const budget = (CLIP_MAX_BYTES * 8 * CLIP_BUDGET_SAFETY) / seconds - CLIP_AUDIO_BITRATE;
  const sourceBitrate = source.bytes > 0 ? (source.bytes * 8) / seconds : Number.POSITIVE_INFINITY;

  // Taban da kaynakla sınırlı: aksi hâlde zaten çok hafif bir klipte taban devreye girip
  // dosyayı büyütürdü — yani düzeltmeye çalıştığımız hatanın ta kendisi. (Test yakaladı.)
  return {
    skip: false,
    bitrate: Math.floor(Math.min(sourceBitrate, Math.max(budget, CLIP_MIN_BITRATE))),
    maxSize: CLIP_MAX_EDGE,
  };
}
