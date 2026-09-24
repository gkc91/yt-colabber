// Ürün kataloğu (PRODUCT §15). Saf mantık: birim testleri buradadır.
//
// Krediyi SUNUCU verir (revenuecat-webhook → grant_purchase). Buradaki sayılar yalnızca
// paywall'da "ne alıyorum" yazabilmek için; istemci hiçbir zaman bakiye hesaplamaz
// (CLAUDE.md kırmızı çizgi). İki taraf ayrışırsa doğru olan sunucudur.

export const ENTITLEMENT_PRO = 'pro';

export const CREDIT_PRODUCTS = {
  credits_10: 10,
  credits_30: 30,
  credits_100: 100,
} as const;

export const PRO_PRODUCTS = ['pro_monthly', 'pro_yearly'] as const;

/** Pro aboneliğinin aylık kredi hediyesi (PRODUCT §8). Sunucu da aynı sayıyı yazar. */
export const PRO_MONTHLY_CREDITS = 40;

export type ProductKind = 'credits' | 'pro' | 'unknown';

export function creditsFor(productId: string): number {
  return CREDIT_PRODUCTS[productId as keyof typeof CREDIT_PRODUCTS] ?? 0;
}

export function isProProduct(productId: string): boolean {
  return productId.startsWith('pro_');
}

export function kindOf(productId: string): ProductKind {
  if (creditsFor(productId) > 0) return 'credits';
  if (isProProduct(productId)) return 'pro';
  return 'unknown';
}

/** RevenueCat paketinden ihtiyacımız olan alanlar — RN tipini testlere sokmamak için. */
export interface PackageLike {
  identifier: string;
  product: {
    identifier: string;
    priceString: string;
    price: number;
  };
}

export interface PurchaseOption {
  /** RevenueCat paket kimliği; satın alırken geri veririz. */
  packageId: string;
  productId: string;
  kind: ProductKind;
  /** Kredi paketiyse kaç kredi; Pro ise aylık hediye kredi. */
  credits: number;
  /** Mağazanın yerel para birimiyle biçimlendirdiği fiyat. */
  priceString: string;
  price: number;
}

/**
 * Teklifleri ekrana uygun sıraya sokar: önce kredi paketleri (ucuzdan pahalıya),
 * sonra Pro. Tanımadığımız ürün gösterilmez — yanlışlıkla eklenen bir mağaza ürünü
 * paywall'da "0 kredi" olarak görünmesin.
 */
export function toPurchaseOptions(packages: PackageLike[]): PurchaseOption[] {
  return packages
    .map((item) => {
      const productId = item.product.identifier;
      const kind = kindOf(productId);
      return {
        packageId: item.identifier,
        productId,
        kind,
        credits: kind === 'pro' ? PRO_MONTHLY_CREDITS : creditsFor(productId),
        priceString: item.product.priceString,
        price: item.product.price,
      };
    })
    .filter((option) => option.kind !== 'unknown')
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'credits' ? -1 : 1;
      return a.price - b.price;
    });
}
