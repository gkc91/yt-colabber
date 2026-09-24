// Web'de satın alma yoktur (PRODUCT §14): paywall "uygulamada aç" ekranı gösterir.
// Bu dosya olmasaydı react-native-purchases web paketine girip derlemeyi kırardı.
import { PurchaseError, type PurchasesAdapter } from './purchases.types';

const unsupported = async (): Promise<never> => {
  throw new PurchaseError('web_unsupported');
};

export const purchases: PurchasesAdapter = {
  configure: async () => {},
  listOptions: unsupported,
  purchase: unsupported,
  restore: unsupported,
  isProActive: async () => false,
  signOut: async () => {},
};
