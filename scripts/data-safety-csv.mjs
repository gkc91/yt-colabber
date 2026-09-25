// Play "Veri güvenliği" formunu CSV ile doldurur (E3).
//   node scripts/data-safety-csv.mjs <indirilen-bos.csv> <cikti.csv>
//
// Neden script: form yüzlerce onay kutusu; elle doldurulduğunda hangi satırın neden
// işaretlendiği kaybolur. Cevapların gerekçesi docs/STORE.md §4'te, kuralları burada.
// Tek doğruluk kaynağı: ürünün gerçekte topladığı veri (0001_init.sql, analytics.ts).
import { readFileSync, writeFileSync } from 'node:fs';

const DELETE_URL = 'https://clickabletest.com/delete-account';

/** Topladığımız veri türleri → (zorunlu mu, toplama amaçları). Paylaşım YOK. */
const COLLECTED = {
  PSL_EMAIL: { required: true, purposes: ['PSL_APP_FUNCTIONALITY', 'PSL_ACCOUNT_MANAGEMENT'] },
  PSL_NAME: { required: false, purposes: ['PSL_ACCOUNT_MANAGEMENT'] },
  PSL_PHOTOS: { required: true, purposes: ['PSL_APP_FUNCTIONALITY'] },
  PSL_VIDEOS: { required: true, purposes: ['PSL_APP_FUNCTIONALITY'] },
  PSL_USER_GENERATED_CONTENT: { required: true, purposes: ['PSL_APP_FUNCTIONALITY'] },
  PSL_USER_INTERACTION: { required: true, purposes: ['PSL_ANALYTICS'] },
  PSL_CRASH_LOGS: { required: true, purposes: ['PSL_ANALYTICS'] },
  PSL_DEVICE_ID: {
    required: false,
    purposes: ['PSL_APP_FUNCTIONALITY', 'PSL_FRAUD_PREVENTION_SECURITY'],
  },
  PSL_PURCHASE_HISTORY: { required: false, purposes: ['PSL_APP_FUNCTIONALITY'] },
};

/** Hangi veri türü hangi bölümde işaretlenecek. */
const TYPE_ROWS = new Set(Object.keys(COLLECTED));

const [input, output] = process.argv.slice(2);
const lines = readFileSync(input, 'utf8').split(/\r?\n/);

/** Satırı ilk üç virgüle göre ayır: geri kalanı (etiket) dokunulmadan kalır. */
const parse = (line) => {
  const parts = [];
  let rest = line;
  for (let i = 0; i < 3; i += 1) {
    const at = rest.indexOf(',');
    parts.push(rest.slice(0, at));
    rest = rest.slice(at + 1);
  }
  return { qid: parts[0], rid: parts[1], value: parts[2], rest };
};

let changed = 0;
const out = lines.map((line, index) => {
  if (index === 0 || !line.includes(',')) return line;
  const { qid, rid, rest } = parse(line);
  let value = '';

  if (qid === 'PSL_DATA_COLLECTION_COLLECTS_PERSONAL_DATA') value = 'true';
  else if (qid === 'PSL_DATA_COLLECTION_ENCRYPTED_IN_TRANSIT') value = 'true';
  // Giriş yalnızca sihirli bağlantı (kullanıcı adı + diğer doğrulama) ve Google (OAuth).
  else if (qid === 'PSL_SUPPORTED_ACCOUNT_CREATION_METHODS')
    value = rid === 'PSL_ACM_USER_ID_OTHER_AUTH' || rid === 'PSL_ACM_OAUTH' ? 'true' : 'false';
  else if (qid === 'PSL_SUPPORT_DATA_DELETION_BY_USER')
    value = rid === 'DATA_DELETION_YES' ? 'true' : 'false';
  else if (qid === 'PSL_ACCOUNT_DELETION_URL' || qid === 'PSL_DATA_DELETION_URL')
    value = DELETE_URL;
  else if (qid.startsWith('PSL_DATA_TYPES_')) value = TYPE_ROWS.has(rid) ? 'true' : 'false';
  else if (qid.startsWith('PSL_DATA_USAGE_RESPONSES:')) {
    const [, type, question] = qid.split(':');
    const spec = COLLECTED[type];
    if (!spec) value = '';
    else if (question === 'PSL_DATA_USAGE_COLLECTION_AND_SHARING')
      // Toplanıyor, paylaşılmıyor: Supabase/RevenueCat/PostHog/Sentry bizim adımıza işleyen
      // hizmet sağlayıcıları, Play'in tanımında "paylaşım" değil.
      value = rid === 'PSL_DATA_USAGE_ONLY_COLLECTED' ? 'true' : 'false';
    else if (question === 'PSL_DATA_USAGE_EPHEMERAL') value = 'false';
    else if (question === 'DATA_USAGE_USER_CONTROL')
      value =
        rid ===
        (spec.required
          ? 'PSL_DATA_USAGE_USER_CONTROL_REQUIRED'
          : 'PSL_DATA_USAGE_USER_CONTROL_OPTIONAL')
          ? 'true'
          : 'false';
    else if (question === 'DATA_USAGE_COLLECTION_PURPOSE')
      value = spec.purposes.includes(rid) ? 'true' : 'false';
    else if (question === 'DATA_USAGE_SHARING_PURPOSE') value = 'false';
  }

  if (!value) return line;
  changed += 1;
  return `${qid},${rid},${value},${rest}`;
});

writeFileSync(output, out.join('\r\n'));
console.log(`${changed} satır dolduruldu → ${output}`);
