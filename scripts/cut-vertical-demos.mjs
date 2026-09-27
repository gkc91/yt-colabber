// Dikey örnek test malzemesi hazırlar: 9:16 klip + kapak kareleri.
//
//   node scripts/cut-vertical-demos.mjs <kaynak-klasör> <önek> <id,id,id>
//
// Kaynak, her videonun yanında aynı adla bir .json taşımalı (başlık oradan okunur).
// Başlık uydurulmaz: test edilen şey tam da başlık.
//
// Kapak: Shorts'ta ayrı bir thumbnail dosyası yok, feed'de görünen şey videonun bir
// karesi. O yüzden kapakları klibin içinden alıyoruz — iki farklı saniyeden, çünkü
// ızgara testi iki kapağı karşılaştırabilsin.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [srcDir, prefix, idList] = process.argv.slice(2);
if (!srcDir || !prefix || !idList) {
  console.error('kullanım: node scripts/cut-vertical-demos.mjs <klasör> <önek> <id,id>');
  process.exit(1);
}

const OUT = resolve('seeds/demo');
const COVER_SECONDS = [1, 6];
const run = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args]);
const entries = [];

for (const id of idList.split(',')) {
  const video = join(srcDir, `${id}.mp4`);
  const meta = join(srcDir, `${id}.json`);
  if (!existsSync(video) || !existsSync(meta)) {
    console.error(`atlandı ${id}: video ya da json yok`);
    continue;
  }
  const info = JSON.parse(readFileSync(meta, 'utf8'));
  if (!info.title) {
    console.error(`atlandı ${id}: başlık yok`);
    continue;
  }

  const clip = `${prefix}-${id}.mp4`;
  // Dikeyde uzun kenar yükseklik: 1280'e indiriyoruz, 720p'nin dikey karşılığı.
  run([
    '-i',
    video,
    '-t',
    '58',
    '-vf',
    'scale=-2:1280',
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
    join(OUT, clip),
  ]);

  const thumbnails = [];
  COVER_SECONDS.forEach((second, index) => {
    const name = `${prefix}-${id}-${'ab'[index]}.jpg`;
    run(['-ss', String(second), '-i', video, '-frames:v', '1', '-q:v', '4', join(OUT, name)]);
    thumbnails.push(name);
  });

  entries.push({
    titles: [info.title],
    thumbnails,
    clip,
    clip_duration_seconds: Math.min(58, Math.round(info.durationSec ?? 58)),
    is_vertical: true,
  });
  console.error(`hazır ${id}: ${info.title}`);
}

writeFileSync(join(OUT, `.${prefix}-entries.json`), JSON.stringify(entries, null, 2));
console.log(JSON.stringify(entries, null, 2));
