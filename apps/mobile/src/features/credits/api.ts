import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

// Read-only: the balance is the ledger sum computed in Postgres. The client never computes it.
export async function fetchBalance(userId: string) {
  const { data, error } = await supabase
    .from('profile_balances')
    .select('balance')
    .eq('profile_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.balance ?? 0;
}

export function useBalance(userId: string | undefined) {
  return useQuery({
    queryKey: ['balance', userId],
    queryFn: () => fetchBalance(userId as string),
    enabled: !!userId,
  });
}
