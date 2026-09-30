// Collab profilinin okunması ve yazılması (F1).
//
// `collab_profiles` üzerinde RLS politikası "collab self" var: kullanıcı yalnızca kendi
// satırını görür ve yazar (0002_collab.sql). Bu yüzden burada RPC'ye gerek yok — aday
// listesi ve mesajlaşma gibi BAŞKASININ verisine dokunan işler `security definer`
// fonksiyonlardan geçer, bu değil.
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

import { EMPTY_COLLAB_PROFILE, sanitizeTypes, type CollabProfile } from './rules';

export async function fetchCollabProfile(userId: string): Promise<CollabProfile> {
  const { data, error } = await supabase
    .from('collab_profiles')
    .select('is_open, types, bio')
    .eq('profile_id', userId)
    .maybeSingle();
  if (error) throw error;
  // Satır yoksa "kapalı" demektir. `maybeSingle` bu yüzden: `single` yokluğu HATA sayar ve
  // Collab'a hiç girmemiş herkesin profil ekranı hata gösterirdi.
  if (!data) return EMPTY_COLLAB_PROFILE;
  return {
    isOpen: data.is_open,
    types: sanitizeTypes(data.types),
    bio: data.bio,
  };
}

export const collabProfileQueryKey = (userId: string | undefined) =>
  ['collab-profile', userId] as const;

export function useCollabProfile(userId: string | undefined) {
  return useQuery({
    queryKey: collabProfileQueryKey(userId),
    queryFn: () => fetchCollabProfile(userId as string),
    enabled: !!userId,
  });
}

export async function saveCollabProfile(userId: string, draft: CollabProfile): Promise<void> {
  const { error } = await supabase.from('collab_profiles').upsert(
    {
      profile_id: userId,
      is_open: draft.isOpen,
      // Ekrandan geçse de sunucuya giderken bir kez daha süzülüyor: enum dışı tek bir değer
      // insert'i düşürür ve kullanıcı sebebini anlamayacağı bir hata görür.
      types: sanitizeTypes(draft.types),
      bio: draft.bio,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'profile_id' },
  );
  if (error) throw error;
}
