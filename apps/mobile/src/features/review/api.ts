import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

import type { Decoy, ReasonTag } from './rules';

export type ReviewTask = {
  id: string;
  submission_id: string;
  thumbnail_index: number;
  title_index: number;
  candidate_position: number;
  decoys: Decoy[];
  expires_at: string;
};

export type ReviewAssignment = {
  task: ReviewTask;
  title: string;
  clipDurationSeconds: number;
  /** Örnek test (0014): arayüzde rozetle gösterilir, kredi ödülü aynıdır. */
  isDemo: boolean;
};

type NextTaskResponse = {
  task: ReviewTask | null;
  title?: string;
  clip_duration_seconds?: number;
  is_demo?: boolean;
};

/** Sunucu görevi seçer ve açar; aynı kişiye aynı submission iki kez gelmez (0001/0007). */
export async function fetchNextTask(): Promise<ReviewAssignment | null> {
  const { data, error } = await supabase.rpc('next_review_task');
  if (error) throw error;

  const response = data as unknown as NextTaskResponse;
  if (!response?.task) return null;
  return {
    task: response.task,
    title: response.title ?? '',
    clipDurationSeconds: response.clip_duration_seconds ?? 0,
    isDemo: response.is_demo ?? false,
  };
}

export function useNextTask(enabled: boolean) {
  return useQuery({
    queryKey: ['review-task'],
    queryFn: fetchNextTask,
    enabled,
    // Görev 30 dk sonra düşer; ekran her açıldığında tazele.
    staleTime: 0,
  });
}

export type ReviewSubmission = {
  taskId: string;
  pickedCandidate: boolean;
  pickedPosition: number;
  decisionMs: number;
  titleGuess: string;
  leaveSecond: number | null;
  watchedSeconds: number;
  tags: ReasonTag[];
  comment: string | null;
  timeSpentSeconds: number;
};

/** NULL dönerse değerlendirme çok hızlıydı (0003): kredi yok, itibar düştü. */
export async function submitReview(input: ReviewSubmission): Promise<string | null> {
  // leave_second ve comment SQL'de NULL alabilir; üretilen tipler bunu ifade etmiyor.
  const args = {
    p_task_id: input.taskId,
    p_picked_candidate: input.pickedCandidate,
    p_picked_position: input.pickedPosition,
    p_decision_ms: input.decisionMs,
    p_title_guess: input.titleGuess,
    p_leave_second: input.leaveSecond,
    p_watched_seconds: input.watchedSeconds,
    p_reason_tags: input.tags,
    p_comment: input.comment,
    p_time_spent: input.timeSpentSeconds,
  } as unknown as Parameters<typeof supabase.rpc<'submit_review'>>[1];

  const { data, error } = await supabase.rpc('submit_review', args);
  if (error) throw error;
  return (data as string | null) ?? null;
}

export type ReviewedChannel = { channel_title: string | null; youtube_url: string | null };

/** Yalnızca değerlendirme gönderildikten sonra çalışır (0007, PRODUCT §5). */
export async function fetchReviewedChannel(submissionId: string): Promise<ReviewedChannel> {
  const { data, error } = await supabase.rpc('reviewed_channel', {
    p_submission_id: submissionId,
  });
  if (error) throw error;
  return data as unknown as ReviewedChannel;
}
