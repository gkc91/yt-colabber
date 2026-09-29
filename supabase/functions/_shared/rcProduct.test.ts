// rcProduct.test.ts — RevenueCat ürün kimliği indirgeme (0044).
//   deno test supabase/functions/_shared/rcProduct.test.ts
import { assertEquals } from "jsr:@std/assert@1";

import { baseProductId } from "./rcProduct.ts";

Deno.test("test_product_id_keeps_a_plain_identifier", () => {
  assertEquals(baseProductId("credits_10"), "credits_10");
  assertEquals(baseProductId("pro_monthly"), "pro_monthly");
});

Deno.test("test_product_id_drops_the_purchase_option_suffix", () => {
  // Play'in yeni modelinde satın alma seçeneği kimliği eklenebiliyor. Eşleme birebir
  // kalsaydı kullanıcı öder, kredi almaz ve webhook 200 döndüğü için kimse fark etmezdi.
  assertEquals(baseProductId("credits_10:buy"), "credits_10");
  assertEquals(baseProductId("credits_100:buy"), "credits_100");
});

Deno.test("test_product_id_drops_the_base_plan_suffix", () => {
  // Aboneliklerde ayraçtan sonra temel plan geliyor.
  assertEquals(baseProductId("pro_monthly:monthly"), "pro_monthly");
  assertEquals(baseProductId("pro_yearly:annual"), "pro_yearly");
});

Deno.test("test_product_id_survives_an_empty_or_odd_value", () => {
  assertEquals(baseProductId(""), "");
  assertEquals(baseProductId(":buy"), "");
  assertEquals(baseProductId("a:b:c"), "a");
});
