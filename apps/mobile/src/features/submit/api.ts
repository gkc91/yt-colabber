import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

import { submissionErrorCode, type ReviewCount } from './rules';

export type NewSubmission = {
  titles: string[];
  thumbnailPaths: string[];
  clipPath: string;
  clipDurationSeconds: number;
  requested: ReviewCount;
};

export class SubmissionFailed extends Error {
  constructor(readonly code: ReturnType<typeof submissionErrorCode>) {
    super(code);
    this.name = 'SubmissionFailed';
  }
}

/** Krediyi düşen ve submission'ı açan tek yer Postgres'tir (create_submission). */
export async function createSubmission(input: NewSubmission): Promise<string> {
  const { data, error } = await supabase.rpc('create_submission', {
    p_title_options: input.titles,
    p_thumbnail_paths: input.thumbnailPaths,
    p_clip_path: input.clipPath,
    p_clip_duration: input.clipDurationSeconds,
    p_requested: input.requested,
  });
  if (error) throw new SubmissionFailed(submissionErrorCode(error.message));
  return data as string;
}

export async function fetchMySubmissions(userId: string) {
  const { data, error } = await supabase
    .from('submissions')
    .select(
      'id, status, requested_reviews, received_reviews, created_at, closes_at, title_options, is_demo',
    )
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export type MySubmission = Awaited<ReturnType<typeof fetchMySubmissions>>[number];

export function useMySubmissions(userId: string | undefined) {
  return useQuery({
    queryKey: ['submissions', userId],
    queryFn: () => fetchMySubmissions(userId as string),
    enabled: !!userId,
  });
}
