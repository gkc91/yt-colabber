// Değerlendirme kapsamı (B6): kendi nişin/dilin dışında hangi testleri alabileceğin.
// Kendi testin HER ZAMAN tek niş + tek dile gider; burada yalnızca değerlendirme tarafı seçilir.
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

import { MAX_EXTRA_LANGUAGES, MAX_EXTRA_NICHES } from './scopeRules';

export type ReviewScope = {
  nicheId: number | null;
  language: string;
  alsoNicheIds: number[];
  alsoLanguages: string[];
};

export async function fetchReviewScope(userId: string): Promise<ReviewScope> {
  const { data, error } = await supabase
    .from('profiles')
    .select('niche_id, language, also_review_niche_ids, also_review_languages')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return {
    nicheId: data.niche_id,
    language: data.language,
    alsoNicheIds: data.also_review_niche_ids ?? [],
    alsoLanguages: data.also_review_languages ?? [],
  };
}

export const reviewScopeQueryKey = (userId: string | undefined) =>
  ['review-scope', userId] as const;

export function useReviewScope(userId: string | undefined) {
  return useQuery({
    queryKey: reviewScopeQueryKey(userId),
    queryFn: () => fetchReviewScope(userId as string),
    enabled: !!userId,
  });
}

export async function saveReviewScope(
  userId: string,
  scope: { alsoNicheIds: number[]; alsoLanguages: string[] },
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      also_review_niche_ids: scope.alsoNicheIds.slice(0, MAX_EXTRA_NICHES),
      also_review_languages: scope.alsoLanguages.slice(0, MAX_EXTRA_LANGUAGES),
    })
    .eq('id', userId);
  if (error) throw error;
}

export { MAX_EXTRA_LANGUAGES, MAX_EXTRA_NICHES, toggleWithin } from './scopeRules';
