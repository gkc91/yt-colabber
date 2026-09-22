import { useQuery } from '@tanstack/react-query';

import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

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

export async function saveNicheAndLanguage(userId: string, nicheId: number, language: string) {
  const { error } = await supabase
    .from('profiles')
    .update({ niche_id: nicheId, language })
    .eq('id', userId);
  if (error) throw error;
}

export async function completeOnboarding(
  userId: string,
  channel: YouTubeChannelRef,
  band: SubscriberBand | null,
) {
  const { error: channelError } = await supabase.from('channels').upsert(
    {
      profile_id: userId,
      youtube_url: channel.url,
      youtube_channel_id: channel.kind === 'channel' ? channel.channelId : null,
      band,
    },
    { onConflict: 'profile_id' },
  );
  if (channelError) throw channelError;

  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_done: true })
    .eq('id', userId);
  if (error) throw error;
}
