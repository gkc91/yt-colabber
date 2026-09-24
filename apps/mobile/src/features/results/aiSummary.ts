// AI özeti (D3): durum sorgusu + üretim isteği.
//
// Özet bizim Anthropic anahtarımızla üretiliyor; bütün kurallar sunucuda (0016):
// Pro, testin sahibi, en az N değerlendirme, 30 günlük kullanım sınırı ve test başına
// tek üretim. İstemci hiçbir şeye karar vermez, yalnızca sunucunun söylediğini gösterir.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

import { resultsQueryKey } from './api';

/** `ai_summary_status` sebep kodları; her biri için bir i18n metni var. */
export type AiSummaryReason =
  'ok' | 'already_generated' | 'pro_required' | 'not_enough_reviews' | 'monthly_limit';

export interface AiSummaryStatus {
  reason: AiSummaryReason;
  used: number;
  limit: number;
  minReviews: number;
  receivedReviews: number;
}

export const aiSummaryStatusKey = (submissionId: string) =>
  ['ai-summary-status', submissionId] as const;

export async function fetchAiSummaryStatus(submissionId: string): Promise<AiSummaryStatus> {
  const { data, error } = await supabase.rpc('ai_summary_status', { p_submission: submissionId });
  if (error) throw error;
  const row = data as unknown as {
    reason: AiSummaryReason;
    used: number;
    limit: number;
    min_reviews: number;
    received_reviews: number;
  };
  return {
    reason: row.reason,
    used: row.used,
    limit: row.limit,
    minReviews: row.min_reviews,
    receivedReviews: row.received_reviews,
  };
}

export function useAiSummaryStatus(submissionId: string, enabled: boolean) {
  return useQuery({
    queryKey: aiSummaryStatusKey(submissionId),
    queryFn: () => fetchAiSummaryStatus(submissionId),
    enabled: enabled && !!submissionId,
  });
}

/** Edge Function'ın gövdesindeki hata kodu; ekranda mesaja çevrilir. */
export class AiSummaryError extends Error {}

export function useGenerateAiSummary(submissionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('ai-summary', {
        body: { submission_id: submissionId },
      });
      // Edge Function 2xx dışında dönerse supabase-js gövdeyi hataya sarar.
      if (error) {
        const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
        throw new AiSummaryError(body?.error ?? 'summary_failed');
      }
      return (data as { summary: string }).summary;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: resultsQueryKey(submissionId) });
      await queryClient.invalidateQueries({ queryKey: aiSummaryStatusKey(submissionId) });
    },
  });
}
