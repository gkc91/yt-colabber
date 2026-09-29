// rcSubscriber.test.ts — RevenueCat subscriber ayrıştırması (0043).
//   deno test supabase/functions/_shared/rcSubscriber.test.ts
//
// Bu dosyanın var olma sebebi: bu ayrıştırma Pro hakkını AÇIP KAPATIYOR. Yanlış "açık"
// bedava abonelik dağıtır, yanlış "kapalı" ödeme yapmış kullanıcının hakkını elinden alır.
// İkisi de sessiz hatalardır — kullanıcı şikâyet edene kadar görünmezler.
import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";

import { nonSubscriptionsFrom, proStateFrom } from "./rcSubscriber.ts";

const NOW = Date.parse("2026-09-29T12:00:00Z");

const withPro = (expires: unknown) => ({
  subscriber: { entitlements: { pro: { expires_date: expires } } },
});

Deno.test("test_pro_is_active_while_the_entitlement_has_not_expired", () => {
  const state = proStateFrom(withPro("2026-10-29T12:00:00Z"), NOW);
  assert(state.active);
  assertEquals(state.expiresAt, "2026-10-29T12:00:00.000Z");
});

Deno.test("test_pro_is_inactive_once_the_entitlement_expired", () => {
  // Asıl mesele bu: `EXPIRATION` webhook'u kaybolursa Pro sonsuza kadar açık kalırdı.
  const state = proStateFrom(withPro("2026-09-29T11:59:59Z"), NOW);
  assertFalse(state.active);
  assertEquals(state.expiresAt, "2026-09-29T11:59:59.000Z");
});

Deno.test("test_missing_entitlement_is_not_pro", () => {
  assertFalse(proStateFrom({ subscriber: { entitlements: {} } }, NOW).active);
  assertFalse(proStateFrom({ subscriber: {} }, NOW).active);
  assertFalse(proStateFrom({}, NOW).active);
  assertFalse(proStateFrom(null, NOW).active);
});

Deno.test("test_a_null_expiry_means_a_lifetime_entitlement", () => {
  // Null'u "süresi geçmiş" saymak, süresiz hakkı sessizce kapatırdı.
  const state = proStateFrom(withPro(null), NOW);
  assert(state.active);
  assertEquals(state.expiresAt, null);
});

Deno.test("test_an_unreadable_expiry_never_grants_access", () => {
  // Emin olmadığımızda hak VERMİYORUZ. Tersi, bozuk bir alanın bedava Pro dağıtması olurdu.
  for (const bad of ["", "yarın", 1790000000, {}, []]) {
    assertFalse(proStateFrom(withPro(bad), NOW).active, `kabul edildi: ${JSON.stringify(bad)}`);
  }
});

Deno.test("test_subscriber_can_be_passed_wrapped_or_bare", () => {
  const bare = { entitlements: { pro: { expires_date: "2026-10-29T12:00:00Z" } } };
  assert(proStateFrom(bare, NOW).active);
});

Deno.test("test_non_subscriptions_are_flattened_with_their_product", () => {
  const payload = {
    subscriber: {
      non_subscriptions: {
        credits_10: [{ id: "tx1" }, { id: "tx2" }],
        credits_50: [{ id: "tx3" }],
      },
    },
  };
  assertEquals(nonSubscriptionsFrom(payload), [
    { productId: "credits_10", transactionId: "tx1" },
    { productId: "credits_10", transactionId: "tx2" },
    { productId: "credits_50", transactionId: "tx3" },
  ]);
});

Deno.test("test_non_subscriptions_tolerate_junk", () => {
  assertEquals(nonSubscriptionsFrom({ subscriber: { non_subscriptions: null } }), []);
  assertEquals(nonSubscriptionsFrom({ subscriber: { non_subscriptions: { a: "no" } } }), []);
  assertEquals(nonSubscriptionsFrom({ subscriber: { non_subscriptions: { a: [{}, { id: 7 }] } } }), []);
  assertEquals(nonSubscriptionsFrom(undefined), []);
});
