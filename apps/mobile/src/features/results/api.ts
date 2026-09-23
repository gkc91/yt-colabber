import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

import type { HookStat, ThumbnailStat, TitleStat } from './rules';

export type ResultReview = {
  id: string;
  title_guess: string;
  comment: string | null;
  leave_second: number | null;
  reason_tags: string[];
  helpful: boolean | null;
  promise_understood: boolean | null;
  title_index: number;
  thumbnail_index: number;
  created_at: string;
};

export type SubmissionResults = {
  submission: {
    id: string;
    title_options: string[];
    thumbnail_paths: string[];
    clip_duration_seconds: number;
    requested_reviews: number;
    received_reviews: number;
    status: string;
    ai_summary: string | null;
  };
  thumbnails: ThumbnailStat[];
  titles: TitleStat[];
  hook: HookStat;
  reviews: ResultReview[];
};

export async function fetchResults(submissionId: string): Promise<SubmissionResults> {
  const { data, error } = await supabase.rpc('submission_results', { p_id: submissionId });
  if (error) throw error;
  return data as unknown as SubmissionResults;
}

export const resultsQueryKey = (submissionId: string) => ['results', submissionId] as const;

export function useResults(submissionId: string) {
  return useQuery({
    queryKey: resultsQueryKey(submissionId),
    queryFn: () => fetchResults(submissionId),
    enabled: !!submissionId,
  });
}

/**
 * Yararlı/değil oyu ve "vaadi anladı mı" işareti. Değerlendiricinin itibarını besler
 * (rate_review, 0001): yararlı +0.05, yararsız −0.10.
 */
export async function rateReview(input: {
  reviewId: string;
  helpful: boolean;
  promiseUnderstood?: boolean | null;
}): Promise<void> {
  const args = {
    p_review_id: input.reviewId,
    p_helpful: input.helpful,
    p_promise_understood: input.promiseUnderstood ?? null,
  } as unknown as Parameters<typeof supabase.rpc<'rate_review'>>[1];

  const { error } = await supabase.rpc('rate_review', args);
  if (error) throw error;
}
