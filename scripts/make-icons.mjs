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

/** Klasik imleç oku; 0,0'dan başlayıp ~52x82 birimlik kutuya sığar. */
const CURSOR = 'M0,0 L0,72 L17,55 L29,82 L44,75 L32,49 L52,49 Z';

/**
 * İşaret her zaman 1024'lük bir koordinat sisteminde çizilir; `size` yalnızca çıktı
 * çözünürlüğüdür. Böylece 96 px favicon ile 1024 px ikon birebir aynı kompozisyondur.
 *
 * @param size çıktı kenar uzunluğu
 * @param scale işaretin büyüklüğü (Android ön planı güvenli alan için küçültür)
 * @param bg zemin rengi ya da null (şeffaf)
 * @param mono tek renk (monokrom ikon) ya da null
 */
function mark({ size = 1024, scale = 1, bg = PAPER, mono = null } = {}) {
  // Kompozisyon: mürekkep thumbnail, sağ alt köşesini delip kâğıdın üstüne taşan kırmızı
  // imleç. İmlecin gövdesi kâğıt üstünde durduğu için kontura gerek yok — kontur çerçeveyi
  // kemiriyor ve kaza gibi görünüyordu.
  const shapes =
    scale === 0
      ? ''
      : `<g transform="translate(512 512) scale(${scale}) translate(-512 -512)">
    <g transform="translate(42 -34)">
      <rect x="150" y="300" width="610" height="343" rx="28" fill="${mono ?? INK}"/>
      <g transform="translate(596 500) scale(3.4)">
        <path d="${CURSOR}" fill="${mono ?? ACCENT}" stroke="${bg ?? PAPER}" stroke-width="7" stroke-linejoin="round"/>
      </g>
    </g>
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
