// Klip saklama süresinin uçtan uca kontrolü (C5). Yerel stack + funcs gerekir:
//   pnpm exec supabase functions serve --env-file supabase/functions/local-test.vars
//   node scripts/check-clip-retention.mjs
// Sorular: eski klip depodan gerçekten siliniyor mu, yeni klip duruyor mu,
// thumbnail'lar korunuyor mu, fonksiyonu service_role olmayan çağırabiliyor mu.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

const nodeRequire = createRequire(import.meta.url);
const { createClient } = nodeRequire(
  nodeRequire.resolve('@supabase/supabase-js', { paths: ['apps/mobile'] }),
);

const env = Object.fromEntries(
  execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'env'], {
    encoding: 'utf8',
    shell: true,
  })
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2]]),
);

const API = env.API_URL;
const ANON = env.ANON_KEY;
const SERVICE = env.SERVICE_ROLE_KEY;
const admin = createClient(API, SERVICE, { auth: { persistSession: false } });

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

// ---------- arrange ----------
const email = `retention-${Date.now()}@clickable.test`;
const { data: niche } = await admin.from('niches').select('id').eq('slug', 'animation').single();
const { data: created, error: createError } = await admin.auth.admin.createUser({
  email,
  password: 'password123',
  email_confirm: true,
});
if (createError) throw createError;
const owner = created.user.id;
await admin.from('profiles').update({ niche_id: niche.id, onboarding_done: true }).eq('id', owner);

const upload = async (folder, name) => {
  const path = `${folder}/${owner}/${name}`;
  const { error } = await admin.storage.from('media').upload(path, Buffer.alloc(32 * 1024, 7), {
    contentType: folder === 'clips' ? 'video/mp4' : 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;
  return path;
};

const exists = async (folder, file) => {
  const { data } = await admin.storage.from('media').list(`${folder}/${owner}`);
  return (data ?? []).some((entry) => entry.name === file);
};

const oldClipFile = `${randomUUID()}.mp4`;
const recentClipFile = `${randomUUID()}.mp4`;
const thumbFile = `${randomUUID()}.jpg`;

const oldClip = await upload('clips', oldClipFile);
const recentClip = await upload('clips', recentClipFile);
const thumb = await upload('thumbs', thumbFile);

const insert = async (clipPath, closesAt, status) => {
  const { data, error } = await admin
    .from('submissions')
    .insert({
      owner_id: owner,
      niche_id: niche.id,
      title_options: ['A title'],
      thumbnail_paths: [thumb],
      clip_path: clipPath,
      clip_duration_seconds: 30,
      requested_reviews: 5,
      status,
      closes_at: closesAt,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
};

const days = (count) => new Date(Date.now() - count * 86400_000).toISOString();
const oldId = await insert(oldClip, days(40), 'completed');
const recentId = await insert(recentClip, days(10), 'completed');

const callCleanup = (token) =>
  fetch(`${API}/functions/v1/cleanup-media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: '{}',
  });

// ---------- yetki ----------
const anonCall = await callCleanup(ANON);
check('service_role olmayan çağrı reddedilir', anonCall.status === 403, `HTTP ${anonCall.status}`);
check('reddedilen çağrı dosyayı silmez', await exists('clips', oldClipFile));

// ---------- temizlik ----------
const run = await callCleanup(SERVICE);
const body = await run.json();
check('temizlik çalışır', run.ok, `HTTP ${run.status} ${JSON.stringify(body)}`);
check('en az bir klip silindi', (body.deleted ?? 0) >= 1, String(body.deleted));

check('40 günlük klip depodan silindi', !(await exists('clips', oldClipFile)));
check('10 günlük klip duruyor', await exists('clips', recentClipFile));
check('thumbnail korunuyor', await exists('thumbs', thumbFile));

const { data: rows } = await admin
  .from('submissions')
  .select('id, clip_deleted_at')
  .in('id', [oldId, recentId]);
const oldRow = rows.find((row) => row.id === oldId);
const recentRow = rows.find((row) => row.id === recentId);
check('eski test işaretlendi', oldRow.clip_deleted_at !== null);
check('yeni test işaretlenmedi', recentRow.clip_deleted_at === null);

// ---------- ikinci tur ----------
const again = await callCleanup(SERVICE);
const againBody = await again.json();
check(
  'ikinci tur aynı klibi tekrar işlemez',
  (againBody.deleted ?? 0) === 0,
  JSON.stringify(againBody),
);

// ---------- sonuçlar duruyor mu ----------
const { data: stillThere } = await admin
  .from('submissions')
  .select('id, received_reviews, thumbnail_paths')
  .eq('id', oldId)
  .single();
check(
  'sonuç satırı ve thumbnail yolları duruyor',
  !!stillThere && stillThere.thumbnail_paths.length === 1,
);

// ---------- temizlik ----------
await admin.auth.admin.deleteUser(owner);

const failures = results.filter((value) => !value).length;
console.log(`\n${results.length - failures}/${results.length} passed`);
process.exit(failures === 0 ? 0 : 1);
