// `grant_pro_credits` aynı profil için gerçekten sıraya giriyor mu (0042).
//   node scripts/check-pro-grant-lock.mjs
//
// Neden ayrı script: pgTAP tek oturumda çalışıyor, yarış durumu orada gösterilemiyor.
// Burada İKİ eşzamanlı bağlantı açılıyor — A kilidi tutarken B'nin beklemek zorunda
// kaldığı görülüyor. Kilit kaldırılırsa B beklemez, hemen ikinci hibeyi basar ve aynı
// profile 40 kredi iki kez verilir; 2026-09-29'da bu şekilde doğrulandı.
//
// Yereldeki Supabase konteynerine psql ile bağlanır: bu bir veritabanı eşzamanlılık
// özelliği, API üzerinden gözlenemez.
import { execFileSync, spawn } from 'node:child_process';

const CONTAINER = 'supabase_db_clickable';
const PROFILE = 'cc888888-0000-0000-0000-000000000001';
const psql = [
  'exec',
  '-i',
  CONTAINER,
  'psql',
  '-U',
  'postgres',
  '-d',
  'postgres',
  '-q',
  '-t',
  '-A',
];

const run = (sql) => execFileSync('docker', psql, { input: sql, encoding: 'utf8' }).trim();

// ---------- hazırlık ----------
run(`
  insert into auth.users (id, email) values ('${PROFILE}', 'lock@test.local') on conflict do nothing;
  insert into subscriptions (profile_id, tier, active, expires_at)
  values ('${PROFILE}', 'pro', true, now() + interval '30 days')
  on conflict (profile_id) do update set tier='pro', active=true, expires_at=now()+interval '30 days';
  delete from credit_ledger where profile_id='${PROFILE}' and reason='subscription_grant';
`);
if (run(`select is_pro('${PROFILE}')`) !== 't')
  throw new Error('hazırlık başarısız: profil Pro değil');

// ---------- A: kilidi al ve tut ----------
const holder = spawn('docker', psql, { stdio: ['pipe', 'pipe', 'pipe'] });
holder.stdin.end(`begin;
  select grant_pro_credits('${PROFILE}');
  select pg_sleep(10);
rollback;`);

await new Promise((resolve) => setTimeout(resolve, 2500));

// ---------- B: aynı profil için ikinci çağrı ----------
// Hata METNİNE değil SONUCA bakıyoruz. A geri alındığı için onun hibesi kayboluyor;
// geriye kalan satır varsa B hibeyi basabilmiş demektir, yani kilit tutmamış.
//
// (İlk hâli psql'in çıkış kodunu bekliyordu; psql `ON_ERROR_STOP` olmadan SQL hatasında
// sıfır döndürüyor, o yüzden kontrol kilit çalışırken bile "beklemedi" diyordu.)
const started = Date.now();
execFileSync('docker', psql, {
  input: `set statement_timeout = '4s'; select grant_pro_credits('${PROFILE}');`,
  encoding: 'utf8',
});
const waitedMs = Date.now() - started;

holder.kill();
await new Promise((resolve) => setTimeout(resolve, 1000));

const grants = Number(
  run(`select count(*) from credit_ledger
        where profile_id='${PROFILE}' and reason='subscription_grant'`),
);
run(`delete from credit_ledger where profile_id='${PROFILE}' and reason='subscription_grant';`);

if (grants !== 0) {
  console.error(
    `BAŞARISIZ: ikinci çağrı hibeyi bastı (${grants} satır, ${waitedMs} ms bekledi) — yarış açık.`,
  );
  process.exit(1);
}
console.log(`tamam: ikinci çağrı ${waitedMs} ms kilitte bekledi ve hibe basamadı.`);
