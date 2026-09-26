import { useQuery } from '@tanstack/react-query';

import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

import { addChannel } from '@/features/channels/api';

import type { YouTubeChannelRef } from './youtube';

export type SubscriberBand = Database['public']['Enums']['subscriber_band'];

export async function fetchNiches() {
  const { data, error } = await supabase
    .from('niches')
    .select('id, slug, name')
    .eq('is_active', true)
    .order('id');
  if (error) throw error;
  return data;
}

export function useNiches() {
  return useQuery({ queryKey: ['niches'], queryFn: fetchNiches, staleTime: Infinity });
}

/**
 * İlk niş RPC'den yazılır. Doğrudan UPDATE artık RLS'e takılıyor (0021): niş sütunu
 * serbest olsaydı "ayda bir niş değiştirme" kuralı tek istekle aşılırdı.
 */
export async function saveNicheAndLanguage(_userId: string, nicheId: number, language: string) {
  const { error } = await supabase.rpc('set_initial_niche', {
    p_niche_id: nicheId,
    p_language: language,
  });
  if (error) throw error;
}

export async function completeOnboarding(
  userId: string,
  channel: YouTubeChannelRef,
  band: SubscriberBand | null,
  nicheId: number,
  language: string,
) {
  await addChannel({ channel, band, nicheId, language });

  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_done: true })
    .eq('id', userId);
  if (error) throw error;
}
