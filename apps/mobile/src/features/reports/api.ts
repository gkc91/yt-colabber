import { supabase } from '@/lib/supabase';

/** Sabit sebepler; sunucu da aynı listeyi doğruluyor (0012). */
export const REPORT_REASONS = ['inappropriate', 'spam', 'abusive', 'copyright', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export type ReportTarget = { type: 'submission' | 'review'; id: string };

export type ReportError = 'no_access' | 'invalid_reason' | 'not_authenticated' | 'unknown';

export function reportErrorCode(message: string | undefined): ReportError {
  const known: ReportError[] = ['no_access', 'invalid_reason', 'not_authenticated'];
  return known.find((code) => message?.includes(code)) ?? 'unknown';
}

/**
 * Raporu yalnızca içeriği görmüş kişi verebilir; kontrol sunucuda (report_content).
 * Aynı kişinin ikinci raporu sessizce yok sayılır, sayaç bir kez artar.
 */
export async function reportContent(
  target: ReportTarget,
  reason: ReportReason,
  note?: string,
): Promise<void> {
  const args = {
    p_target_type: target.type,
    p_target_id: target.id,
    p_reason: reason,
    p_note: note?.trim() || null,
  } as unknown as Parameters<typeof supabase.rpc<'report_content'>>[1];

  const { error } = await supabase.rpc('report_content', args);
  if (error) throw new Error(reportErrorCode(error.message));
}
