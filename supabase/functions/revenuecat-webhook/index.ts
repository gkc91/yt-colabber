// RevenueCat webhook → grant_purchase(). Idempotent: aynı event.id iki kez işlenmez.
//
// Güvenlik: RC_WEBHOOK_SECRET yoksa fonksiyon hiçbir isteği kabul etmez. (Eskiden sır
// tanımsızken "Bearer undefined" başlığı geçiyordu — fail-open bir açıktı.)
//
// Yanıt sözleşmesi: RevenueCat 2xx almazsa aynı olayı tekrar tekrar gönderir. Bu yüzden
// "bizi ilgilendirmeyen" olaylara (TRANSFER, TEST, anonim kullanıcı, tanımadığımız ürün)
// 200 + {ignored} döneriz; yalnızca gerçek hatalarda 5xx döneriz ki tekrar denesin.
import { admin, json } from "../_shared/supabase.ts";

/** Ürün → kredi. Sunucu tarafı yetkilidir; istemcideki katalog yalnızca gösterim içindir. */
const CREDITS: Record<string, number> = {
  credits_10: 10,
  credits_30: 30,
  credits_100: 100,
};

const CREDIT_EVENTS = ["NON_RENEWING_PURCHASE", "INITIAL_PURCHASE"];
/** Pro'yu açan olaylar. CANCELLATION burada YOK: iptal, dönem sonuna kadar erişimi bitirmez. */
const PRO_ACTIVATE = ["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE"];
const PRO_DEACTIVATE = ["EXPIRATION", "BILLING_ISSUE"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RcEvent = {
  id?: unknown;
  type?: unknown;
  app_user_id?: unknown;
  product_id?: unknown;
  expiration_at_ms?: unknown;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method", { status: 405 });

  const secret = Deno.env.get("RC_WEBHOOK_SECRET");
  if (!secret) return json({ error: "webhook_secret_missing" }, 500);
  if (req.headers.get("Authorization") !== `Bearer ${secret}`) {
    return new Response("forbidden", { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const event = (body?.event ?? null) as RcEvent | null;
  if (!event || typeof event.id !== "string" || typeof event.type !== "string") {
    return json({ error: "bad_event" }, 400);
  }

  const type = event.type;
  const profileId = typeof event.app_user_id === "string" ? event.app_user_id : "";
  const product = typeof event.product_id === "string" ? event.product_id : "";

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
    return json({ ok: true, ignored: `no_effect:${type}` });
  }

  const { error } = await admin().rpc("grant_purchase", {
    p_profile: profileId,
    p_rc_event_id: event.id,
    p_product: product,
    p_credits: credits,
    p_raw: event,
    p_pro_active: proActive,
    p_pro_expires: proExpires,
  });
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, credits, pro: proActive });
});
