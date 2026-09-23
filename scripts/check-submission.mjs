// Submission akışının uçtan uca kontrolü (B2). Yerel stack gerektirir:
//   pnpm exec supabase start
//   node scripts/check-submission.mjs        (önce db reset yapar; --no-reset ile atlanır)
// Sihirbazın ekranları cihazda test edilir; bu script sunucu tarafını kanıtlar:
// 3 thumbnail + 3 başlık + klip ile submission açılıyor, kredi düşüyor, 8 MB üstü klip reddediliyor.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createClient } = require(
  require.resolve('@supabase/supabase-js', { paths: ['apps/mobile'] }),
);

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
    .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
const API = env.API_URL;
const ANON = env.ANON_KEY;

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const client = createClient(API, ANON, { auth: { persistSession: false } });
const { data: auth, error: authError } = await client.auth.signInWithPassword({
  email: 'alice@clickable.test',
  password: 'password123',
});
if (authError) throw new Error(authError.message);
const userId = auth.user.id;

const balanceOf = async () => {
  const { data } = await client
    .from('profile_balances')
    .select('balance')
    .eq('profile_id', userId)
    .maybeSingle();
  return data?.balance ?? 0;
};

const startingBalance = await balanceOf();
check('alice 5 kredi ile başlıyor', startingBalance === 5, String(startingBalance));

// ---------- 8 MB üstü klip reddedilmeli (kova sınırı, 0004) ----------
const tooBig = Buffer.alloc(9 * 1024 * 1024, 1);
const { error: tooBigError } = await client.storage
  .from('media')
  .upload(`clips/${userId}/too-big.mp4`, tooBig, { contentType: 'video/mp4' });
check('8 MB üstü klip yüklenmiyor', !!tooBigError, tooBigError?.message ?? 'yüklendi!');

// ---------- 3 thumbnail + 3 başlık + klip ----------
const thumbnailPaths = [];
for (let i = 0; i < 3; i += 1) {
  const path = `thumbs/${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await client.storage
    .from('media')
    .upload(path, Buffer.alloc(120 * 1024, i + 1), { contentType: 'image/jpeg' });
  if (error) throw new Error(`thumbnail ${i}: ${error.message}`);
  thumbnailPaths.push(path);
}
const clipPath = `clips/${userId}/${crypto.randomUUID()}.mp4`;
const { error: clipError } = await client.storage
  .from('media')
  .upload(clipPath, Buffer.alloc(3 * 1024 * 1024, 7), { contentType: 'video/mp4' });
check('3 thumbnail + klip yüklendi', !clipError, clipError?.message ?? clipPath);

const titles = ['First title option', 'Second title option', 'Third title option'];
const { data: submissionId, error: createError } = await client.rpc('create_submission', {
  p_title_options: titles,
  p_thumbnail_paths: thumbnailPaths,
  p_clip_path: clipPath,
  p_clip_duration: 47,
  p_requested: 5,
});
check('submission oluşuyor', !createError && !!submissionId, createError?.message ?? submissionId);

const { data: submission } = await client
  .from('submissions')
  .select(
    'title_options, thumbnail_paths, clip_path, requested_reviews, received_reviews, status, clip_duration_seconds',
  )
  .eq('id', submissionId)
  .single();
check(
  'submission 3 başlık ve 3 thumbnail taşıyor',
  submission?.title_options.length === 3 && submission?.thumbnail_paths.length === 3,
  `${submission?.title_options.length} başlık, ${submission?.thumbnail_paths.length} thumbnail`,
);
check(
  'submission açık ve 5 değerlendirme bekliyor',
  submission?.status === 'open' && submission?.requested_reviews === 5,
);

const afterBalance = await balanceOf();
check('bakiye düşüyor (5 → 0)', afterBalance === startingBalance - 5, String(afterBalance));

// ---------- bakiye yetmiyorsa reddediliyor ----------
const { error: secondError } = await client.rpc('create_submission', {
  p_title_options: titles,
  p_thumbnail_paths: thumbnailPaths,
  p_clip_path: clipPath,
  p_clip_duration: 47,
  p_requested: 5,
});
check(
  'bakiye bitince yeni test açılamıyor',
  secondError?.message.includes('insufficient_credits'),
  secondError?.message ?? 'açıldı!',
);

// ---------- iptal temizliği: kendi dosyasını silebiliyor (0005) ----------
const { error: removeError } = await client.storage.from('media').remove([thumbnailPaths[0]]);
const { data: listed } = await client.storage.from('media').list(`thumbs/${userId}`);
check(
  'yarım kalan yükleme silinebiliyor',
  !removeError && !listed?.some((file) => thumbnailPaths[0].endsWith(file.name)),
  removeError?.message ?? '',
);

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed === 0 ? 0 : 1);
