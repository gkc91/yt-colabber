// Renders public/og.png (1200x630) from an inline SVG. Run again after a brand change:
//   pnpm --filter landing og
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const nodeRequire = createRequire(import.meta.url);
const sharp = nodeRequire('sharp');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0f1115"/>
  <circle cx="92" cy="92" r="18" fill="#ff5a4d"/>
  <text x="124" y="104" fill="#f2f4f7" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="38" font-weight="700">Clickable</text>
  <text x="92" y="268" fill="#f2f4f7" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="68" font-weight="700">Test your thumbnail,</text>
  <text x="92" y="348" fill="#f2f4f7" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="68" font-weight="700">title and first 60 seconds</text>
  <text x="92" y="428" fill="#ff5a4d" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="68" font-weight="700">before you publish.</text>
  <text x="92" y="524" fill="#a3abb8" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="32">Real people in your niche. No view or subscriber trading.</text>
</svg>`;

const out = fileURLToPath(new URL('../public/og.png', import.meta.url));
const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
await writeFile(out, png);
console.log(`og.png written (${(png.length / 1024).toFixed(1)} kB)`);
