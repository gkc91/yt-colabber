// Satın alma hatasının ekranda hangi metne dönüşeceği. Saf: birim testleri buradadır.
// `purchaseApi` mağaza SDK'sını içeri aldığı için bu eşleme ayrı dosyada durur.
import { PurchaseError } from '@/lib/purchases.types';

/** Kullanıcıya gösterilecek hata anahtarı; iptal sessizdir (hata değildir). */
export function purchaseErrorKey(error: unknown): string | null {
  if (error instanceof PurchaseError) {
    if (error.code === 'cancelled') return null;
    return error.code;
  }
  return 'store_error';
}
