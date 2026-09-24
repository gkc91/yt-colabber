// RevenueCat webhook'unun uçtan uca kontrolü (D1). Yerel stack + funcs gerekir:
//   pnpm exec supabase functions serve --env-file supabase/functions/local-test.vars
//   node scripts/check-purchases.mjs
// Sorular: yanlış anahtarla geçilebiliyor mu, aynı olay iki kez kredi yazıyor mu,
// Pro açılıp kapanıyor mu, bizi ilgilendirmeyen olaylar RevenueCat'i döngüye sokuyor mu.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

const nodeRequire = createRequire(import.meta.url);
const { createClient } = nodeRequire(
  nodeRequire.resolve('@supabase/supabase-js', { paths: ['apps/mobile'] }),
);

const env = Object.fromEntries(
  execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'env'], {
    encoding: 'utf8',
    shell: true,
  })
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2]]),
);

const API = env.API_URL;
const SECRET = process.env.RC_WEBHOOK_SECRET ?? 'local-test-secret';
const admin = createClient(API, env.SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const post = (event, { secret = SECRET } = {}) =>
  fetch(`${API}/functions/v1/revenuecat-webhook`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
    body: JSON.stringify({ event }),
  });

const balanceOf = async (id) => {
  const { data } = await admin.from('credit_ledger').select('delta').eq('profile_id', id);
  return (data ?? []).reduce((total, row) => total + row.delta, 0);
};

// ---------- arrange: tek kullanımlık alıcı ----------
const email = `buyer-${Date.now()}@clickable.test`;
const { data: created, error: createError } = await admin.auth.admin.createUser({
  email,
  password: 'password123',
  email_confirm: true,
});
if (createError) throw createError;
const buyer = created.user.id;
const startBalance = await balanceOf(buyer);

// ---------- yanlış anahtar ----------
const forbidden = await post(
  {
    id: `evt-${randomUUID()}`,
    type: 'NON_RENEWING_PURCHASE',
    app_user_id: buyer,
    product_id: 'credits_10',
  },
  { secret: 'wrong-secret' },
);
check('yanlış anahtar reddedilir', forbidden.status === 403, `HTTP ${forbidden.status}`);
check('yanlış anahtarla kredi yazılmaz', (await balanceOf(buyer)) === startBalance);

// ---------- kredi paketi ----------
const creditEvent = {
  id: `evt-${randomUUID()}`,
  type: 'NON_RENEWING_PURCHASE',
  app_user_id: buyer,
  product_id: 'credits_30',
};
const first = await post(creditEvent);
check('kredi paketi işlenir', first.ok, `HTTP ${first.status}`);
check('30 kredi yazıldı', (await balanceOf(buyer)) === startBalance + 30);

// aynı olay tekrar: RevenueCat 2xx alamazsa tekrar gönderir
const retry = await post(creditEvent);
check('tekrar gönderim 2xx döner', retry.ok, `HTTP ${retry.status}`);
check('tekrar gönderim ikinci kez kredi yazmaz', (await balanceOf(buyer)) === startBalance + 30);

// ---------- Pro ----------
const proEvent = {
  id: `evt-${randomUUID()}`,
  type: 'INITIAL_PURCHASE',
  app_user_id: buyer,
  product_id: 'pro_monthly',
  expiration_at_ms: Date.now() + 30 * 24 * 60 * 60 * 1000,
};
const pro = await post(proEvent);
check('Pro satın alma işlenir', pro.ok, `HTTP ${pro.status}`);

const { data: isPro } = await admin.rpc('is_pro', { p: buyer });
check('Pro hakkı açıldı', isPro === true, String(isPro));
check('Pro 40 kredi getirdi', (await balanceOf(buyer)) === startBalance + 70);

// iptal: dönem sonuna kadar Pro açık kalmalı
const cancel = await post({
  id: `evt-${randomUUID()}`,
  type: 'CANCELLATION',
  app_user_id: buyer,
  product_id: 'pro_monthly',
});
const { data: stillPro } = await admin.rpc('is_pro', { p: buyer });
check('iptal olayı 2xx döner', cancel.ok, `HTTP ${cancel.status}`);
check('iptal Pro hakkını hemen kapatmaz', stillPro === true, String(stillPro));

// süre dolumu
await post({
  id: `evt-${randomUUID()}`,
  type: 'EXPIRATION',
  app_user_id: buyer,
  product_id: 'pro_monthly',
});
const { data: expiredPro } = await admin.rpc('is_pro', { p: buyer });
check('süre dolunca Pro kapanır', expiredPro === false, String(expiredPro));

// ---------- bizi ilgilendirmeyen olaylar ----------
const anonymous = await post({
  id: `evt-${randomUUID()}`,
  type: 'INITIAL_PURCHASE',
  app_user_id: '$RCAnonymousID:abc123',
  product_id: 'credits_10',
});
check('anonim kullanıcı 2xx ile yutulur', anonymous.ok, `HTTP ${anonymous.status}`);

const unknownProduct = await post({
  id: `evt-${randomUUID()}`,
  type: 'NON_RENEWING_PURCHASE',
  app_user_id: buyer,
  product_id: 'mystery_pack',
});
check('tanımadığımız ürün 2xx ile yutulur', unknownProduct.ok, `HTTP ${unknownProduct.status}`);
check('tanımadığımız ürün kredi yazmaz', (await balanceOf(buyer)) === startBalance + 70);

const malformed = await fetch(`${API}/functions/v1/revenuecat-webhook`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${SECRET}`, 'content-type': 'application/json' },
  body: '{"nope":true}',
});
check('bozuk gövde 400 döner', malformed.status === 400, `HTTP ${malformed.status}`);

// ---------- temizlik ----------
await admin.auth.admin.deleteUser(buyer);

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed === 0 ? 0 : 1);
