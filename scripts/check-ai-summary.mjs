// AI özetinin uçtan uca kontrolü (D3). Yerel stack + funcs gerekir:
//   pnpm exec supabase functions serve --env-file supabase/functions/local-test.vars
//   node scripts/check-ai-summary.mjs
//
// Model çağrısı sahte bir uca gider (ANTHROPIC_BASE_URL), yani bu kontrol gerçek para
// harcamaz. Sorular: Pro olmayan alabiliyor mu, az veriyle üretiliyor mu, iki kez
// çağırınca model iki kez çalışıyor mu, model hata verince kullanıcının hakkı yanıyor mu.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
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
const admin = createClient(API, env.SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

// ---------- sahte Anthropic ----------
const SUMMARY_TEXT = '- Thumbnail B leads 8 to 4.\nHighest-impact change: cut the intro.';
let modelCalls = 0;
let failNext = false;

const fakeAnthropic = createServer((req, res) => {
  modelCalls += 1;
  if (failNext) {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'overloaded' } }));
    return;
  }
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ content: [{ type: 'text', text: SUMMARY_TEXT }] }));
});
await new Promise((resolve) => fakeAnthropic.listen(8791, resolve));

// ---------- arrange ----------
const email = `summary-${Date.now()}@clickable.test`;
const { data: niche } = await admin.from('niches').select('id').eq('slug', 'animation').single();
const { data: created, error: createError } = await admin.auth.admin.createUser({
  email,
  password: 'password123',
  email_confirm: true,
});
if (createError) throw createError;
const owner = created.user.id;
await admin.from('profiles').update({ niche_id: niche.id, onboarding_done: true }).eq('id', owner);

const { data: submission, error: submissionError } = await admin
  .from('submissions')
  .insert({
    owner_id: owner,
    niche_id: niche.id,
    title_options: ['How I fixed the thing'],
    thumbnail_paths: [`thumbs/${owner}/a.jpg`],
    clip_path: `clips/${owner}/a.mp4`,
    clip_duration_seconds: 45,
    requested_reviews: 15,
    received_reviews: 12,
  })
  .select('id')
  .single();
if (submissionError) throw submissionError;

// 12 sentetik değerlendirme (sonuç JSON'u boş olmasın)
await admin.from('reviews').insert(
  Array.from({ length: 12 }, (_, index) => ({
    submission_id: submission.id,
    thumbnail_index: 0,
    title_index: 0,
    picked_candidate: index % 3 === 0,
    picked_position: index % 6,
    decision_ms: 1200 + index * 10,
    title_guess: 'A repair video about a broken thing',
    leave_second: index % 2 === 0 ? 14 : null,
    watched_seconds: index % 2 === 0 ? 14 : 45,
    reason_tags: ['slow_intro'],
    time_spent_seconds: 45,
  })),
);

const client = createClient(API, ANON, { auth: { persistSession: false } });
const { data: signIn, error: signInError } = await client.auth.signInWithPassword({
  email,
  password: 'password123',
});
if (signInError) throw signInError;
const token = signIn.session.access_token;

const ask = () =>
  fetch(`${API}/functions/v1/ai-summary`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: ANON,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ submission_id: submission.id }),
  });

const summaryOf = async () => {
  const { data } = await admin
    .from('submissions')
    .select('ai_summary')
    .eq('id', submission.id)
    .single();
  return data.ai_summary;
};

// ---------- Pro olmayan ----------
const free = await ask();
check('Pro olmayan özet alamaz', free.status === 402, `HTTP ${free.status}`);
check('Pro olmayan için model çağrılmaz', modelCalls === 0, String(modelCalls));

// Pro yap
await admin.from('subscriptions').insert({
  profile_id: owner,
  tier: 'pro',
  active: true,
  expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
  source: 'test',
});

// ---------- az veri ----------
await admin.from('submissions').update({ received_reviews: 3 }).eq('id', submission.id);
const thin = await ask();
check('az değerlendirmeyle üretilmez', thin.status === 409, `HTTP ${thin.status}`);
check('az veride model çağrılmaz', modelCalls === 0, String(modelCalls));
await admin.from('submissions').update({ received_reviews: 12 }).eq('id', submission.id);

// ---------- model hatası ----------
failNext = true;
const failed = await ask();
check('model hatasında 502 döner', failed.status === 502, `HTTP ${failed.status}`);
check('model hatasında özet yazılmaz', (await summaryOf()) === null);
const { data: afterFailure } = await admin
  .from('ai_summary_runs')
  .select('id')
  .eq('submission_id', submission.id);
check('model hatası kullanıcının hakkını yakmaz', (afterFailure ?? []).length === 0);
failNext = false;

// ---------- başarılı üretim ----------
const ok = await ask();
const okBody = await ok.json();
check('özet üretilir', ok.ok && okBody.summary === SUMMARY_TEXT, `HTTP ${ok.status}`);
check('özet veritabanına yazılır', (await summaryOf()) === SUMMARY_TEXT);
check('hak kaydı kalır (kota düşer)', modelCalls === 2, `model çağrısı: ${modelCalls}`);

// ---------- önbellek ----------
const again = await ask();
const againBody = await again.json();
check('ikinci istek önbellekten döner', againBody.cached === true);
check('önbellekte model tekrar çağrılmaz', modelCalls === 2, `model çağrısı: ${modelCalls}`);

// ---------- başkasının testi ----------
const strangerEmail = `stranger-${randomUUID()}@clickable.test`;
const { data: stranger } = await admin.auth.admin.createUser({
  email: strangerEmail,
  password: 'password123',
  email_confirm: true,
});
const strangerClient = createClient(API, ANON, { auth: { persistSession: false } });
const { data: strangerSession } = await strangerClient.auth.signInWithPassword({
  email: strangerEmail,
  password: 'password123',
});
const forbidden = await fetch(`${API}/functions/v1/ai-summary`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${strangerSession.session.access_token}`,
    apikey: ANON,
    'content-type': 'application/json',
  },
  body: JSON.stringify({ submission_id: submission.id }),
});
check('başkasının testine özet çıkarılamaz', forbidden.status === 403, `HTTP ${forbidden.status}`);

// ---------- temizlik ----------
await admin.auth.admin.deleteUser(owner);
await admin.auth.admin.deleteUser(stranger.user.id);
fakeAnthropic.close();

const failures = results.filter((value) => !value).length;
console.log(`\n${results.length - failures}/${results.length} passed`);
process.exit(failures === 0 ? 0 : 1);
