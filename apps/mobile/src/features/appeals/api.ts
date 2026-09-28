import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

/**
 * Gizlenen testin geri dönüş yolu (0030). Otomatik kural tek ağırlıklı ağır raporla
 * gizleyebiliyor; bunun adil olması itirazın var olmasına bağlı — YouTube, Meta ve
 * TikTok'un üçünde de itiraz var ve haklı çıkan içerik geri geliyor.
 */
export const APPEAL_ERRORS = [
  'not_owner',
  'not_hidden',
  'already_appealed',
  'unknown_submission',
] as const;

export type AppealErrorCode = (typeof APPEAL_ERRORS)[number] | 'unknown';

export class AppealFailed extends Error {
  constructor(readonly code: AppealErrorCode) {
    super(code);
    this.name = 'AppealFailed';
  }
}

const codeOf = (message: string): AppealErrorCode =>
  APPEAL_ERRORS.find((code) => message.includes(code)) ?? 'unknown';

export async function appealSubmission(input: { submissionId: string; note: string }) {
  const { error } = await supabase.rpc('appeal_submission', {
    p_submission_id: input.submissionId,
    p_note: input.note.trim() || undefined,
  });
  if (error) throw new AppealFailed(codeOf(error.message));
}

export function useAppeal(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: appealSubmission,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['submissions', userId] }),
  });
}
