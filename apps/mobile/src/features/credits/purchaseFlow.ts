// Satın alma sonrası bekleme mantığı (D2). Saf: birim testleri buradadır.
//
// Mağaza "satın alındı" dediği anda kredi HENÜZ yoktur: RevenueCat webhook'u sunucuya
// ulaşıp `grant_purchase` çalışınca bakiye artar. Bu genelde saniyeler sürer ama
// garantisi yoktur. Bu yüzden ekran bakiyeyi kısa süre yoklar ve sonucu dürüstçe söyler:
// "geldi" ya da "satın alman tamam, kredi birazdan düşecek".

export type PurchaseWaitOutcome = 'credited' | 'pending';

export interface WaitForCreditsOptions {
  /** Sunucudaki güncel bakiyeyi okur. */
  readBalance: () => Promise<number>;
  /** Satın almadan önceki bakiye. */
  previous: number;
  /** Kaç kez yoklanacak (varsayılan 10 ≈ 20 saniye). */
  attempts?: number;
  delayMs?: number;
  /** Testlerde beklemeyi atlamak için. */
  sleep?: (ms: number) => Promise<void>;
}

export interface PurchaseWaitResult {
  outcome: PurchaseWaitOutcome;
  balance: number;
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function waitForCredits({
  readBalance,
  previous,
  attempts = 10,
  delayMs = 2000,
  sleep = realSleep,
}: WaitForCreditsOptions): Promise<PurchaseWaitResult> {
  let balance = previous;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      balance = await readBalance();
    } catch {
      // Ağ hatası beklemeyi bitirmez; bir sonraki turda tekrar dener.
    }
    if (balance > previous) return { outcome: 'credited', balance };
    if (attempt < attempts - 1) await sleep(delayMs);
  }

  return { outcome: 'pending', balance };
}
