// Bir kanalın bitmiş bölümlerinden örnek test malzemesi hazırlar: ilk 58 saniyelik
// klip + thumbnail'lar, seeds/demo/ altına. Başlıklar uydurulmaz — kanalın kendi
// yükleme notlarından (`channel/epNN_upload.md`) okunur, çünkü test edilen şey tam da
// o başlıklar. Bulunamazsa bölüm atlanır.
//
//   node scripts/cut-demo-clips.mjs <kanal-klasörü> <önek> <ep05,ep06,…>
//   node scripts/cut-demo-clips.mjs "C:/…/debate-show/out" lmf ep05,ep06
//
// Çıktı: seeds/demo/<önek>-<ep>.mp4 + -a.jpg/-b.jpg ve stdout'ta manifest parçası.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [srcDir, prefix, epList] = process.argv.slice(2);
if (!srcDir || !prefix || !epList) {
  console.error('kullanım: node scripts/cut-demo-clips.mjs <out-klasörü> <önek> <ep05,ep06>');
  process.exit(1);
}
const OUT = resolve('seeds/demo');
const SECONDS = 58;

/** Yükleme notundaki başlıklar. İki biçim var: "**Title (A):**" ve "- A `…`". */
function titlesFor(ep) {
  const note = join(srcDir, 'channel', `${ep}_upload.md`);
  if (!existsSync(note)) return [];
  const text = readFileSync(note, 'utf8');
  const found = [];
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*-?\s*[ABC]?\s*`/.test(line) || /^\*\*(Title|Alternative title)/.test(line)) {
      const match = line.match(/`([^`]+)`/);
      if (match && match[1].length > 15) found.push(match[1]);
    }
    if (/^\*\*Description/.test(line)) break; // başlıklar açıklamadan önce biter
  }
  return [...new Set(found)].slice(0, 3);
}

/** Bölümün en yüksek sürümlü render'ı (ep07_v9 > ep07_v2), _raw/_phone/_720p hariç. */
function renderFor(ep) {
  const candidates = readdirSync(srcDir)
    .filter(
      (f) => f.endsWith('.mp4') && /^(_v\d+)?$/.test(f.slice(ep.length, -4)) && f.startsWith(ep),
    )
    .map((f) => ({ f, v: Number(f.match(/_v(\d+)/)?.[1] ?? 0) }))
    .sort((a, b) => b.v - a.v);
  return candidates[0] ? join(srcDir, candidates[0].f) : null;
}

function thumbsFor(ep) {
  const dir = join(srcDir, 'thumbs');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.startsWith(`${ep}_thumbnail`) && /\.(png|jpg|jpeg)$/i.test(f))
    .sort()
    .slice(0, 2)
    .map((f) => join(dir, f));
}

const run = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args]);
const entries = [];

for (const ep of epList.split(',')) {
  const render = renderFor(ep);
  const titles = titlesFor(ep);
  const thumbs = thumbsFor(ep);
  if (!render || titles.length === 0 || thumbs.length === 0) {
    console.error(
      `atlandı ${ep}: ${!render ? 'render yok' : titles.length === 0 ? 'başlık yok' : 'thumbnail yok'}`,
    );
    continue;
  }

  const clip = join(OUT, `${prefix}-${ep}.mp4`);
  // Uygulamadaki sıkıştırmanın hedefiyle aynı: 720p, h264+aac, moov başta.
  run([
    '-i',
    render,
    '-t',
    String(SECONDS),
    '-vf',
    'scale=-2:720',
    '-c:v',
    'libx264',
    '-crf',
    '26',
    '-preset',
    'medium',
    '-c:a',
    'aac',
    '-b:a',
    '96k',
    '-movflags',
    '+faststart',
    clip,
  ]);

  const thumbNames = [];
  for (const [index, source] of thumbs.entries()) {
    const name = `${prefix}-${ep}-${'ab'[index]}.jpg`;
    run(['-i', source, '-vf', 'scale=1280:720', '-q:v', '4', join(OUT, name)]);
    thumbNames.push(name);
  }

  entries.push({
    channel: null,
    titles,
    thumbnails: thumbNames,
    clip: `${prefix}-${ep}.mp4`,
    clip_duration_seconds: SECONDS,
  });
  console.error(`hazır ${ep}: ${titles.length} başlık, ${thumbNames.length} thumbnail`);
}

// Birikimli: script birkaç kez, farklı bölüm listeleriyle çalıştırılıyor. Üzerine
// yazsaydı önceki çalıştırmanın bölümleri listeden sessizce düşerdi.
const file = join(OUT, `.${prefix}-entries.json`);
const previous = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
const merged = [
  ...previous.filter((p) => !entries.some((e) => e.clip === p.clip)),
  ...entries,
].sort((a, b) => a.clip.localeCompare(b.clip));
writeFileSync(file, JSON.stringify(merged, null, 2));
console.log(JSON.stringify(entries, null, 2));
