import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, niche_id, language, onboarding_done')
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
