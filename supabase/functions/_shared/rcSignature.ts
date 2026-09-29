// RevenueCat webhook imzası. Ayrı modül çünkü npm bağımlılığı yok ve `deno test` ile
// doğrudan sınanabiliyor — imza doğrulaması, yanlış yazıldığında SESSİZCE her şeyi kabul
// eden türden bir koddur, testsiz bırakılamaz.
//
// Başlık biçimi: `X-RevenueCat-Webhook-Signature: t=<unix>,v1=<hmac_sha256_hex>`
// HMAC `"<t>.<ham gövde>"` üzerinden hesaplanıyor.

/** İmzanın kabul edildiği en büyük yaş. Eskisi tekrar (replay) saldırısıdır. */
export const SIGNATURE_MAX_AGE_SECONDS = 300;

/** Uzunluk ve içerik farkını aynı sürede bildirir: karşılaştırma zamanı sır sızdırmasın. */
export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** `t=...,v1=...` ayrıştırması. Beklenmeyen biçimde null döner, tahmin etmez. */
export function parseSignatureHeader(header: string): { t: string; v1: string } | null {
  const parts: Record<string, string> = {};
  for (const piece of header.split(",")) {
    const [key, ...rest] = piece.trim().split("=");
    if (key && rest.length > 0) parts[key] = rest.join("=");
  }
  if (typeof parts.t !== "string" || typeof parts.v1 !== "string") return null;
  return { t: parts.t, v1: parts.v1 };
}

export async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(mac)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * İmza geçerli mi.
 *
 * `nowSeconds` dışarıdan veriliyor ki yaş kontrolü test edilebilsin — sabit bir saate
 * bağlı kod, tekrar saldırısına karşı korumanın çalıştığını kanıtlayamaz.
 */
export async function signatureIsValid(
  header: string,
  rawBody: string,
  secret: string,
  nowSeconds: number = Date.now() / 1000,
): Promise<boolean> {
  const parsed = parseSignatureHeader(header);
  if (!parsed) return false;

  const timestamp = Number(parsed.t);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(nowSeconds - timestamp) > SIGNATURE_MAX_AGE_SECONDS) return false;

  const expected = await hmacHex(secret, `${parsed.t}.${rawBody}`);
  return constantTimeEquals(expected, parsed.v1.toLowerCase());
}
