import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import type { YouTubeChannelRef } from '@/features/onboarding/youtube';

type SubscriberBand = Database['public']['Enums']['subscriber_band'];

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

/**
 * Kanal satırını client yazmaz (0020): niş kanalda durduğu için serbest yazma
 * "ayda bir niş değiştirme" kuralını delerdi.
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
  if (error) throw new ChannelFailed(channelErrorCode(error.message));
  return data as string;
}

export async function changeChannelNiche(input: { channelId: string; nicheId: number }) {
  const { error } = await supabase.rpc('change_channel_niche', {
    p_channel_id: input.channelId,
    p_niche_id: input.nicheId,
  });
  if (error) throw new ChannelFailed(channelErrorCode(error.message));
}

export const CHANNEL_ERRORS = [
  'channel_limit',
  'channel_taken',
  'channel_url_required',
  'niche_change_too_soon',
  'unknown_niche',
  'not_owner',
] as const;

export type ChannelErrorCode = (typeof CHANNEL_ERRORS)[number] | 'unknown';

/** Postgres hata metni "… message" biçiminde gelir; sondaki kodu ayıklarız. */
export function channelErrorCode(message: string): ChannelErrorCode {
  const found = CHANNEL_ERRORS.find((code) => message.includes(code));
  return found ?? 'unknown';
}

export class ChannelFailed extends Error {
  constructor(readonly code: ChannelErrorCode) {
    super(code);
    this.name = 'ChannelFailed';
  }
}
