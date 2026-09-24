// Satın alma katmanının platformdan bağımsız arayüzü.
// Web'de satın alma YOKTUR (PRODUCT §14) — purchases.web.ts hepsini `unsupported` ile reddeder.

import type { PurchaseOption } from '@/features/credits/products';

export type { PurchaseOption };

export type PurchaseErrorCode =
  /** Web'de satın alma yok; "uygulamada aç" gösterilir. */
  | 'web_unsupported'
  /** RevenueCat anahtarı tanımlı değil (geliştirme derlemesi / yapılandırma eksik). */
  | 'not_configured'
  /** Kullanıcı mağaza ekranını kapattı — hata değil, sessizce yutulur. */
  | 'cancelled'
  | 'store_error';

export class PurchaseError extends Error {
  constructor(readonly code: PurchaseErrorCode) {
    super(code);
    this.name = 'PurchaseError';
  }
}

export interface PurchaseResult {
  /** Satın alma sonrası Pro hakkı açık mı. Kredi bakiyesi sunucudan okunur. */
  proActive: boolean;
}

export interface PurchasesAdapter {
  /** Giriş yapan kullanıcı için SDK'yı hazırlar. appUserID = Supabase kullanıcı kimliği. */
  configure(userId: string): Promise<void>;
  /** Mağazadan güncel paketler; tanımadığımız ürünler elenir. */
  listOptions(): Promise<PurchaseOption[]>;
  purchase(packageId: string): Promise<PurchaseResult>;
  restore(): Promise<PurchaseResult>;
  isProActive(): Promise<boolean>;
  /** Çıkışta çağrılır: cihazdaki kimlik bir sonraki kullanıcıya sızmasın. */
  signOut(): Promise<void>;
}
