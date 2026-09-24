// Web dışa aktarımının kontrolü (E2). Önce `pnpm build:web`, sonra:
//   node scripts/check-web-export.mjs
// Sorular: ekranlar üretildi mi, dinamik rotalar için yönlendirme var mı, PWA dosyaları
// yerinde mi, ve Supabase adresi pakete gömüldü mü (env verilmeden build alınırsa uygulama
// tarayıcıda açılır açılmaz patlar — bunu dağıtımdan önce yakalamak istiyoruz).
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'apps/mobile/dist';

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

/** Ekranlar: giriş, onboarding, üç sekme, paywall ve dinamik rotalar. */
const PAGES = [
  'index.html',
  'sign-in.html',
  'niche.html',
  'channel.html',
  'paywall.html',
  'auth.html',
  'review/index.html',
  'review/[taskId].html',
  'submit/index.html',
  'submit/new.html',
  'submit/[id].html',
  'profile/index.html',
];

const missing = PAGES.filter((page) => !existsSync(join(DIST, page)));
check('bütün ekranlar üretildi', missing.length === 0, missing.join(', '));

// ---------- Cloudflare yönlendirmeleri ----------
const redirectsPath = join(DIST, '_redirects');
const redirects = existsSync(redirectsPath) ? readFileSync(redirectsPath, 'utf8') : '';
check('_redirects dosyası kopyalandı', redirects.length > 0);
/** Yorumlar kuralların kendisi değil; kontroller yalnızca kurallara bakmalı. */
const redirectRules = redirects
  .split(/\r?\n/)
  .filter((line) => line.trim() && !line.trim().startsWith('#'))
  .join('\n');
check('bilinmeyen adresler uygulamaya düşüyor', /\/\*\s+\/index\.html\s+200/.test(redirectRules));
// Regresyon: dinamik rotayı "[taskId].html" dosyasına eşleyen kural Cloudflare'de 308'e
// dönüşüp sonsuz döngü yapıyordu. Böyle bir kural bir daha girmesin.
check(
  'dinamik rota dosyaya eşlenmiyor (308 döngüsü)',
  !/\[taskId\]\.html|\[id\]\.html/.test(redirectRules),
);

// ---------- PWA ----------
const manifestPath = join(DIST, 'manifest.json');
check('manifest.json var', existsSync(manifestPath));
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  check(
    'manifest ayakta durabilir',
    manifest.name === 'Clickable' && manifest.display === 'standalone',
  );
  check(
    'manifest ikonu dosyada var',
    manifest.icons?.every((icon) => existsSync(join(DIST, icon.src.replace(/^\//, '')))),
  );
}

const html = existsSync(join(DIST, 'index.html'))
  ? readFileSync(join(DIST, 'index.html'), 'utf8')
  : '';
check('sayfa manifesti bağlıyor', html.includes('rel="manifest"'));
check('sayfanın başlığı var', html.includes('<title>Clickable</title>'));

// ---------- yapılandırma paketin içinde mi ----------
const bundleDir = join(DIST, '_expo/static/js/web');
const bundles = existsSync(bundleDir) ? readdirSync(bundleDir) : [];
const bundle = bundles.map((file) => readFileSync(join(bundleDir, file), 'utf8')).join('');
check(
  'Supabase adresi pakete gömülü',
  /https:\/\/[a-z0-9]+\.supabase\.co/.test(bundle),
  `${bundles.length} paket`,
);
check(
  'satın alma kütüphanesi web paketine girmemiş',
  !bundle.includes('react-native-purchases/src'),
);

const failures = results.filter((value) => !value).length;
console.log(`\n${results.length - failures}/${results.length} passed`);
process.exit(failures === 0 ? 0 : 1);
