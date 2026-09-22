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
