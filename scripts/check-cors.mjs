// Tarayıcıdan çağrılan Edge Function'ların CORS kontrolü (2026-09-25 bulgusu).
//   node scripts/check-cors.mjs https://<ref>.supabase.co
//   node scripts/check-cors.mjs --linked          # bağlı projeye
//
// Neden ayrı bir kontrol: yerel stack'te Kong CORS başlıklarını kendisi ekler, bu yüzden
// eksiklik YALNIZCA barındırılan ortamda görünür. Canlıda ön kontrol 405 dönüyordu ve
// tarayıcı isteği hiç göndermiyordu — değerlendirme ekranında thumbnail boş kaldı, klip
// oynamadı. Anahtar gerekmez: ön kontrol ve yetkisiz POST kimlik istemez.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Tarayıcıdan çağrılanlar. notify/refresh-niche-cache/cleanup-media cron'dan,
// revenuecat-webhook mağazadan gelir; onlar tarayıcı görmez.
const FUNCTIONS = ['signed-media', 'ai-summary', 'delete-account'];
const ORIGIN = 'https://app.clickabletest.com';

const arg = process.argv[2];
let base = arg;
if (!arg || arg === '--linked') {
  const refFile = resolve('supabase/.temp/project-ref');
  // Bağlı proje yoksa (ör. CI) kaynak kontrolüyle yetiniriz; ağ kontrolü atlanır.
  base = existsSync(refFile) ? `https://${readFileSync(refFile, 'utf8').trim()}.supabase.co` : null;
}
if (arg === '--local') {
  base = execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'env'], {
    encoding: 'utf8',
    shell: true,
  }).match(/API_URL="?([^"\n\r]+)/)[1];
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

// ---------- kaynak kontrolü (ağsız, CI'da da çalışır) ----------
// Yerel stack'te Kong başlıkları kendisi eklediği için davranış testi orada yanıltır;
// kodun ön kontrolü ele aldığını en azından burada görürüz.
for (const fn of FUNCTIONS) {
  const source = readFileSync(`supabase/functions/${fn}/index.ts`, 'utf8');
  check(`${fn}: kaynakta ön kontrol ele alınıyor`, source.includes('preflight(req)'));
}

if (!base) {
  const failed = results.filter((ok) => !ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed (yalnızca kaynak; adres yok)`);
  process.exit(failed === 0 ? 0 : 1);
}

console.log(`\n${base}\n`);

for (const fn of FUNCTIONS) {
  const url = `${base}/functions/v1/${fn}`;

  // 1) Ön kontrol: tarayıcı asıl isteği göndermeden önce bunu sorar.
  const pre = await fetch(url, {
    method: 'OPTIONS',
    headers: {
      origin: ORIGIN,
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'authorization,content-type,apikey',
    },
  });
  check(
    `${fn}: ön kontrol kabul ediliyor`,
    pre.status >= 200 && pre.status < 300,
    `HTTP ${pre.status}`,
  );
  check(
    `${fn}: ön kontrol köken veriyor`,
    pre.headers.get('access-control-allow-origin') === '*' ||
      pre.headers.get('access-control-allow-origin') === ORIGIN,
    pre.headers.get('access-control-allow-origin') ?? 'başlık yok',
  );
  const allowed = (pre.headers.get('access-control-allow-headers') ?? '').toLowerCase();
  check(
    `${fn}: authorization başlığına izin var`,
    allowed.includes('authorization') && allowed.includes('content-type'),
    allowed || 'başlık yok',
  );

  // 2) Yetkisiz POST: hata cevabının da CORS taşıması gerekir, yoksa tarayıcı
  // gerçek hata yerine "network error" gösterir ve ekranda sebep görünmez.
  const post = await fetch(url, {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json' },
    body: '{}',
  });
  check(
    `${fn}: hata cevabı da CORS taşıyor`,
    post.headers.get('access-control-allow-origin') !== null,
    `HTTP ${post.status}`,
  );
}

const failures = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failures}/${results.length} passed`);
process.exit(failures === 0 ? 0 : 1);
