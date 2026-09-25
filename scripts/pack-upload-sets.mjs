// Kanal sahibinin uygulamadan KENDİ hesabıyla yükleyeceği setleri klasörlere hazırlar.
//
//   node scripts/pack-upload-sets.mjs <hedef-klasör>
//
// Her bölüm bir klasör: klip + thumbnail'lar + basliklar.txt. Başlıklar kanalın kendi
// yükleme notlarından gelir; kaynağı olmayan bölümde dosya "TASLAK" der ve nereden
// türetildiğini yazar — uydurulmuş bir başlığın gerçek sanılması en kötü sonuç olur.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const target = resolve(process.argv[2] ?? 'C:/Users/user/Desktop/Clickable-Yukle');
const SEEDS = resolve('seeds/demo');

const manifest = JSON.parse(readFileSync(join(SEEDS, 'manifest.json'), 'utf8'));
const cut = JSON.parse(readFileSync(join(SEEDS, '.lmf-entries.json'), 'utf8'));

/** manifest'teki (zaten yüklü) kayıtları da aynı biçime getir. */
const fromManifest = (channel) =>
  manifest.submissions
    .filter((s) => s.channel === channel)
    .map((s) => ({ titles: s.titles, thumbnails: s.thumbnails, clip: s.clip }));

// ep04 kanalın yükleme notlarında yok; başlıklar altyazının ilk cümlelerinden
// türetildi ve TASLAK olarak işaretleniyor.
const mrEp04 = {
  titles: [
    'Same Return, Same Money: Why One of Them Ends Up Poorer',
    'Two Friends, $50,000, 9% a Year. One Takes It in Cash.',
  ],
  thumbnails: ['mr-ep04-a.jpg', 'mr-ep04-b.jpg'],
  clip: 'mr-ep04.mp4',
  draft: true,
};

const sets = {
  'let-me-finish': cut,
  'money-rematch': [...fromManifest('money-rematch'), mrEp04],
};

let total = 0;
for (const [channel, entries] of Object.entries(sets)) {
  for (const entry of entries) {
    const name = entry.clip.replace(/\.mp4$/, '');
    const dir = join(target, channel, name);
    mkdirSync(dir, { recursive: true });

    copyFileSync(join(SEEDS, entry.clip), join(dir, 'klip.mp4'));
    entry.thumbnails.forEach((file, index) => {
      if (existsSync(join(SEEDS, file)))
        copyFileSync(join(SEEDS, file), join(dir, `thumbnail-${'abc'[index]}.jpg`));
    });

    const lines = [
      `# ${name}`,
      '',
      'Başlıklar (uygulamada her birini ayrı satıra gir):',
      ...entry.titles.map((t) => `  ${t}`),
      '',
      `Thumbnail: ${entry.thumbnails.length} adet`,
      'Klip: klip.mp4 — 58 sn, 720p',
      '',
      entry.draft
        ? 'DİKKAT: başlıklar TASLAK, altyazıdan türetildi. Kendi başlığınla değiştir.'
        : '',
    ].filter(Boolean);
    writeFileSync(join(dir, 'basliklar.txt'), lines.join('\n') + '\n', 'utf8');
    total += 1;
  }
}
console.log(`${total} set hazır: ${target}`);
