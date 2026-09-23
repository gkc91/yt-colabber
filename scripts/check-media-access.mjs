// Medya erişiminin uçtan uca kontrolü (B1). Yerel stack gerektirir:
//   pnpm exec supabase start
//   pnpm exec supabase functions serve      (ayrı terminalde)
//   node scripts/check-media-access.mjs
// Seed kullanıcılarıyla çalışır (alice = sahip, bob = değerlendirici, cara = yabancı).
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createClient } = require(
  require.resolve('@supabase/supabase-js', { paths: ['apps/mobile'] }),
);

// Her çalıştırma temiz veriyle başlar (seed kullanıcılarının kredisi 5).
if (!process.argv.includes('--no-reset')) {
  console.log('supabase db reset…');
  execFileSync('pnpm', ['db:reset'], { stdio: 'ignore', shell: true, cwd: process.cwd() });
}

const env = Object.fromEntries(
  execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'env'], {
    encoding: 'utf8',
    shell: true,
  })
    .split(/\r?\n/)
    .map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
const API = env.API_URL;
const ANON = env.ANON_KEY;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

async function signIn(email) {
  const client = createClient(API, ANON, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password: 'password123' });
  if (error) throw new Error(`${email}: ${error.message}`);
  return { client, user: data.user, token: data.session.access_token };
}

async function callSignedMedia(token, body) {
  const res = await fetch(`${API}/functions/v1/signed-media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, apikey: ANON, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

const alice = await signIn('alice@clickable.test');
const bob = await signIn('bob@clickable.test');
const cara = await signIn('cara@clickable.test');

// ---------- upload ----------
const thumbBytes = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'); // PNG başlığı, içerik önemsiz
const clipBytes = Buffer.alloc(1024, 7);
const thumbPath = `thumbs/${alice.user.id}/${crypto.randomUUID()}.png`;
const clipPath = `clips/${alice.user.id}/${crypto.randomUUID()}.mp4`;

for (const [path, bytes, type] of [
  [thumbPath, thumbBytes, 'image/png'],
  [clipPath, clipBytes, 'video/mp4'],
]) {
  const { error } = await alice.client.storage
    .from('media')
    .upload(path, bytes, { contentType: type });
  check(`upload ${path.split('/')[0]}`, !error, error?.message ?? path);
}
check(
  'clip yolu media/clips/{uid}/... düzeninde',
  clipPath.split('/')[1] === alice.user.id,
  clipPath,
);

// başkasının klasörüne yazamaz
const { error: foreignError } = await bob.client.storage
  .from('media')
  .upload(`clips/${alice.user.id}/hack.mp4`, clipBytes, { contentType: 'video/mp4' });
check(
  'başkasının klasörüne yükleme reddedilir',
  !!foreignError,
  foreignError?.message ?? 'izin verildi!',
);

// ---------- submission ----------
const { data: submissionId, error: createError } = await alice.client.rpc('create_submission', {
  p_title_options: ['A title for the media check'],
  p_thumbnail_paths: [thumbPath],
  p_clip_path: clipPath,
  p_clip_duration: 30,
  p_requested: 5,
});
check('create_submission', !createError, createError?.message ?? submissionId);

// ---------- signed-media ----------
const ownerCall = await callSignedMedia(alice.token, { submission_id: submissionId });
check(
  'sahip imzalı adres alır',
  ownerCall.status === 200 && !!ownerCall.body.clip,
  `HTTP ${ownerCall.status}`,
);

const strangerCall = await callSignedMedia(cara.token, { submission_id: submissionId });
check(
  'başkası submission için imzalı adres ALAMAZ',
  strangerCall.status === 403,
  `HTTP ${strangerCall.status} ${JSON.stringify(strangerCall.body)}`,
);

const { data: task, error: taskError } = await bob.client.rpc('next_review_task');
const taskId = task?.task?.id;
check('bob görev aldı', !taskError && !!taskId, taskError?.message ?? String(taskId));

const reviewerCall = await callSignedMedia(bob.token, { task_id: taskId });
check(
  'değerlendirici görevi için imzalı adres alır',
  reviewerCall.status === 200 && reviewerCall.body.thumbnails?.length === 1,
  `HTTP ${reviewerCall.status}, ${reviewerCall.body.thumbnails?.length} thumbnail`,
);

const stolenCall = await callSignedMedia(cara.token, { task_id: taskId });
check(
  'başkasının görevi için imzalı adres ALINAMAZ',
  stolenCall.status === 403,
  `HTTP ${stolenCall.status} ${JSON.stringify(stolenCall.body)}`,
);

// imzalı adres gerçekten dosyayı indiriyor mu
const signedClip = ownerCall.body.clip ? `${API}${ownerCall.body.clip}` : '';
const download = signedClip ? await fetch(signedClip) : { status: 0 };
check('imzalı adres dosyayı indiriyor', download.status === 200, `HTTP ${download.status}`);

// imzasız erişim kapalı
const unsigned = await fetch(`${API}/storage/v1/object/media/${clipPath}`);
check(
  'imzasız erişim kapalı',
  unsigned.status === 400 || unsigned.status === 404,
  `HTTP ${unsigned.status}`,
);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length === 0 ? 0 : 1);
