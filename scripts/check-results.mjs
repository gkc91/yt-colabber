// Sonuç ekranının uçtan uca kontrolü (B5). Yerel stack gerektirir:
//   node scripts/check-results.mjs       (önce db reset yapar; --no-reset ile atlanır)
// 5 değerlendirmeli bir submission kurar, submission_results'ın her bölümünü doldurduğunu
// ve rate_review'in itibarı değiştirdiğini doğrular.
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

async function signIn(email) {
  const client = createClient(API, ANON, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password: 'password123' });
  if (error) throw new Error(`${email}: ${error.message}`);
  return { client, id: data.user.id, email };
}

// ---------- 5 değerlendirici ----------
const { data: animation } = await admin
  .from('niches')
  .select('id')
  .eq('slug', 'animation')
  .single();
for (const name of ['dave', 'erin', 'frank']) {
  const { data: created, error } = await admin.auth.admin.createUser({
    email: `${name}@clickable.test`,
    password: 'password123',
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error && !error.message.includes('already')) throw error;
  if (created?.user) {
    await admin
      .from('profiles')
      .update({ niche_id: animation.id, onboarding_done: true })
      .eq('id', created.user.id);
  }
}

const owner = await signIn('alice@clickable.test');
const reviewers = [];
for (const email of ['bob', 'cara', 'dave', 'erin', 'frank']) {
  reviewers.push(await signIn(`${email}@clickable.test`));
}

// ---------- submission (2 thumbnail, 2 başlık) ----------
const thumbnailPaths = [];
for (let i = 0; i < 2; i += 1) {
  const path = `thumbs/${owner.id}/${crypto.randomUUID()}.jpg`;
  await owner.client.storage
    .from('media')
    .upload(path, Buffer.alloc(60 * 1024, i + 1), { contentType: 'image/jpeg' });
  thumbnailPaths.push(path);
}
const clipPath = `clips/${owner.id}/${crypto.randomUUID()}.mp4`;
await owner.client.storage
  .from('media')
  .upload(clipPath, Buffer.alloc(256 * 1024, 5), { contentType: 'video/mp4' });

const { data: submissionId, error: submissionError } = await owner.client.rpc('create_submission', {
  p_title_options: ['How I animate a stickman fight', 'Stickman animation in 10 minutes'],
  p_thumbnail_paths: thumbnailPaths,
  p_clip_path: clipPath,
  p_clip_duration: 48,
  p_requested: 5,
});
check(
  '5 değerlendirmelik submission açıldı',
  !submissionError,
  submissionError?.message ?? submissionId,
);

// ---------- 5 değerlendirme (farklı çıkış saniyeleri ve etiketler) ----------
const plan = [
  { leave: 4, tags: ['slow_intro'], picked: true, comment: 'Intro is slow.' },
  { leave: 11, tags: ['unclear_promise', 'low_energy'], picked: true, comment: null },
  { leave: null, tags: ['kept_watching'], picked: false, comment: 'Watched it all, good pace.' },
  { leave: 25, tags: ['slow_intro', 'bad_audio'], picked: true, comment: 'Audio is muffled.' },
  { leave: 7, tags: ['didnt_match_thumbnail'], picked: true, comment: null },
];

for (const [index, reviewer] of reviewers.entries()) {
  const { data: assignment } = await reviewer.client.rpc('next_review_task');
  const task = assignment?.task;
  if (!task) {
    check(`${reviewer.email.split('@')[0]}: görev aldı`, false, 'görev yok');
    continue;
  }
  await admin
    .from('review_tasks')
    .update({ assigned_at: new Date(Date.now() - 90_000).toISOString() })
    .eq('id', task.id);

  const step = plan[index];
  const { error } = await reviewer.client.rpc('submit_review', {
    p_task_id: task.id,
    p_picked_candidate: step.picked,
    p_picked_position: task.candidate_position,
    p_decision_ms: 1200 + index * 250,
    p_title_guess: `I expect this video to show ${index + 3} animation steps`,
    p_leave_second: step.leave,
    p_watched_seconds: step.leave ?? 48,
    p_reason_tags: step.tags,
    p_comment: step.comment,
    p_time_spent: 70,
  });
  if (error) check(`${reviewer.email.split('@')[0]}: değerlendirme`, false, error.message);
}

// ---------- sonuçlar ----------
const { data: view, error: viewError } = await owner.client.rpc('submission_results', {
  p_id: submissionId,
});
check('submission_results çalışıyor', !viewError, viewError?.message ?? '');

check(
  '5 değerlendirme geldi',
  view.submission.received_reviews === 5,
  String(view.submission.received_reviews),
);
check('submission tamamlandı', view.submission.status === 'completed', view.submission.status);
check(
  'thumbnail bölümü dolu (ham oy + ağırlık + karar süresi)',
  view.thumbnails.length > 0 &&
    view.thumbnails.every(
      (row) =>
        typeof row.picked === 'number' &&
        typeof row.picked_w === 'number' &&
        typeof row.avg_decision_ms === 'number',
    ),
  JSON.stringify(view.thumbnails.map((r) => ({ idx: r.idx, picked: r.picked, shown: r.shown }))),
);
check('başlık bölümü dolu', view.titles.length > 0, JSON.stringify(view.titles));
check(
  'hook: ayrılma saniyeleri, medyan ve sonuna kadar izleme oranı var',
  view.hook.leave_seconds.length === 4 &&
    view.hook.median_leave !== null &&
    Math.abs(view.hook.finished_ratio - 0.2) < 0.001,
  `${view.hook.leave_seconds.length} ayrılma, medyan ${view.hook.median_leave}, biten ${view.hook.finished_ratio}`,
);
check(
  'hook: etiket dağılımı dolu',
  Object.keys(view.hook.tags).length >= 5 && view.hook.tags.slow_intro === 2,
  JSON.stringify(view.hook.tags),
);
check(
  'yorumlar ve tahminler listeleniyor',
  view.reviews.length === 5 &&
    view.reviews.every((r) => typeof r.title_index === 'number' && !!r.title_guess) &&
    view.reviews.filter((r) => r.comment).length === 3,
  `${view.reviews.length} değerlendirme, ${view.reviews.filter((r) => r.comment).length} yorum`,
);

// ---------- puanlama itibarı değiştiriyor ----------
const first = view.reviews[0];
const reviewerOfFirst = await admin
  .from('reviews')
  .select('reviewer_id')
  .eq('id', first.id)
  .single();
const reputationOf = async () => {
  const { data } = await admin
    .from('profiles')
    .select('reputation')
    .eq('id', reviewerOfFirst.data.reviewer_id)
    .single();
  return Number(data.reputation);
};

const before = await reputationOf();
await owner.client.rpc('rate_review', {
  p_review_id: first.id,
  p_helpful: true,
  p_promise_understood: true,
});
const afterHelpful = await reputationOf();
check(
  'yararlı oyu itibarı +0.05 artırıyor',
  Math.abs(afterHelpful - (before + 0.05)) < 0.001,
  `${before} → ${afterHelpful}`,
);

const second = view.reviews[1];
const secondReviewer = await admin
  .from('reviews')
  .select('reviewer_id')
  .eq('id', second.id)
  .single();
const secondBefore = await admin
  .from('profiles')
  .select('reputation')
  .eq('id', secondReviewer.data.reviewer_id)
  .single();
await owner.client.rpc('rate_review', {
  p_review_id: second.id,
  p_helpful: false,
  p_promise_understood: false,
});
const secondAfter = await admin
  .from('profiles')
  .select('reputation')
  .eq('id', secondReviewer.data.reviewer_id)
  .single();
check(
  'yararsız oyu itibarı −0.10 düşürüyor',
  Math.abs(Number(secondAfter.data.reputation) - (Number(secondBefore.data.reputation) - 0.1)) <
    0.001,
  `${secondBefore.data.reputation} → ${secondAfter.data.reputation}`,
);

const { data: afterRating } = await owner.client.rpc('submission_results', { p_id: submissionId });
check(
  'işaretlemeler sonuçlara yansıyor',
  afterRating.reviews.find((r) => r.id === first.id)?.helpful === true &&
    afterRating.titles.some((row) => row.understood >= 1) &&
    afterRating.titles.some((row) => row.misunderstood >= 1),
  JSON.stringify(afterRating.titles),
);

// başkası sonuçları göremez
const { error: strangerError } = await reviewers[0].client.rpc('submission_results', {
  p_id: submissionId,
});
check(
  'başkası sonuçları göremiyor',
  strangerError?.message.includes('not_owner'),
  strangerError?.message ?? 'gördü!',
);

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed === 0 ? 0 : 1);
