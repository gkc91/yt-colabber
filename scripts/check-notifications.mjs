// Bildirim kuyruğunun uçtan uca kontrolü (C2). Yerel stack + `supabase functions serve` gerekir.
//   node scripts/check-notifications.mjs
// Expo'ya gerçek istek atmaz: sahte bir push sunucusu açar ve EXPO_PUSH_URL ile ona yönlendirir.
// Bu yüzden fonksiyonu şu şekilde çalıştır:
//   pnpm exec supabase functions serve --env-file supabase/functions/.env.local
// (.env.local içinde: EXPO_PUSH_URL=http://host.docker.internal:8790/push)
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
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
const admin = createClient(API, env.SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

// ---------- sahte Expo push sunucusu ----------
const received = [];
const pushServer = createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    const messages = JSON.parse(body || '[]');
    received.push(...messages);
    // Expo biçimi: her mesaj için bir ticket. İkinci token'ı bilinçli olarak reddediyoruz.
    const data = messages.map((message) =>
      message.to.includes('[gone]')
        ? { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } }
        : { status: 'ok', id: crypto.randomUUID() },
    );
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ data }));
  });
});
await new Promise((resolve) => pushServer.listen(8790, resolve));

// ---------- veri ----------
const { data: niche } = await admin.from('niches').select('id').eq('slug', 'animation').single();
const users = {};
for (const name of ['push-owner', 'push-live', 'push-gone']) {
  const email = `${name}@clickable.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: 'password123',
    email_confirm: true,
  });
  if (error && !error.message.includes('already')) throw error;

  // Kullanıcı önceki çalıştırmadan kalmış olabilir; kimliği e-postadan bul.
  const id =
    data?.user?.id ??
    (await admin.auth.admin.listUsers({ page: 1, perPage: 200 })).data.users.find(
      (user) => user.email === email,
    )?.id;
  if (!id) throw new Error(`kullanıcı bulunamadı: ${email}`);
  users[name] = id;
  await admin
    .from('profiles')
    .update({
      niche_id: niche.id,
      onboarding_done: true,
      expo_push_token:
        name === 'push-live'
          ? 'ExponentPushToken[live]'
          : name === 'push-gone'
            ? 'ExponentPushToken[gone]'
            : null,
    })
    .eq('id', id);
}

await admin.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
const { error: queueError } = await admin.from('notifications').insert([
  { profile_id: users['push-live'], kind: 'tasks_waiting', payload: {} },
  { profile_id: users['push-gone'], kind: 'tasks_waiting', payload: {} },
  { profile_id: users['push-owner'], kind: 'test_completed', payload: { received: 5 } },
]);
if (queueError) throw queueError;

// ---------- fonksiyonu çağır ----------
const response = await fetch(`${API}/functions/v1/notify`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`,
    'content-type': 'application/json',
  },
  body: '{}',
});
const summary = await response.json();
check('notify çalıştı', response.ok, JSON.stringify(summary));
check('bir bildirim gönderildi', summary.sent === 1, `sent=${summary.sent}`);
check('token olmayan kullanıcı atlandı', summary.skipped === 1, `skipped=${summary.skipped}`);
check('gecersiz token hata olarak sayildi', summary.failed === 1, `failed=${summary.failed}`);

check(
  'Expoya dogru mesaj gitti',
  received.length === 2 && received.every((m) => m.title && m.body && m.data?.kind),
  JSON.stringify(received.map((m) => m.title)),
);

const { data: rows } = await admin
  .from('notifications')
  .select('kind, sent_at, error, profile_id')
  .order('created_at');
const live = rows.find((r) => r.profile_id === users['push-live']);
const gone = rows.find((r) => r.profile_id === users['push-gone']);
const noToken = rows.find((r) => r.profile_id === users['push-owner']);

check('gönderilen satır kapatıldı', !!live.sent_at && !live.error, JSON.stringify(live));
check(
  'tokensiz satir kapatildi (kuyrukta birikmez)',
  !!noToken.sent_at && noToken.error === 'no_push_token',
);
check('silinmiş cihazın satırı kapatıldı', !!gone.sent_at && gone.error === 'DeviceNotRegistered');

const { data: goneProfile } = await admin
  .from('profiles')
  .select('expo_push_token')
  .eq('id', users['push-gone'])
  .single();
check('silinmis cihazin tokeni temizlendi', goneProfile.expo_push_token === null);

// ikinci çağrı: kuyruk boş
const again = await (
  await fetch(`${API}/functions/v1/notify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
    },
    body: '{}',
  })
).json();
check('ikinci çağrıda gönderilecek bir şey kalmadı', again.sent === 0, JSON.stringify(again));

pushServer.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed === 0 ? 0 : 1);
