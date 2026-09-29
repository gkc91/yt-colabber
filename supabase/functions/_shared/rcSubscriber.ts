// RevenueCat "subscriber" nesnesinin okunması (0043).
//
// NEDEN (2026-09-29): webhook tek yönlü ve kaybolabilir. Kaybolursa kullanıcı parasını
// ödemiş olmasına rağmen Pro açılmaz; ya da tersi, `EXPIRATION` kaybolursa Pro SONSUZA
// KADAR açık kalır — ikincisi doğrudan para kaybıdır. Bu yüzden sunucu, RevenueCat'e
// "bu kullanıcının gerçek durumu ne?" diye soruyor ve cevabı yetkili kabul ediyor.
//
// İSTEMCİ BU CEVABI ÜRETEMEZ. Uygulama yalnızca "beni senkronize et" diyebilir; durumu
// RevenueCat'ten SUNUCU çeker (CLAUDE.md kırmızı çizgi: doğrulama sunucuda). Telefonun
// "ben Pro'yum" demesi hiçbir şey ifade etmez.
//
// Ayrıştırma savunmacı: gelen JSON'un şekli hakkında varsayım yapılmıyor, çünkü beklenmeyen
// bir şekil sessizce "Pro değil" (ya da daha kötüsü "Pro") anlamına gelmemeli.

export interface ProState {
  active: boolean;
  /** ISO tarih; süresiz hak için null. */
  expiresAt: string | null;
}

/** `pro` hakkının RevenueCat'teki anahtarı. products.ts'teki ENTITLEMENT_PRO ile aynı olmalı. */
export const ENTITLEMENT_PRO = "pro";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Pro hakkı şu an geçerli mi.
 *
 * `expires_date` null ise süresiz haktır (bizde böyle bir ürün yok ama RevenueCat'in
 * modeli buna izin veriyor; null'u "süresi geçmiş" saymak sessizce hakkı kapatırdı).
 * Ayrıştırılamayan bir tarih AÇIK DEĞİL sayılır: emin olmadığımızda hak vermeyiz.
 */
export function proStateFrom(payload: unknown, nowMs: number = Date.now()): ProState {
  if (!isRecord(payload)) return { active: false, expiresAt: null };
  const subscriber = isRecord(payload.subscriber) ? payload.subscriber : payload;
  const entitlements = isRecord(subscriber.entitlements) ? subscriber.entitlements : null;
  if (!entitlements) return { active: false, expiresAt: null };

  const pro = entitlements[ENTITLEMENT_PRO];
  if (!isRecord(pro)) return { active: false, expiresAt: null };

  const raw = pro.expires_date;
  if (raw === null || raw === undefined) return { active: true, expiresAt: null };
  if (typeof raw !== "string") return { active: false, expiresAt: null };

  const expiresMs = Date.parse(raw);
  if (!Number.isFinite(expiresMs)) return { active: false, expiresAt: null };

  return { active: expiresMs > nowMs, expiresAt: new Date(expiresMs).toISOString() };
}

export interface NonSubscriptionPurchase {
  productId: string;
  /** RevenueCat'in işlem kimliği; webhook'un `transaction_id` alanıyla aynı değeri taşır. */
  transactionId: string;
}

/**
 * Tek seferlik (tüketilebilir) satın almalar.
 *
 * Kredi VERMEK için değil, ELDEKİYLE KARŞILAŞTIRMAK için okunuyor — bkz. sync-entitlements
 * içindeki uzun not. RevenueCat'in işlem kimliğiyle webhook'un `transaction_id` alanının
 * aynı değeri taşıdığı gerçek bir satın almayla doğrulanana kadar buradan kredi basılmıyor.
 */
export function nonSubscriptionsFrom(payload: unknown): NonSubscriptionPurchase[] {
  if (!isRecord(payload)) return [];
  const subscriber = isRecord(payload.subscriber) ? payload.subscriber : payload;
  const groups = subscriber.non_subscriptions;
  if (!isRecord(groups)) return [];

  const out: NonSubscriptionPurchase[] = [];
  for (const [productId, entries] of Object.entries(groups)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!isRecord(entry)) continue;
      const id = entry.id;
      if (typeof id === "string" && id.length > 0) out.push({ productId, transactionId: id });
    }
  }
  return out;
}
