import { describe, expect, it } from 'vitest';

import {
  CLIP_MAX_BYTES,
  CLIP_MAX_EDGE,
  MAX_TITLE_LENGTH,
  PRO_REVIEW_COUNT,
  WIZARD_STEPS,
  canAfford,
  canContinue,
  cleanTitles,
  clipCompressionPlan,
  creditCost,
  orientationMatches,
  remainingTime,
  reviewCountOptions,
  showsCountdown,
  submissionErrorCode,
  type WizardState,
  validateClipDuration,
  validateTitles,
} from './rules';

describe('submission rules', () => {
  it('test_submit_titles_are_trimmed_and_empty_ones_dropped', () => {
    expect(cleanTitles(['  A title  ', '', '   ', 'Another'])).toEqual(['A title', 'Another']);
  });

  it('test_submit_titles_require_at_least_one', () => {
    expect(validateTitles([])).toBe('no_titles');
    expect(validateTitles(['   '])).toBe('no_titles');
    expect(validateTitles(['One good title'])).toBeNull();
  });

  it('test_submit_titles_are_capped_at_three_and_100_chars', () => {
    expect(validateTitles(['a', 'b', 'c'])).toBeNull();
    expect(validateTitles(['a', 'b', 'c', 'd'])).toBe('too_many_titles');
    expect(validateTitles(['x'.repeat(MAX_TITLE_LENGTH)])).toBeNull();
    expect(validateTitles(['x'.repeat(MAX_TITLE_LENGTH + 1)])).toBe('title_too_long');
  });

  it('test_submit_clip_duration_must_be_between_5_and_60_seconds', () => {
    expect(validateClipDuration(30)).toBeNull();
    expect(validateClipDuration(60)).toBeNull();
    expect(validateClipDuration(61)).toBeNull(); // rounding tolerance
    expect(validateClipDuration(62)).toBe('clip_too_long');
    expect(validateClipDuration(4)).toBe('clip_too_short');
  });

  it('test_submit_review_count_25_is_pro_only', () => {
    expect(reviewCountOptions(false)).toEqual([5, 10, 15]);
    expect(reviewCountOptions(true)).toContain(PRO_REVIEW_COUNT);
  });

  it('test_submit_cost_equals_requested_reviews', () => {
    expect(creditCost(5)).toBe(5);
    expect(creditCost(15)).toBe(15);
    expect(canAfford(5, 5)).toBe(true);
    expect(canAfford(4, 5)).toBe(false);
  });

  it('test_submit_server_errors_map_to_known_codes', () => {
    // postgrest hatayı sarmalıyor, mesajın içinde arıyoruz
    expect(submissionErrorCode('insufficient_credits')).toBe('insufficient_credits');
    expect(submissionErrorCode('P0001: pro_required')).toBe('pro_required');
    expect(submissionErrorCode('could not connect')).toBe('unknown');
    expect(submissionErrorCode(undefined)).toBe('unknown');
  });

  it('test_submit_remaining_time_counts_down_and_expires', () => {
    const now = new Date('2026-09-23T10:00:00Z');
    expect(remainingTime('2026-09-23T13:30:00Z', now)).toEqual({
      expired: false,
      hours: 3,
      minutes: 30,
    });
    expect(remainingTime('2026-09-23T09:59:00Z', now).expired).toBe(true);
  });
});

describe('showsCountdown', () => {
  it('test_open_real_test_counts_down', () => {
    expect(showsCountdown(false, 'open')).toBe(true);
  });

  it('test_demo_test_never_counts_down', () => {
    // Örnek test kapanmaz; listede "876567 saat kaldı" yazıyordu (2026-09-25).
    expect(showsCountdown(true, 'open')).toBe(false);
  });

  it('test_closed_test_shows_its_status_instead', () => {
    expect(showsCountdown(false, 'completed')).toBe(false);
  });
});

describe('orientationMatches', () => {
  it('test_submit_orientation_accepts_a_matching_clip', () => {
    expect(orientationMatches('vertical', true)).toBe(true);
    expect(orientationMatches('horizontal', false)).toBe(true);
  });

  // Uyuşmazsa ızgara yanlış havuzdan beslenir ve sonuç gerçekte olacağından iyi çıkar.
  it('test_submit_orientation_rejects_a_clip_of_the_other_shape', () => {
    expect(orientationMatches('vertical', false)).toBe(false);
    expect(orientationMatches('horizontal', true)).toBe(false);
  });
});

