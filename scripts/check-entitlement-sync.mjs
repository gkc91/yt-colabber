// `sync-entitlements` gerçekten çalışıyor mu (0043).
//   SUPABASE_URL=... SERVICE_ROLE_KEY=... ANON_KEY=... node scripts/check-entitlement-sync.mjs
//   node scripts/check-entitlement-sync.mjs        # yerel stack
//
// NEDEN AYRI SCRIPT: bu fonksiyonun tek işi RevenueCat'e SORMAK. Sırrı yanlışsa, anahtarı
// yoksa ya da adres değiştiyse sessizce "hak yok" diyebilirdi — ve "hak yok", ödeme
// yapmamış bir kullanıcı için de doğru cevap olduğu için hata GÖRÜNMEZ. Bu yüzden
// yanıttaki `known` alanına bakıyoruz: RevenueCat'e ulaşıldığını yalnızca o kanıtlıyor.
//
// Yetkisiz çağrının 401 alması da sınanıyor: fonksiyon kullanıcının KENDİ profilini
// senkronluyor; kimlik doğrulaması düşerse herkes herkesin hakkını tazeleyebilirdi.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const nodeRequire = createRequire(import.meta.url);
const { createClient } = nodeRequire(
  nodeRequire.resolve('@supabase/supabase-js', { paths: ['apps/mobile'] }),
);

const DEMO_EMAIL = process.env.DEMO_EMAIL ?? 'demo@clickable.app';

function localEnv() {
  const text = execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'env'], {
    encoding: 'utf8',
    shell: true,
  });
  const read = (key) => text.match(new RegExp(`^${key}="?(.*?)"?$`, 'm'))?.[1];
  return { url: read('API_URL'), service: read('SERVICE_ROLE_KEY'), anon: read('ANON_KEY') };
}

const env = process.env.SUPABASE_URL
  ? {
      url: process.env.SUPABASE_URL,
      service: process.env.SERVICE_ROLE_KEY,
      anon: process.env.ANON_KEY,
    }
  : localEnv();

if (!env.url || !env.service || !env.anon) {
  throw new Error('SUPABASE_URL / SERVICE_ROLE_KEY / ANON_KEY gerekli');
}

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'tamam ' : 'BAŞARISIZ'} — ${name}${detail ? ` (${detail})` : ''}`);
};

// ---------- 1. Yetkisiz çağrı reddediliyor mu ----------
const anonRes = await fetch(`${env.url}/functions/v1/sync-entitlements`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: '{}',
});
check('kimliksiz çağrı reddediliyor', anonRes.status === 401, `HTTP ${anonRes.status}`);

// ---------- 2. Gerçek bir oturumla çağrı ----------
// Sihirli bağlantı ÜRETİLİYOR ama gönderilmiyor: e-posta atmadan oturum açmanın yolu bu.
const admin = createClient(env.url, env.service, { auth: { persistSession: false } });
const { data: link, error: linkError } = await admin.auth.admin.generateLink({
  type: 'magiclink',
  email: DEMO_EMAIL,
});
if (linkError) throw new Error(`bağlantı üretilemedi: ${linkError.message}`);

const user = createClient(env.url, env.anon, { auth: { persistSession: false } });
// `type: 'email'` — token_hash ile doğrularken kullanılan tip budur; 'magiclink'
// üretim tarafının tipidir ve doğrulamada "invalid or has expired" verir.
const { data: session, error: otpError } = await user.auth.verifyOtp({
  type: 'email',
  token_hash: link.properties.hashed_token,
});
if (otpError) throw new Error(`oturum açılamadı: ${otpError.message}`);

const res = await fetch(`${env.url}/functions/v1/sync-entitlements`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    apikey: env.anon,
    Authorization: `Bearer ${session.session.access_token}`,
  },
  body: '{}',
});
const body = await res.json().catch(() => ({}));

check('fonksiyon 200 dönüyor', res.status === 200, `HTTP ${res.status} ${JSON.stringify(body)}`);

// ASIL SORU. `rc_api_key_missing` = sır yok. `revenuecat_unavailable` = sır var ama geçersiz
// ya da adres yanlış. İkisi de "hak yok" gibi görünmeyen, gürültülü hatalar — bilerek öyle.
check(
  'RevenueCat’e ulaşıldı (sır geçerli)',
  res.status === 200 && typeof body.known === 'boolean',
  body.error ? `hata: ${body.error}` : `known=${body.known}, pro=${body.pro}`,
);

// Demo hesabın hiç satın alması yok; beklenen cevap "tanımıyorum". Bu da geçerli bir
// cevaptır ve RevenueCat'in gerçekten cevap verdiğini gösterir.
check(
  'satın alması olmayan kullanıcı Pro değil',
  body.pro === false,
  `pro=${body.pro}, creditsUnseen=${body.creditsUnseen}`,
);

await user.auth.signOut();

const failed = results.filter((r) => !r.ok);
if (failed.length > 0) {
  console.error(`\n${failed.length} kontrol başarısız.`);
  process.exit(1);
}
console.log('\nhepsi tamam.');
