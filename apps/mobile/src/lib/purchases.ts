// RevenueCat sarmalayıcısı (D1). Krediyi burada VERMİYORUZ: satın alma mağazada biter,
// RevenueCat webhook'u `grant_purchase` çağırır, bakiye sunucudan okunur (CLAUDE.md).
// Bu dosya yalnızca mağaza akışını yürütür ve Pro hakkını okur.
import { Platform } from 'react-native';
import Purchases, { PURCHASES_ERROR_CODE } from 'react-native-purchases';

import { ENTITLEMENT_PRO, toPurchaseOptions } from '@/features/credits/products';
import { env } from '@/lib/env';

import { PurchaseError, type PurchaseResult, type PurchasesAdapter } from './purchases.types';

const apiKey = Platform.select({
  ios: env.EXPO_PUBLIC_RC_IOS_KEY,
  android: env.EXPO_PUBLIC_RC_ANDROID_KEY,
  default: undefined,
});

let configuredFor: string | null = null;

function requireKey(): string {
  if (!apiKey) throw new PurchaseError('not_configured');
  return apiKey;
}

/** react-native-purchases hatalarını kendi kodlarımıza çevirir. */
function toPurchaseError(error: unknown): PurchaseError {
  const code = (error as { code?: string } | null)?.code;
  if (code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return new PurchaseError('cancelled');
  return new PurchaseError('store_error');
}

const proFrom = (customerInfo: { entitlements: { active: Record<string, unknown> } }): boolean =>
  customerInfo.entitlements.active[ENTITLEMENT_PRO] !== undefined;

export const purchases: PurchasesAdapter = {
  async configure(userId) {
    const key = requireKey();
    if (configuredFor === userId) return;
    Purchases.configure({ apiKey: key, appUserID: userId });
    configuredFor = userId;
  },

  async listOptions() {
    requireKey();
    try {
      const offerings = await Purchases.getOfferings();
      const packages = offerings.current?.availablePackages ?? [];
      return toPurchaseOptions(packages);
    } catch (error) {
      throw toPurchaseError(error);
    }
  },

  async purchase(packageId) {
    requireKey();
    try {
      const offerings = await Purchases.getOfferings();
      const target = offerings.current?.availablePackages.find(
        (item) => item.identifier === packageId,
      );
      if (!target) throw new PurchaseError('store_error');

      const { customerInfo } = await Purchases.purchasePackage(target);
      return { proActive: proFrom(customerInfo) } satisfies PurchaseResult;
    } catch (error) {
      if (error instanceof PurchaseError) throw error;
      throw toPurchaseError(error);
    }
  },

  async restore() {
    requireKey();
    try {
      const customerInfo = await Purchases.restorePurchases();
      return { proActive: proFrom(customerInfo) } satisfies PurchaseResult;
    } catch (error) {
      throw toPurchaseError(error);
    }
  },

  async isProActive() {
    if (!apiKey) return false;
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      return proFrom(customerInfo);
    } catch {
      return false;
    }
  },

  async signOut() {
    if (!apiKey || configuredFor === null) return;
    configuredFor = null;
    try {
      await Purchases.logOut();
    } catch {
      // Çıkışı satın alma katmanı yüzünden engellemeyiz.
    }
  },
};
