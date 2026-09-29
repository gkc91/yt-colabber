// RevenueCat webhook → grant_purchase(). Idempotent: aynı event.id iki kez işlenmez.
//
// Güvenlik iki katman: RC_WEBHOOK_SECRET yoksa fonksiyon hiçbir isteği kabul etmez
// (eskiden sır tanımsızken "Bearer undefined" başlığı geçiyordu — fail-open bir açıktı),
// ve RC_WEBHOOK_SIGNING_SECRET tanımlıysa gövde imzası da doğrulanır.
//
// İMZA NEDEN GEREKLİ (2026-09-29): tek başına bearer jetonu TEKRAR saldırısına açık —
// adres ve jeton bir kez sızarsa aynı olay istenildiği kadar yeniden gönderilebilir.
// RevenueCat'in imzası zaman damgası içeriyor ve gövdeyi kapsıyor, yani hem tekrarı hem
// oynamayı kapatıyor. İmza sırrı RevenueCat panelinden açılıyor; tanımlı değilse
// doğrulama atlanıyor ve BU DURUM SATIRDA YAZILI kalıyor (aşağıdaki `signature` alanı),
// çünkü sessizce atlanan bir güvenlik kontrolü hiç olmamasından kötüdür.
//
// Yanıt sözleşmesi: RevenueCat 2xx almazsa aynı olayı tekrar tekrar gönderir. Bu yüzden
// "bizi ilgilendirmeyen" olaylara (TRANSFER, TEST, anonim kullanıcı, tanımadığımız ürün)
// 200 + {ignored} döneriz; yalnızca gerçek hatalarda 5xx döneriz ki tekrar denesin.
import { admin, json } from "../_shared/supabase.ts";
import { signatureIsValid } from "../_shared/rcSignature.ts";
import { baseProductId } from "../_shared/rcProduct.ts";

/** Ürün → kredi. Sunucu tarafı yetkilidir; istemcideki katalog yalnızca gösterim içindir. */
const CREDITS: Record<string, number> = {
  credits_10: 10,
  credits_50: 50,
  credits_100: 100,
};

const CREDIT_EVENTS = ["NON_RENEWING_PURCHASE", "INITIAL_PURCHASE"];
/** Pro'yu açan olaylar. CANCELLATION burada YOK: iptal, dönem sonuna kadar erişimi bitirmez. */
const PRO_ACTIVATE = ["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE"];
const PRO_DEACTIVATE = ["EXPIRATION", "BILLING_ISSUE"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * RevenueCat olayının bize lazım olan alanları.
 *
 * Bu tip KULLANILIYOR ama hiçbir yerde tanımlı DEĞİLDİ (2026-09-29 bulgusu): Deno deploy
 * tip denetimi yapmadığı için çalışma zamanında görünmüyordu, ama `deno check` kırıktı ve
 * alan adlarını yanlış yazmak sessizce `undefined` veriyordu. Olayın tamamı `raw` olarak
 * saklandığı için burada yalnızca okuduğumuz alanlar duruyor.
 */
interface RcEvent {
  id: string;
  type: string;
  app_user_id?: unknown;
  product_id?: unknown;
  expiration_at_ms?: unknown;
  /** RevenueCat'in işlem kimliği; API'deki non_subscriptions `id` ile aynı değer olmalı. */
  transaction_id?: unknown;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method", { status: 405 });

  const secret = Deno.env.get("RC_WEBHOOK_SECRET");
  if (!secret) return json({ error: "webhook_secret_missing" }, 500);
  if (req.headers.get("Authorization") !== `Bearer ${secret}`) {
    return new Response("forbidden", { status: 403 });
  }

  // Ham gövde: imza bunun üzerinden hesaplanıyor, `req.json()` ile okunan ve yeniden
  // serileştirilen bir nesne aynı baytları vermez.
  const rawBody = await req.text();

  // Yanıtta taşınıyor: imza doğrulaması atlanıyorsa bu RevenueCat panelinde ve cron
  // kaydında görünür olsun. Sessizce atlanan bir kontrol, hiç olmayandan kötüdür.
  const signingSecret = Deno.env.get("RC_WEBHOOK_SIGNING_SECRET");
  const signatureState = signingSecret ? "verified" : "not_configured";
  const signatureHeader = req.headers.get("X-RevenueCat-Webhook-Signature");
  if (signingSecret) {
    if (!signatureHeader) return json({ error: "signature_missing" }, 403);
    if (!(await signatureIsValid(signatureHeader, rawBody, signingSecret))) {
      return json({ error: "signature_invalid" }, 403);
    }
  }

  // Gövde artık elimizde metin olarak; `req.json()` gibi kendi kendine yutmuyor, bu yüzden
  // ayrıştırmayı biz sarmalıyoruz — bozuk gövde 500 değil 400 olmalı.
  let body: { event?: RcEvent } | null = null;
  try {
    body = JSON.parse(rawBody) as { event?: RcEvent };
  } catch {
    body = null;
  }
  const event = (body?.event ?? null) as RcEvent | null;
  if (!event || typeof event.id !== "string" || typeof event.type !== "string") {
    return json({ error: "bad_event" }, 400);
  }

  const type = event.type;
  const profileId = typeof event.app_user_id === "string" ? event.app_user_id : "";
  // Play, kimliğin sonuna satın alma seçeneğini / temel planı ekleyebiliyor; katalog
  // eşlemesi ondan önceki kısma bakıyor (bkz. rcProduct.ts).
  const product = baseProductId(typeof event.product_id === "string" ? event.product_id : "");

  // Anonim RC kimliği ($RCAnonymousID:...) veya kimliksiz olay: kullanıcıya bağlayamayız.
  if (!UUID.test(profileId)) return json({ ok: true, ignored: "no_app_user_id" });

  const credits = CREDITS[product] !== undefined && CREDIT_EVENTS.includes(type)
    ? CREDITS[product]
    : 0;

  let proActive: boolean | null = null;
  let proExpires: string | null = null;
  if (product.startsWith("pro_")) {
    if (PRO_ACTIVATE.includes(type)) {
      proActive = true;
      proExpires = typeof event.expiration_at_ms === "number"
        ? new Date(event.expiration_at_ms).toISOString()
        : null;
    } else if (PRO_DEACTIVATE.includes(type)) {
      proActive = false;
      proExpires = new Date().toISOString();
    }
  }

  // Ne kredi ne abonelik etkisi olan olay (TEST, TRANSFER, tanımadığımız ürün): kaydetmeye
  // değmez, ama RevenueCat'in tekrar denememesi için 200 döneriz.
  if (credits === 0 && proActive === null) {
    return json({ ok: true, ignored: `no_effect:${type}`, signature: signatureState });
  }

  const { error } = await admin().rpc("grant_purchase", {
    p_profile: profileId,
    p_rc_event_id: event.id,
    p_product: product,
    p_credits: credits,
    p_raw: event,
    p_pro_active: proActive,
    p_pro_expires: proExpires,
    // 0043: senkron yolunun aynı satın almayı ikinci kez kredilendirmemesi için ortak anahtar.
    p_rc_txn: typeof event.transaction_id === "string" ? event.transaction_id : null,
  });
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, credits, pro: proActive, signature: signatureState });
});
