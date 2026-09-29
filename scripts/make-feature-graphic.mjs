// Play öne çıkan görselini (1024×500) üretir.
//   node scripts/make-feature-graphic.mjs
//
// Neden script: bu dosya elle çizilmişti ve kimse yeniden üretemiyordu. Renk, metin ya da
// işaret değişince güncellenemeyen bir PNG, tasarım sözleşmesinin dışına düşmüş demektir —
// `make-icons.mjs` başlığındaki gerekçenin aynısı burada da geçerli.
//
// Neden Playwright: marka yazı tipi Archivo ve sisteme kurulu değil. Tarayıcıda
// `@font-face` ile TTF'yi doğrudan yükleyip yazıyı ölçebiliyoruz; sharp'ın SVG çizicisi
// sistem yazı tiplerine düşüyor ve marka dışı bir görsel üretiyordu.
//
// DÜZELTİLEN (2026-09-29, sahibin bildirimi): alt satır sağdaki ızgaranın üstüne biniyordu
// ve kompozisyon yukarıda toplanıp altta 145 px boşluk bırakıyordu. Artık metin sütunu
// ızgaraya değmeyen sabit bir genişlikte ve blok dikeyde ortalanıyor.
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

// DESIGN.md §3
const PAPER = '#FAF9F7';
const INK = '#16161A';
const ACCENT = '#D92D20';

const W = 1024;
const H = 500;
// Metin sütunu burada biter; ızgara burada başlar. Aradaki boşluk ikisinin çarpışmasını
// imkânsız kılıyor — eski görselde bu sınır yoktu ve alt satır ızgaraya giriyordu.
const TEXT_MAX = 470;
const GRID_X = 582;

const FONT_DIR = 'node_modules/.pnpm/@expo-google-fonts+archivo@0.4.2/node_modules/@expo-google-fonts/archivo';
const font = (weight, file) =>
  `@font-face{font-family:Archivo;font-weight:${weight};src:url(data:font/ttf;base64,${readFileSync(resolve(FONT_DIR, file)).toString('base64')}) format('truetype');}`;

// İşaret `make-icons.mjs` ile aynı: dört thumbnail, biri seçili. Ürünün sorusu bu.
const TILE_W = 176;
const TILE_H = 99; // 16:9
const TILE_GAP = 18;

const html = `<!doctype html><meta charset="utf-8"><style>
${font(700, '700Bold/Archivo_700Bold.ttf')}
${font(600, '600SemiBold/Archivo_600SemiBold.ttf')}
*{margin:0;padding:0;box-sizing:border-box}
body{width:${W}px;height:${H}px;background:${PAPER};font-family:Archivo;
     display:flex;align-items:center;gap:0;overflow:hidden}
.text{width:${TEXT_MAX}px;margin-left:72px}
h1{font-weight:700;font-size:64px;line-height:1;color:${INK};letter-spacing:-0.02em}
.rule{width:120px;height:6px;background:${ACCENT};border-radius:3px;margin:22px 0}
p{font-weight:600;font-size:23px;line-height:1.35;color:${INK};opacity:0.62}
.grid{position:absolute;left:${GRID_X}px;top:${(H - (2 * TILE_H + TILE_GAP)) / 2}px;
      display:grid;grid-template-columns:repeat(2,${TILE_W}px);gap:${TILE_GAP}px}
.tile{width:${TILE_W}px;height:${TILE_H}px;border-radius:12px;background:${INK}}
.tile.chosen{background:${ACCENT}}
</style>
<div class="text">
  <h1>Clickable</h1>
  <div class="rule"></div>
  <p>Test your thumbnail before you publish</p>
</div>
<div class="grid">
  <div class="tile"></div><div class="tile chosen"></div>
  <div class="tile"></div><div class="tile"></div>
</div>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);

// Çarpışma kontrolü kodda: gözle bakıp "olmuş" demek, bir dahaki metin değişikliğinde
// aynı hatayı geri getirir.
// Ölçüm Range ile: `getBoundingClientRect` blok öğede metnin değil SÜTUNUN genişliğini
// verir, yani metin ne yazarsa yazsın "tam sınırda" der ve kontrol hiçbir şey sınamaz.
// (İlk hâli böyleydi ve 0 px pay bildirdi.)
const overflow = await page.evaluate((limit) => {
  const right = Math.max(
    ...[...document.querySelectorAll('.text h1, .text p')].map((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return Math.round(range.getBoundingClientRect().right);
    }),
  );
  return right - limit;
}, 72 + TEXT_MAX);
if (overflow > 0) {
  await browser.close();
  throw new Error(`metin sütunu ${overflow}px taşıyor: ızgaraya girer, yazıyı kısalt ya da küçült`);
}

mkdirSync('store', { recursive: true });
await page.screenshot({ path: 'store/feature-graphic-1024x500.png' });
await browser.close();
console.log(`store/feature-graphic-1024x500.png (${W}×${H}, metin payı ${-overflow}px)`);
