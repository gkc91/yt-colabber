// YEREL GEÇİCİ ÇÖZÜM — `pnpm db:reset` sonrası otomatik çalışır, hosted'a gitmez.
//
// Yerel Postgres imajı storage şemasının yeni sürümünü taşıyor: eski `bucketid_objname`
// tekil indeksi kaldırılmış, yerine kısmi (partial) indeksler gelmiş. Çalışan storage-api
// (1.72.x) ise hâlâ `ON CONFLICT (name, bucket_id)` kullanıyor; kısmi indeksi çıkaramadığı
// için her yükleme 42P10 ile patlıyor. Bu indeks çıkarımı mümkün kılar.
// Supabase CLI imajları hizaladığında bu dosya ve db:reset'teki çağrısı silinmeli.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const projectId = readFileSync('supabase/config.toml', 'utf8').match(/^project_id = "(.+)"/m)?.[1];
const sql =
  'create unique index if not exists bucketid_objname on storage.objects (bucket_id, name);';

try {
  execFileSync(
    'docker',
    [
      'exec',
      `supabase_db_${projectId}`,
      'psql',
      '-U',
      'supabase_admin',
      '-d',
      'postgres',
      '-q',
      '-c',
      sql,
    ],
    {
      stdio: ['ignore', 'ignore', 'pipe'],
    },
  );
  console.log('local storage upload index ensured');
} catch (error) {
  console.warn(
    `Could not ensure the local storage index: ${error.stderr?.toString().trim() || error.message}`,
  );
  console.warn('Uploads may fail locally with error 42P10 until this is applied.');
}
