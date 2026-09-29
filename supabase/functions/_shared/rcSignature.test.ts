// rcSignature.test.ts — RevenueCat webhook imzası (0043).
//   deno test supabase/functions/_shared/rcSignature.test.ts
//
// Bu dosyanın var olma sebebi: yanlış yazılmış bir imza doğrulaması, reddetmesi gereken
// her şeyi SESSİZCE kabul eder. Hatası görünmez, bu yüzden her reddetme yolu ayrı
// sınanıyor — bozuk gövde, yanlış sır, eski zaman damgası, bozuk başlık.
import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";

import { constantTimeEquals, hmacHex, parseSignatureHeader, signatureIsValid } from "./rcSignature.ts";

const SECRET = "whsec_test_signing_secret";
const BODY = '{"event":{"id":"evt_1","type":"INITIAL_PURCHASE"}}';
const NOW = 1_790_000_000;

const sign = async (body = BODY, secret = SECRET, t = NOW) =>
  `t=${t},v1=${await hmacHex(secret, `${t}.${body}`)}`;

Deno.test("test_signature_accepts_what_revenuecat_would_send", async () => {
  assert(await signatureIsValid(await sign(), BODY, SECRET, NOW));
});

Deno.test("test_signature_rejects_a_tampered_body", async () => {
  // Asıl mesele bu: imza gövdeyi kapsamazsa saldırgan tutarı veya kullanıcıyı değiştirir.
  const header = await sign();
  const tampered = BODY.replace("INITIAL_PURCHASE", "RENEWAL");
  assertFalse(await signatureIsValid(header, tampered, SECRET, NOW));
});

Deno.test("test_signature_rejects_a_foreign_secret", async () => {
  const header = await sign(BODY, "whsec_someone_elses_secret");
  assertFalse(await signatureIsValid(header, BODY, SECRET, NOW));
});

Deno.test("test_signature_rejects_a_replayed_request", async () => {
  // Bearer jetonunun kapatamadığı şey tam olarak buydu: adres ve jeton sızarsa aynı olay
  // istenildiği kadar yeniden gönderilebiliyordu. Zaman damgası onu kapatıyor.
  const header = await sign(BODY, SECRET, NOW - 301);
  assertFalse(await signatureIsValid(header, BODY, SECRET, NOW));
  // Sınırın içindeki aynı istek hâlâ kabul edilmeli; koruma dürüst trafiği kesmemeli.
  assert(await signatureIsValid(await sign(BODY, SECRET, NOW - 299), BODY, SECRET, NOW));
});

Deno.test("test_signature_rejects_a_future_timestamp", async () => {
  // Saat kayması sınırın içindeyse kabul, dışındaysa değil — tek yönlü kontrol,
  // ileri tarihli bir damgayı sonsuza kadar geçerli kılardı.
  assertFalse(await signatureIsValid(await sign(BODY, SECRET, NOW + 600), BODY, SECRET, NOW));
});

Deno.test("test_signature_rejects_malformed_headers", async () => {
  for (const header of ["", "v1=abc", "t=notanumber,v1=abc", "garbage", "t=,v1="]) {
    assertFalse(
      await signatureIsValid(header, BODY, SECRET, NOW),
      `bozuk başlık kabul edildi: ${header}`,
    );
  }
});

Deno.test("test_header_parsing_keeps_base64_padding", async () => {
  // `split('=')` naif yazılırsa base64 dolgusu kırpılır ve imza asla tutmaz.
  assertEquals(parseSignatureHeader("t=1,v1=ab==")?.v1, "ab==");
});

Deno.test("test_constant_time_compare_is_still_correct", () => {
  assert(constantTimeEquals("abc", "abc"));
  assertFalse(constantTimeEquals("abc", "abd"));
  assertFalse(constantTimeEquals("abc", "abcd"));
});
