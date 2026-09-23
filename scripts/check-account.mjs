// Hesap silmenin uçtan uca kontrolü (C4). Yerel stack + `supabase functions serve` gerekir.
//   node scripts/check-account.mjs
// Kritik soru: kullanıcı silinince BAŞKALARININ testlerindeki geri bildirim ve sayaçlar bozuluyor mu?
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createClient } = require(
  require.resolve('@supabase/supabase-js', { paths: ['apps/mobile'] }),
);

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
  return { client, id: data.user.id, token: data.session.access_token, email };
}

// ---------- silinecek kullanıcı ----------
const email = `doomed-${Date.now()}@clickable.test`;
const { data: animation } = await admin.from('niches').select('id').eq('slug', 'animation').single();
const { data: created, error: createError } = await admin.auth.admin.createUser({
  email,
  password: 'password123',
  email_confirm: true,
});
if (createError) throw createError;
await admin
  .from('profiles')
  .update({ niche_id: animation.id, onboarding_done: true })
  .eq('id', created.user.id);

const doomed = await signIn(email);
const owner = await signIn('alice@clickable.test');

// ---------- sahibin testi + silinecek kullanıcının değerlendirmesi ----------
const thumbPath = `thumbs/${owner.id}/${crypto.randomUUID()}.jpg`;
const clipPath = `clips/${owner.id}/${crypto.randomUUID()}.mp4`;
await owner.client.storage
  .from('media')
  .upload(thumbPath, Buffer.alloc(40 * 1024, 1), { contentType: 'image/jpeg' });
await owner.client.storage
  .from('media')
  .upload(clipPath, Buffer.alloc(64 * 1024, 2), { contentType: 'video/mp4' });

const { data: submissionId, error: submissionError } = await owner.client.rpc('create_submission', {
  p_title_options: ['A title for the deletion check'],
  p_thumbnail_paths: [thumbPath],
  p_clip_path: clipPath,
  p_clip_duration: 30,
  p_requested: 5,
});
if (submissionError) throw submissionError;

const { data: assignment } = await doomed.client.rpc('next_review_task');
const task = assignment?.task;
check('silinecek kullanıcı görev aldı', !!task, task?.id ?? 'yok');
await admin
  .from('review_tasks')
  .update({ assigned_at: new Date(Date.now() - 90_000).toISOString() })
  .eq('id', task.id);
const { data: reviewId, error: reviewError } = await doomed.client.rpc('submit_review', {
  p_task_id: task.id,
  p_picked_candidate: true,
  p_picked_position: task.candidate_position,
  p_decision_ms: 1500,
  p_title_guess: 'I expect a tutorial about animating characters',
  p_leave_second: 14,
  p_watched_seconds: 14,
  p_reason_tags: ['slow_intro'],
  p_comment: 'The intro drags a little.',
  p_time_spent: 60,
});
check('değerlendirme kaydedildi', !reviewError && !!reviewId, reviewError?.message ?? '');

// silinecek kullanıcının kendi dosyası (silinmeli)
const ownFile = `thumbs/${doomed.id}/${crypto.randomUUID()}.jpg`;
await doomed.client.storage
  .from('media')
  .upload(ownFile, Buffer.alloc(20 * 1024, 3), { contentType: 'image/jpeg' });

// ---------- hesabı sil ----------
const response = await fetch(`${API}/functions/v1/delete-account`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${doomed.token}`,
    apikey: ANON,
    'content-type': 'application/json',
  },
  body: '{}',
});
check('delete-account çalıştı', response.ok, `HTTP ${response.status}`);

// ---------- sonuçlar ----------
const { data: profileRow } = await admin
  .from('profiles')
  .select('id')
  .eq('id', doomed.id)
  .maybeSingle();
check('profil silindi', profileRow === null);

const { data: authUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
check('auth kullanıcısı silindi', !authUsers.users.some((user) => user.email === email));

const { data: review } = await admin
  .from('reviews')
  .select('id, reviewer_id, comment')
  .eq('id', reviewId)
  .maybeSingle();
check('başkasının testindeki değerlendirme duruyor', !!review, review?.comment ?? 'silinmiş!');
check('değerlendirmenin kimliği düştü', review?.reviewer_id === null);

const { data: submission } = await admin
  .from('submissions')
  .select('received_reviews')
  .eq('id', submissionId)
  .single();
check('test sahibinin sayacı bozulmadı', submission.received_reviews === 1, String(submission.received_reviews));

const { data: ownFiles } = await admin.storage.from('media').list(`thumbs/${doomed.id}`);
check('silinen kullanıcının dosyaları temizlendi', (ownFiles ?? []).length === 0, String((ownFiles ?? []).length));

const { data: ownerFiles } = await admin.storage.from('media').list(`thumbs/${owner.id}`);
check('test sahibinin dosyalarına dokunulmadı', (ownerFiles ?? []).length > 0, String((ownerFiles ?? []).length));

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed === 0 ? 0 : 1);
