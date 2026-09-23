// Sonuç ekranının hesapları (PRODUCT §7). Saf mantık: birim testleri buradadır.
// Sayıların kaynağı submission_results (0008); burada yalnızca sunum için türetme yapılır.

export const WINNER_VOTE_GAP = 3;
export const HISTOGRAM_BUCKETS = 12; // 60 sn / 5 sn

export type ThumbnailStat = {
  idx: number;
  shown: number;
  picked: number;
  picked_w: number;
  total_w: number;
  avg_decision_ms: number | null;
};

export type TitleStat = {
  idx: number;
  shown: number;
  understood: number;
  misunderstood: number;
};

export type HookStat = {
  leave_seconds: number[];
  finished_ratio: number;
  median_leave: number | null;
  tags: Record<string, number>;
};

/** Seçilme oranı ağırlıklı hesaplanır: oy ağırlığı = değerlendiricinin itibarı. */
export function pickRate(stat: ThumbnailStat): number {
  if (!stat.total_w) return 0;
  return stat.picked_w / stat.total_w;
}

/**
 * Kazanan yalnızca ham oy farkı en az 3 ise ilan edilir (PRODUCT §7).
 * Az oyla "kazanan" demek, gürültüyü sonuç gibi sunmak olurdu.
 */
export function winnerIndex(stats: ThumbnailStat[]): number | null {
  if (stats.length < 2) return null;
  const sorted = [...stats].sort((a, b) => b.picked - a.picked);
  return sorted[0].picked - sorted[1].picked >= WINNER_VOTE_GAP ? sorted[0].idx : null;
}

/** 0-60 sn'yi 5 saniyelik kovalara böler; her kova o aralıkta kaç kişinin bıraktığı. */
export function leaveHistogram(leaveSeconds: number[], clipSeconds: number): number[] {
  const buckets = new Array(HISTOGRAM_BUCKETS).fill(0);
  const span = Math.max(clipSeconds, 1) / HISTOGRAM_BUCKETS;
  for (const second of leaveSeconds) {
    const index = Math.min(HISTOGRAM_BUCKETS - 1, Math.max(0, Math.floor(second / span)));
    buckets[index] += 1;
  }
  return buckets;
}

export const percent = (ratio: number): number => Math.round(ratio * 100);

/** Etiketler çoktan aza; eşitlikte alfabetik (liste her açılışta aynı sırada olsun). */
export function sortedTags(tags: Record<string, number>): { tag: string; count: number }[] {
  return Object.entries(tags)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export const hasEnoughForResults = (receivedReviews: number): boolean => receivedReviews > 0;