describe('canContinue', () => {
  // Sihirbazın en baştaki hâli: hiçbir şey seçilmemiş, hiçbir şey yüklenmemiş.
  const empty: WizardState = {
    format: null,
    channelChosen: true,
    thumbnailCount: 0,
    titlesProblem: 'no_titles',
    hasClip: false,
    affordable: false,
  };

  it('test_wizard_first_step_asks_only_for_the_format', () => {
    // Asıl gerileme buydu: ilk adım, henüz yüklenmemiş thumbnail'ları soruyordu ve
    // "Devam" hiç açılmıyordu — test açmak tamamen imkânsızdı (2026-09-28, canlıda).
    expect(canContinue('format', empty)).toBe(false);
    expect(canContinue('format', { ...empty, format: 'vertical' })).toBe(true);
  });

  it('test_wizard_first_step_does_not_wait_for_a_later_step', () => {
    // Format seçiliyse, sonraki adımların hiçbiri ilk adımı kilitlememeli.
    expect(canContinue('format', { ...empty, format: 'horizontal' })).toBe(true);
  });

  it('test_wizard_each_step_gates_on_its_own_field', () => {
    expect(canContinue('thumbnails', empty)).toBe(false);
    expect(canContinue('thumbnails', { ...empty, thumbnailCount: 1 })).toBe(true);

    expect(canContinue('titles', empty)).toBe(false);
    expect(canContinue('titles', { ...empty, titlesProblem: null })).toBe(true);

    expect(canContinue('clip', empty)).toBe(false);
    expect(canContinue('clip', { ...empty, hasClip: true })).toBe(true);

    expect(canContinue('quantity', empty)).toBe(false);
    expect(canContinue('quantity', { ...empty, affordable: true })).toBe(true);
  });

  it('test_wizard_unpicked_channel_only_blocks_the_step_that_picks_it', () => {
    // İkinci gerileme (2026-09-29, canlıda): kanal seçme koşulu TÜM adımlara
    // uygulanıyordu. Birden fazla kanalı olan kullanıcı ilk adımda kilitleniyordu ve
    // kanal seçicisi bir sonraki adımdaydı — çıkışsız.
    const noChannel = { ...empty, channelChosen: false };

    expect(canContinue('format', { ...noChannel, format: 'vertical' })).toBe(true);
    expect(canContinue('titles', { ...noChannel, titlesProblem: null })).toBe(true);
    expect(canContinue('clip', { ...noChannel, hasClip: true })).toBe(true);
    expect(canContinue('quantity', { ...noChannel, affordable: true })).toBe(true);

    // Kapı yalnızca seçicinin göründüğü adımda.
    expect(canContinue('thumbnails', { ...noChannel, thumbnailCount: 1 })).toBe(false);
    expect(canContinue('thumbnails', { ...empty, thumbnailCount: 1 })).toBe(true);
  });

  it('test_wizard_last_step_is_always_continuable', () => {
    // Özet adımında ileri gidilecek bir yer yok; kapı burada değil.
    expect(canContinue('review', empty)).toBe(true);
  });

  it('test_wizard_steps_are_in_the_order_the_screens_render', () => {
    // Bu dizinin sırası ekrandaki `step === 0..5` dallarıyla eşleşmek ZORUNDA; bir adım
    // araya girip burası güncellenmezse hata sessizce geri gelir.
    expect(WIZARD_STEPS).toEqual(['format', 'thumbnails', 'titles', 'clip', 'quantity', 'review']);
  });
});

describe('clipCompressionPlan', () => {
  it('test_clip_already_within_limits_is_not_re_encoded', () => {
    // Asıl gerileme: sabit 2 Mbps ile yeniden kodlama 1.17 MB'lık 58 sn'lik dikey klibi
    // ~14 MB'a BÜYÜTÜYOR ve kendi 8 MB sınırımıza takılıyordu (2026-09-29, gerçek cihaz).
    expect(
      clipCompressionPlan({ bytes: 1_226_000, durationSeconds: 58, width: 608, height: 1080 }),
    ).toEqual({ skip: true });
  });

  it('test_clip_bitrate_fits_the_size_budget_for_its_duration', () => {
    const plan = clipCompressionPlan({
      bytes: 90 * 1024 * 1024,
      durationSeconds: 60,
      width: 3840,
      height: 2160,
    });
    if (plan.skip) throw new Error('büyük klip yeniden kodlanmalı');

    // Hedef bit hızı, süreye çarpıldığında 8 MB'ı aşmamalı — eski sabit 2 Mbps aşıyordu.
    const estimatedBytes = ((plan.bitrate + 128_000) * 60) / 8;
    expect(estimatedBytes).toBeLessThanOrEqual(CLIP_MAX_BYTES);
    expect(plan.maxSize).toBe(CLIP_MAX_EDGE);
  });

  it('test_compression_never_raises_the_bitrate_above_the_source', () => {
    // Çözünürlüğü yüksek ama zaten çok düşük bit hızlı bir klip: yeniden kodlanıyor
    // (720p'yi aşıyor) ama kaynaktan daha yüksek bir hızla değil.
    const source = { bytes: 2_000_000, durationSeconds: 58, width: 1920, height: 1080 };
    const plan = clipCompressionPlan(source);
    if (plan.skip) throw new Error('720p üstü klip yeniden kodlanmalı');
    expect(plan.bitrate).toBeLessThanOrEqual((source.bytes * 8) / source.durationSeconds);
  });

  it('test_a_short_clip_may_use_a_higher_bitrate_than_a_long_one', () => {
    const short = clipCompressionPlan({
      bytes: 5e8,
      durationSeconds: 10,
      width: 3840,
      height: 2160,
    });
    const long = clipCompressionPlan({
      bytes: 5e8,
      durationSeconds: 60,
      width: 3840,
      height: 2160,
    });
    if (short.skip || long.skip) throw new Error('ikisi de yeniden kodlanmalı');
    expect(short.bitrate).toBeGreaterThan(long.bitrate);
  });
});
