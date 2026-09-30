// Play mağaza ekran görüntülerini üretir: 1080×1920, gerçek içerikle, tekrar çalıştırılabilir.
//
//   node scripts/store-screenshots.mjs
//
// Neden script: mağaza görselleri tasarım her değiştiğinde yeniden çekilmesi gereken şeyler.
// Elle çekilen dört görüntü bir daha aynı durumda kurulamaz — hangi test açıktı, kaç kredi
// vardı, hangi ızgara geldi. Burada durum SQL'den kuruluyor, görüntü ondan sonra alınıyor.
//
// Ön koşullar (script kontrol eder, eksikse söyler):
//   1. Yerel Supabase ayakta ve `node scripts/seed-demo.mjs` çalıştırılmış
//   2. Web sunucusu açık: node scripts/dev-mobile-local.mjs --web --port 8081
//   3. `SHOT_ACCESS_TOKEN` ortam değişkeni: yerel test kullanıcısının oturumu
//      (üretmek için: supabase paneli değil, aşağıdaki not)
//
// Oturum neden ortam değişkeni: token yerel yığındaki test kullanıcısına ait ve saatlerce
// geçerli. Repoya yazmıyoruz; her çalıştırmada yenisi üretilir.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.SHOT_BASE_URL ?? 'http://localhost:8081';
const TOKEN = process.env.SHOT_ACCESS_TOKEN;
const REFRESH = process.env.SHOT_REFRESH_TOKEN ?? '';
const OUT = resolve('store/play/screenshots');

// Play telefon görüntüsü: 16:9 ya da 9:16, kenar 320-3840 px. 1080×1920 en yaygın telefon
// çözünürlüğü ve mağazada ölçeklenmeden görünüyor.
const WIDTH = 1080;
const HEIGHT = 1920;
// Cihaz piksel oranı 3: arayüz 360×640 dp'lik bir telefonmuş gibi dizilir, çıktı 1080×1920
// olur. Oranı 1 bırakmak 1080 dp genişlik demekti — o bir tablet düzeni.
const SCALE = 3;

if (!TOKEN) {
  console.error('SHOT_ACCESS_TOKEN gerekli. Yerel test kullanıcısı için giriş bağlantısı üret:');
  console.error('  supabase status -o env  →  SERVICE_ROLE_KEY');
  console.error(
    '  POST /auth/v1/admin/generate_link  {"type":"magiclink","email":"bob@clickable.test"}',
  );
  process.exit(1);
}

/**
 * Ekranın yerleşmesini bekler. Metin yetmiyor: ızgaradaki decoy görselleri uzaktan
 * (i.ytimg.com) geliyor ve ilk denemede yarısı boş kutu olarak çıktı. Bu yüzden her
 * <img> gerçekten çizilene kadar bekleniyor.
 */
async function settle(page, text) {
  if (text) await page.getByText(text, { exact: false }).first().waitFor({ timeout: 20000 });
  await page
    .waitForFunction(
      () => [...document.images].every((img) => img.complete && img.naturalWidth > 0),
      null,
      { timeout: 20000 },
    )
    .catch(() => console.warn('  uyarı: bazı görseller yüklenmedi'));
  await page.waitForTimeout(1500);
}

const SUBMISSION = process.env.SHOT_SUBMISSION_ID ?? '';

const shots = [
  { file: '01-review.png', path: '/review', wait: 'A test is waiting' },
  { file: '02-content.png', path: '/submit', wait: 'New test' },
  { file: '03-profile.png', path: '/profile', wait: 'What you review' },
  // Sonuç ekranı: ürünün karşılığını tek karede gösteren yer. Testin kimliği dışarıdan
  // geliyor çünkü hangi testin sonucunun gösterileceği veriye bağlı.
  ...(SUBMISSION ? [{ file: '05-results.png', path: `/submit/${SUBMISSION}`, wait: null }] : []),
];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: WIDTH / SCALE, height: HEIGHT / SCALE },
  deviceScaleFactor: SCALE,
  isMobile: true,
  hasTouch: true,
});

// Oturum sayfa yüklenmeden önce yazılır; uygulama açılışta okuyor.
await context.addInitScript(
  ([token, refresh]) => {
    const session = {
      access_token: token,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3000,
      refresh_token: refresh,
      user: {
        id: '22222222-2222-2222-2222-222222222222',
        aud: 'authenticated',
        role: 'authenticated',
      },
    };
    window.localStorage.setItem('sb-127-auth-token', JSON.stringify(session));
  },
  [TOKEN, REFRESH],
);

const page = await context.newPage();
for (const shot of shots) {
  await page.goto(BASE + shot.path, { waitUntil: 'networkidle' });
  await settle(page, shot.wait);
  await page.screenshot({ path: resolve(OUT, shot.file) });
  console.log(`${shot.file} ← ${shot.path}`);
}

// Değerlendirme ızgarası: mağazada gösterilecek asıl ekran, ürünün ne yaptığını tek karede
// anlatan yer. Görev akışın içinde açıldığı için düğmeye basarak gidiyoruz.
await page.goto(BASE + '/review', { waitUntil: 'networkidle' });
await settle(page, 'A test is waiting');
await page.getByText('Start reviewing').click();
await settle(page, 'Which one would you click');
await page.screenshot({ path: resolve(OUT, '04-feed.png') });
console.log('04-feed.png ← /review → ızgara');

await browser.close();
console.log(`\nBitti: ${OUT}`);
