// Değerlendirme akışının uçtan uca kontrolü (B4). Yerel stack gerektirir:
//   node scripts/check-review.mjs        (önce db reset yapar; --no-reset ile atlanır)
// Üç kullanıcı aynı submission'ı değerlendirir; received_reviews 3 olmalı.
// Not: 20 sn kuralını beklememek için görevlerin assigned_at'i service role ile geri alınır
// (yalnızca yerel kontrol; sunucu kuralı 001_credits.sql'de ayrıca test ediliyor).
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
const admin = createClient(API, env.SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

async function signIn(email, password = 'password123') {
  const client = createClient(API, ANON, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`${email}: ${error.message}`);
  return { client, id: data.user.id, email };
}

const balanceOf = async (user) => {
  const { data } = await user.client
    .from('profile_balances')
    .select('balance')
    .eq('profile_id', user.id)
    .maybeSingle();
  return data?.balance ?? 0;
};

// ---------- üçüncü değerlendirici (seed'de 3 kullanıcı var, biri sahibi) ----------
const { data: created, error: createUserError } = await admin.auth.admin.createUser({
  email: 'dave@clickable.test',
  password: 'password123',
  email_confirm: true,
  user_metadata: { full_name: 'Dave' },
});
if (createUserError && !createUserError.message.includes('already')) throw createUserError;
if (created?.user) {
  const { data: animation } = await admin
    .from('niches')
    .select('id')
    .eq('slug', 'animation')
    .single();
  await admin
    .from('profiles')
    .update({ niche_id: animation.id, onboarding_done: true })
    .eq('id', created.user.id);
}

const owner = await signIn('alice@clickable.test');
const reviewers = [
  await signIn('bob@clickable.test'),
  await signIn('cara@clickable.test'),
  await signIn('dave@clickable.test'),
];

// ---------- submission ----------
const thumbnailPaths = [];
for (let i = 0; i < 2; i += 1) {
  const path = `thumbs/${owner.id}/${crypto.randomUUID()}.jpg`;
  await owner.client.storage
    .from('media')
    .upload(path, Buffer.alloc(80 * 1024, i + 1), { contentType: 'image/jpeg' });
  thumbnailPaths.push(path);
}
const clipPath = `clips/${owner.id}/${crypto.randomUUID()}.mp4`;
await owner.client.storage
  .from('media')
  .upload(clipPath, Buffer.alloc(512 * 1024, 3), { contentType: 'video/mp4' });

const { data: submissionId, error: submissionError } = await owner.client.rpc('create_submission', {
  p_title_options: ['First title option', 'Second title option'],
  p_thumbnail_paths: thumbnailPaths,
  p_clip_path: clipPath,
  p_clip_duration: 45,
  p_requested: 5,
});
check(
  'submission açıldı',
  !submissionError && !!submissionId,
  submissionError?.message ?? submissionId,
);

// ---------- üç değerlendirme ----------
for (const reviewer of reviewers) {
  const before = await balanceOf(reviewer);

  const { data: assignment, error: taskError } = await reviewer.client.rpc('next_review_task');
  const task = assignment?.task;
  check(
    `${reviewer.email.split('@')[0]}: görev aldı`,
    !taskError && !!task,
    taskError?.message ?? '',
  );
  check(
    `${reviewer.email.split('@')[0]}: başlık ve 5 decoy geldi`,
    !!assignment?.title && assignment.task.decoys.length === 5,
    `${assignment?.title ?? '-'} · ${assignment?.task?.decoys?.length ?? 0} decoy`,
  );

  // kanal bağlantısı değerlendirme ÖNCESİ kapalı olmalı
  const { error: earlyChannelError } = await reviewer.client.rpc('reviewed_channel', {
    p_submission_id: submissionId,
  });
  check(
    `${reviewer.email.split('@')[0]}: kanal bağlantısı gönderimden önce kapalı`,
    earlyChannelError?.message.includes('no_access'),
    earlyChannelError?.message ?? 'açık!',
  );

  await admin
    .from('review_tasks')
    .update({ assigned_at: new Date(Date.now() - 60_000).toISOString() })
    .eq('id', task.id);

  const { data: reviewId, error: reviewError } = await reviewer.client.rpc('submit_review', {
    p_task_id: task.id,
    p_picked_candidate: true,
    p_picked_position: task.candidate_position,
    p_decision_ms: 1800,
    p_title_guess: 'I expect a short animation tutorial for beginners',
    p_leave_second: 18,
    p_watched_seconds: 18,
    p_reason_tags: ['slow_intro'],
    p_comment: 'Clear enough, but the intro drags.',
    p_time_spent: 55,
  });
  check(
    `${reviewer.email.split('@')[0]}: değerlendirme kaydedildi`,
    !reviewError && !!reviewId,
    reviewError?.message ?? '',
  );
  check(
    `${reviewer.email.split('@')[0]}: +1 kredi`,
    (await balanceOf(reviewer)) === before + 1,
    `${before} → ${await balanceOf(reviewer)}`,
  );

  const { data: channel } = await reviewer.client.rpc('reviewed_channel', {
    p_submission_id: submissionId,
  });
  check(
    `${reviewer.email.split('@')[0]}: gönderimden sonra kanal bağlantısı geliyor`,
    channel?.youtube_url === 'https://www.youtube.com/@alice-animates',
    channel?.youtube_url ?? '-',
  );
}

// ---------- sonuç ----------
const { data: submission } = await owner.client
  .from('submissions')
  .select('received_reviews, status')
  .eq('id', submissionId)
  .single();
check(
  'received_reviews = 3',
  submission?.received_reviews === 3,
  String(submission?.received_reviews),
);
check('submission hâlâ açık (5 isteniyordu)', submission?.status === 'open', submission?.status);

const { count } = await admin
  .from('reviews')
  .select('id', { count: 'exact', head: true })
  .eq('submission_id', submissionId);
check('3 farklı değerlendirme satırı', count === 3, String(count));

// aynı kişi ikinci kez değerlendiremez
const { data: repeat } = await reviewers[0].client.rpc('next_review_task');
check(
  'aynı submission aynı kişiye ikinci kez verilmiyor',
  repeat?.task === null,
  JSON.stringify(repeat?.task ?? null).slice(0, 40),
);

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed === 0 ? 0 : 1);
