// Uygulama ikonlarını tek kaynaktan üretir (DESIGN.md §3 paleti).
//   node scripts/make-icons.mjs
//
// Neden script: ikon "bir kere çizilip unutulan dosya" değil, tasarım sözleşmesinin
// parçası. Renk değişirse buradan yeniden üretilir; elle düzeltilmiş bir PNG'yi kimse
// güncelleyemez.
//
// Fikir: mürekkep renginde 16:9 bir thumbnail ve onu delen kırmızı bir imleç.
// Ürün tek cümlede bu: "hangisine tıklanır?"
import { createRequire } from 'node:module';
import { globSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
// sharp doğrudan bağımlılığımız değil (Expo üzerinden geliyor); pnpm deposundan çözüyoruz.
const sharpPath = globSync('node_modules/.pnpm/sharp@*/node_modules/sharp')[0];
if (!sharpPath) throw new Error('sharp bulunamadı: pnpm install');
const sharp = require(resolve(sharpPath));

const PAPER = '#FAF9F7';
const INK = '#16161A';
const ACCENT = '#D92D20';

/**
 * İşaret: dört thumbnail, biri seçilmiş. Ürünün sorusu bu — "hangisine tıklanır?" —
 * ve 48 px'te bile dört blokla tek kırmızı ayırt ediliyor. (Önceki tek kart + imleç
 * denemesi küçükken siyah bir kutuya dönüşüyordu; sahibi haklı olarak beğenmedi.)
 *
 * Her şey 1024'lük koordinat sisteminde çizilir; `size` yalnızca çıktı çözünürlüğüdür,
 * böylece favicon ile mağaza ikonu birebir aynı kompozisyondur.
 *
 * @param size çıktı kenar uzunluğu
 * @param scale işaretin büyüklüğü (Android ön planı güvenli alan için küçültür)
 * @param bg zemin rengi ya da null (şeffaf)
 * @param mono tek renk (monokrom ikon): seçili kart tam opak, diğerleri soluk
 */
function mark({ size = 1024, scale = 1, bg = PAPER, mono = null } = {}) {
  const W = 372;
  const H = 209; // 16:9
  const GAP = 40;
  const x0 = (1024 - (2 * W + GAP)) / 2;
  const y0 = (1024 - (2 * H + GAP)) / 2;
  const tile = (x, y, chosen) =>
    `<rect x="${x}" y="${y}" width="${W}" height="${H}" rx="20" fill="${
      chosen ? (mono ?? ACCENT) : (mono ?? INK)
    }"${mono && !chosen ? ' opacity="0.35"' : ''}/>`;

  const grid = [
    tile(x0, y0, false),
    // Seçilen: sağ üst. Göz sol üstten sonra oraya gider.
    tile(x0 + W + GAP, y0, true),
    tile(x0, y0 + H + GAP, false),
    tile(x0 + W + GAP, y0 + H + GAP, false),
  ].join('');

  const shapes =
    scale === 0
      ? ''
      : `<g transform="translate(512 512) scale(${scale}) translate(-512 -512)">
    ${grid}
  </g>`;

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
  ${bg ? `<rect width="1024" height="1024" fill="${bg}"/>` : ''}
  ${shapes}
</svg>`);
}

const out = 'apps/mobile/assets/images';
mkdirSync('store', { recursive: true });

const files = [
  // Uygulama ikonu (iOS + mağaza): şeffaflık yok.
  [`${out}/icon.png`, mark({ size: 1024 })],
  // Android uyarlanabilir ikon: ön plan güvenli alanda kalmalı, zemin ayrı katman.
  [`${out}/android-icon-foreground.png`, mark({ size: 1024, scale: 0.7, bg: null })],
  [`${out}/android-icon-background.png`, mark({ size: 1024, scale: 0, bg: PAPER })],
  [
    `${out}/android-icon-monochrome.png`,
    mark({ size: 1024, scale: 0.7, bg: null, mono: '#000000' }),
  ],
  // Açılış ekranı işareti (zemin app.json'dan gelir).
  [`${out}/splash-icon.png`, mark({ size: 512, scale: 0.55, bg: null })],
  [`${out}/favicon.png`, mark({ size: 96 })],
  // Play mağaza ikonu 512x512.
  ['store/icon-512.png', mark({ size: 512 })],
];

for (const [path, svg] of files) {
  const png = await sharp(svg).png().toBuffer();
  writeFileSync(path, png);
  console.log(`${path} (${Math.round(png.length / 1024)} KB)`);
}
