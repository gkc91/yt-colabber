// RevenueCat webhook → grant_purchase(). Idempotent: event.id
import { admin, json } from "../_shared/supabase.ts";

const CREDITS: Record<string, number> = { credits_10: 10, credits_30: 30, credits_100: 100 };

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method", { status: 405 });
  const secret = Deno.env.get("RC_WEBHOOK_SECRET");
  if (req.headers.get("Authorization") !== `Bearer ${secret}`) return new Response("forbidden", { status: 403 });

  const { event } = await req.json();
  const profileId = event.app_user_id as string; // RevenueCat appUserID = Supabase user id
  const product = event.product_id as string;
  const type = event.type as string;

  let credits = 0;
  let proActive: boolean | null = null;
  let proExpires: string | null = null;

  if (product in CREDITS && ["NON_RENEWING_PURCHASE", "INITIAL_PURCHASE"].includes(type)) credits = CREDITS[product];
  if (product.startsWith("pro_")) {
    if (["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE"].includes(type)) {
      proActive = true;
      proExpires = event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null;
    } else if (["EXPIRATION", "BILLING_ISSUE"].includes(type)) {
      proActive = false;
      proExpires = new Date().toISOString();
    }
  }

  const { error } = await admin().rpc("grant_purchase", {
    p_profile: profileId, p_rc_event_id: event.id, p_product: product, p_credits: credits,
    p_raw: event, p_pro_active: proActive, p_pro_expires: proExpires,
  });
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
});
