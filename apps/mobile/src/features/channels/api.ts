import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

/**
 * Bir hesapta birden fazla kanal olabilir (0020). Testin nişi kanaldan okunduğu için
 * sihirbaz, hesapta birden fazla kanal varsa hangisi olduğunu sormak zorunda —
 * sessizce ilkini seçmek testi yanlış havuza gönderirdi.
 */
export async function fetchMyChannels(userId: string) {
  const { data, error } = await supabase
    .from('channels')
    .select('id, channel_title, youtube_url, niche_id, language, band, created_at')
    .eq('profile_id', userId)
    .order('created_at');
  if (error) throw error;
  return data;
}

export type Channel = Awaited<ReturnType<typeof fetchMyChannels>>[number];

export const channelsQueryKey = (userId: string | undefined) => ['channels', userId];

export function useMyChannels(userId: string | undefined) {
  return useQuery({
    queryKey: channelsQueryKey(userId),
    queryFn: () => fetchMyChannels(userId as string),
    enabled: !!userId,
  });
}

/** Kanal adı yoksa adresin son parçası gösterilir: "@moneyrematch". */
export const channelLabel = (channel: Channel): string =>
  channel.channel_title?.trim() ||
  channel.youtube_url.replace(/\/$/, '').split('/').pop() ||
  channel.youtube_url;
