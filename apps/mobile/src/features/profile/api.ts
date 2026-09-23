import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, display_name, niche_id, language, onboarding_done, reputation, reviews_given, reviews_received, niche_changed_at, is_flagged, flagged_reason',
    )
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

export const profileQueryKey = (userId: string | undefined) => ['profile', userId] as const;

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: profileQueryKey(userId),
    queryFn: () => fetchProfile(userId as string),
    enabled: !!userId,
  });
}

/** Pro abonelik durumu; 25 değerlendirme seçeneği ve AI özeti buna bakar. */
export async function fetchIsPro(userId: string) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('tier, active, expires_at')
    .eq('profile_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.tier !== 'pro' || !data.active) return false;
  return !data.expires_at || new Date(data.expires_at) > new Date();
}

export function useIsPro(userId: string | undefined) {
  return useQuery({
    queryKey: ['is-pro', userId],
    queryFn: () => fetchIsPro(userId as string),
    enabled: !!userId,
  });
}

/** Kredi geçmişi: append-only ledger, client hesap yapmaz (CLAUDE.md). */
export async function fetchCreditHistory(userId: string) {
  const { data, error } = await supabase
    .from('credit_ledger')
    .select('id, delta, reason, note, created_at')
    .eq('profile_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}

export type CreditEntry = Awaited<ReturnType<typeof fetchCreditHistory>>[number];

export function useCreditHistory(userId: string | undefined) {
  return useQuery({
    queryKey: ['credit-history', userId],
    queryFn: () => fetchCreditHistory(userId as string),
    enabled: !!userId,
  });
}

export type NicheChangeError = 'niche_change_too_soon' | 'unknown_niche' | 'unknown';

export async function changeNiche(nicheId: number): Promise<void> {
  const { error } = await supabase.rpc('change_niche', { p_niche_id: nicheId });
  if (error) {
    const code: NicheChangeError = error.message.includes('niche_change_too_soon')
      ? 'niche_change_too_soon'
      : error.message.includes('unknown_niche')
        ? 'unknown_niche'
        : 'unknown';
    throw new Error(code);
  }
}

/** Hesabı ve kendi verisini siler; başkalarına yazdığı değerlendirmeler kimliksiz kalır (0013). */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-account', { body: {} });
  if (error) throw error;
  await supabase.auth.signOut();
}
