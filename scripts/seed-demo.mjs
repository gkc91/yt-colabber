// Örnek (demo) testleri yükler — "Değerlendir" sekmesi ilk günden boş olmasın diye.
//
//   node scripts/seed-demo.mjs                    # yerel stack
//   SUPABASE_URL=... SERVICE_ROLE_KEY=... node scripts/seed-demo.mjs
//   node scripts/seed-demo.mjs --list             # neler yüklü, göster
//
// Girdi: seeds/demo/manifest.json + yanındaki görsel/klip dosyaları.
// Her kayıt gerçek, izlenebilir bir ilk 60 saniye olmalı (kendi kanallarımız).
// Bunlar sahte kullanıcı DEĞİL: uygulamada "Örnek test" rozetiyle gösterilir,
// kredi düşmez, kapanmaz ve gerçek testlerden sonra sıraya girer (migration 0014).
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';

const nodeRequire = createRequire(import.meta.url);
const { createClient } = nodeRequire(
  nodeRequire.resolve('@supabase/supabase-js', { paths: ['apps/mobile'] }),
);

const MANIFEST = resolve('seeds/demo/manifest.json');
const DEMO_EMAIL = 'demo@clickable.app';

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
};

function localEnv() {
  const text = execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'env'], {
    encoding: 'utf8',
    shell: true,
  });
  const env = Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
      .filter(Boolean)
      .map((match) => [match[1], match[2]]),
  );
  return { url: env.API_URL, key: env.SERVICE_ROLE_KEY };
}

/**
 * --linked: `supabase link` ile bağlanmış projeye (canlı) yükle. Adres bağlı projeden
 * okunur, anahtar terminalde sorulur — elle ortam değişkeni yazmak gerekmez.
 */
async function linkedEnv() {
  const refFile = resolve('supabase/.temp/project-ref');
  if (!existsSync(refFile)) throw new Error('Bağlı proje yok. Önce: pnpm exec supabase link');
  const ref = readFileSync(refFile, 'utf8').trim();
  let key = process.env.SERVICE_ROLE_KEY;
  if (!key) {
    const { createInterface } = await import('node:readline/promises');
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    console.log(`Proje: https://${ref}.supabase.co`);
    console.log('service_role anahtarı: Supabase paneli → Project Settings → API Keys');
    key = (await rl.question('Anahtarı yapıştır ve Enter: ')).trim();
    rl.close();
  }
  // Publishable/anon anahtar herkese açıktır ve yönetici işlemi yapamaz; 401'i beklemeden söyle.
  if (key.startsWith('sb_publishable_')) {
    console.error(
      '\nBu publishable anahtar. Gereken: API Keys → "Secret keys" bölümündeki sb_secret_… anahtarı.',
    );
    process.exit(1);
  }
  return { url: `https://${ref}.supabase.co`, key };
}

const { url, key } = process.argv.includes('--linked')
  ? await linkedEnv()
  : process.env.SUPABASE_URL
    ? { url: process.env.SUPABASE_URL, key: process.env.SERVICE_ROLE_KEY }
    : localEnv();
if (!url || !key) throw new Error('SUPABASE_URL ve SERVICE_ROLE_KEY gerekli');

const admin = createClient(url, key, { auth: { persistSession: false } });

// ---------- --list ----------
if (process.argv.includes('--list')) {
  const { data, error } = await admin
    .from('submissions')
    .select('id, niche_id, title_options, received_reviews, created_at')
    .eq('is_demo', true)
    .order('created_at');
  if (error) throw error;
  console.log(`${data.length} örnek test:`);
  for (const row of data) {
    console.log(`  ${row.title_options[0]} — ${row.received_reviews} değerlendirme (${row.id})`);
  }
  process.exit(0);
}

// ---------- demo sahibi hesap ----------
async function demoOwner() {
  const { data: list, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) throw listError;
  const existing = list.users.find((user) => user.email === DEMO_EMAIL);
  if (existing) return existing.id;

  const { data, error } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    email_confirm: true,
  });
  if (error) throw error;
  await admin
    .from('profiles')
    .update({ handle: 'clickable', onboarding_done: true })
    .eq('id', data.user.id);
  console.log(`demo hesabı oluşturuldu: ${DEMO_EMAIL}`);
  return data.user.id;
}

async function upload(ownerId, folder, file) {
  const path = `${folder}/${ownerId}/${file.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const absolute = join(dirname(MANIFEST), file);
  if (!existsSync(absolute)) throw new Error(`dosya yok: ${absolute}`);
  const contentType = MIME[extname(file).toLowerCase()];
  if (!contentType) throw new Error(`desteklenmeyen tür: ${file}`);

  const { error } = await admin.storage
    .from('media')
    .upload(path, readFileSync(absolute), { contentType, upsert: true });
  if (error) throw error;
  return path;
}

// ---------- yükle ----------
if (!existsSync(MANIFEST)) {
  console.error(`manifest yok: ${MANIFEST}`);
  console.error('Örnek biçim seeds/demo/README.md içinde.');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const ownerId = await demoOwner();

const { data: current } = await admin
  .from('submissions')
  .select('title_options')
  .eq('is_demo', true);
const already = new Set((current ?? []).map((row) => row.title_options[0]));

let added = 0;
for (const entry of manifest.submissions) {
  if (already.has(entry.titles[0])) {
    console.log(`atlandı (zaten var): ${entry.titles[0]}`);
    continue;
  }

  const thumbnailPaths = [];
  for (const thumbnail of entry.thumbnails) {
    thumbnailPaths.push(await upload(ownerId, 'thumbs', thumbnail));
  }
  const clipPath = await upload(ownerId, 'clips', entry.clip);

  const { data, error } = await admin.rpc('create_demo_submission', {
    p_owner: ownerId,
    p_niche_slug: entry.niche,
    p_title_options: entry.titles,
    p_thumbnail_paths: thumbnailPaths,
    p_clip_path: clipPath,
    p_clip_duration: entry.clip_duration_seconds,
    p_language: entry.language ?? 'en',
  });
  if (error) throw error;
  console.log(`eklendi: ${entry.titles[0]} (${entry.niche}) → ${data}`);
  added += 1;
}

console.log(`\n${added} örnek test eklendi.`);
