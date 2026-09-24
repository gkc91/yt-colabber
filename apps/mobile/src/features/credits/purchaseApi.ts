// Paywall'ın veri katmanı (D2). Mağaza akışı `@/lib/purchases` üzerinden; kredi
// sunucudan okunur — istemci hiçbir zaman bakiye hesaplamaz (CLAUDE.md).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { purchases } from '@/lib/purchases';
import { type PurchaseOption } from '@/lib/purchases.types';

import { fetchBalance } from './api';
import { waitForCredits, type PurchaseWaitOutcome } from './purchaseFlow';

export { purchaseErrorKey } from './purchaseErrors';
export type { PurchaseOption };

export const purchaseOptionsKey = ['purchase-options'] as const;

/** Mağazadaki paketler. Anahtar yoksa / web'de hata döner; ekran "uygulamada aç" gösterir. */
export function usePurchaseOptions() {
  return useQuery({
    queryKey: purchaseOptionsKey,
    queryFn: () => purchases.listOptions(),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export interface PurchaseOutcome {
  /** Kredi paketinde: bakiye arttı mı, yoksa webhook hâlâ yolda mı. */
  outcome: PurchaseWaitOutcome;
  balance: number;
  proActive: boolean;
  kind: PurchaseOption['kind'];
}

/**
 * Satın alma: mağaza ekranı → (kredi paketiyse) bakiyenin artmasını bekle → önbelleği tazele.
 * Pro'da bakiye beklenmez; aylık kredi hediyesi de webhook'la gelir ama Pro hakkı
 * mağazadan dönen bilgiyle hemen açılır.
 */
export function usePurchase(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<PurchaseOutcome, Error, PurchaseOption>({
    mutationFn: async (option) => {
      const previous = userId ? await fetchBalance(userId) : 0;
      const { proActive } = await purchases.purchase(option.packageId);

      const waited = userId
        ? await waitForCredits({ readBalance: () => fetchBalance(userId), previous })
        : { outcome: 'pending' as const, balance: previous };

      return { outcome: waited.outcome, balance: waited.balance, proActive, kind: option.kind };
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['balance', userId] });
    },
  });
}

export function useRestore(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => purchases.restore(),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['balance', userId] });
    },
  });
}
