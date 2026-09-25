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

/**
 * Kanal satırını client yazmaz: niş kanalda durduğu için serbest yazma, "ayda bir niş
 * değiştirme" kuralını delerdi (0020). Ekleme `add_channel` fonksiyonundan geçer.
 */
export async function addChannel(input: {
  channel: YouTubeChannelRef;
  band: SubscriberBand | null;
  nicheId: number;
  language: string;
}) {
  const { data, error } = await supabase.rpc('add_channel', {
    p_youtube_url: input.channel.url,
    p_youtube_channel_id: input.channel.kind === 'channel' ? input.channel.channelId : undefined,
    p_band: input.band ?? undefined,
    p_niche_id: input.nicheId,
    p_language: input.language,
  });
  if (error) throw error;
  return data as string;
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
