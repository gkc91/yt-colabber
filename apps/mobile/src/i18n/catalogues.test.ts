import { describe, expect, it } from 'vitest';

import de from './de.json';
import en from './en.json';
import es from './es.json';
import fr from './fr.json';
import hi from './hi.json';
import pt from './pt.json';
import tr from './tr.json';

/**
 * Bu dosya ikinci (ve yedinci) dilin ASIL bakım maliyetini kapatıyor.
 *
 * Bu projede sürekli yeni metin ekleniyor. Bir anahtar `en.json`'a eklenip ötekilere
 * eklenmezse `t()` sessizce İngilizceye düşer ve kimse fark etmez; üçüncü ayda yarısı
 * İngilizce altı katalog olur. Bunun tek çaresi derlemede düşen bir test.
 */
type Tree = Record<string, unknown>;

const OTHERS: Record<string, Tree> = { tr, es, pt, de, fr, hi };

const keys = (node: Tree, prefix = ''): string[] =>
  Object.entries(node).flatMap(([key, value]) =>
    value && typeof value === 'object'
      ? keys(value as Tree, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );

// BENZERSİZ değişken adları karşılaştırılıyor, kaç kez geçtiği değil: İngilizce
// "You have {balance} {balance:credit|credits}" derken Türkçe "{balance} kredin var"
// diyor — Türkçede sayıdan sonra çoğul eki gelmediği için ikinci kullanım yok ve bu
// bir eksiklik değil, dilin kendisi.
const placeholders = (text: string): string[] =>
  [...new Set([...text.matchAll(/\{(\w+)[:}]/g)].map((match) => match[1]))].sort();

const read = (node: Tree, key: string): unknown =>
  key.split('.').reduce<unknown>((acc, part) => (acc as Tree)?.[part], node);

/**
 * İngilizceyle AYNI kalması doğru olan anahtarlar: marka adları, kısaltmalar, sayı
 * aralıkları ve yalnızca yer tutucudan ibaret olanlar.
 */
const SAME_ON_PURPOSE = new Set([
  'auth.title',
  'auth.emailPlaceholder',
  'onboarding.bands.b0_100',
  'onboarding.bands.b100_1k',
  'onboarding.bands.b1k_10k',
  'onboarding.bands.b10k_100k',
  'onboarding.bands.b100k_plus',
  'credits.loading',
  'submit.wizard.thumbnailNumber',
  'submit.wizard.proOnly',
  'submit.wizard.format.horizontal',
  'submit.wizard.format.vertical',
  'submit.wizard.formatWhere.vertical',
  'paywall.stores.ios',
  'paywall.stores.android',
  'paywall.options.pro_monthly',
  'paywall.options.pro_yearly',
  'profile.collab.bioCount',
  'profile.credits.proTitle',
  'profile.scope.niches',
  'profile.scope.languages',
  'review.done.reward',
]);

/**
 * Dile ÖZGÜ muafiyetler: o dilde İngilizce kelimenin kendisi kullanılıyor.
 *
 * Genel listeye atılmadılar bilerek — "Credits" Almancada doğru ama İspanyolcada
 * çevrilmemiş demektir; genel muafiyet gerçek bir eksiği gizlerdi.
 */
const SAME_PER_LOCALE: Record<string, Set<string>> = {
  // "Collabs", "Thumbnails" ve "Matches" Portekizcede olduğu gibi kullanılıyor.
  pt: new Set([
    'profile.collab.title',
    'results.thumbnails.title',
    'collab.title',
    'collab.matches.title',
  ]),
  // Almanca "Credits", "Reputation", "Collabs", "Thumbnails", "Matches" aynen alır;
  // niş adlarından "Animation", "Gaming" ve "Vlog" da Almancada aynen kullanılıyor.
  de: new Set([
    // "Version" Almancada ve Fransızcada aynı kelime.
    'profile.account.version',
    'profile.account.versionOnly',
    'niches.animation',
    'niches.gaming',
    'niches.vlog',
    'credits.balance',
    'paywall.headerTitle',
    'profile.stats.reputation',
    'profile.collab.title',
    'results.thumbnails.title',
    'collab.title',
    'collab.matches.title',
  ]),
  // Fransızca "Collabs"ı olduğu gibi kullanıyor; "Animation", "Finance" ve "Science"
  // Fransızcada da aynı yazılır.
  fr: new Set([
    'profile.collab.title',
    'collab.title',
    'profile.account.version',
    'profile.account.versionOnly',
    'niches.animation',
    'niches.finance',
    'niches.science',
  ]),
};

const enKeys = keys(en as Tree);

describe.each(Object.entries(OTHERS))('catalogue %s', (name, catalogue) => {
  const theirKeys = keys(catalogue);

  it(`test_${'%s'.replace('%s', name)}_has_every_english_key`, () => {
    const missing = enKeys.filter((key) => !theirKeys.includes(key));
    expect(missing, `${name}.json eksik: ${missing.join(', ')}`).toEqual([]);
  });

  it(`test_${'%s'.replace('%s', name)}_has_no_key_english_does_not`, () => {
    const extra = theirKeys.filter((key) => !enKeys.includes(key));
    expect(extra, `${name}.json fazla: ${extra.join(', ')}`).toEqual([]);
  });

  it(`test_${'%s'.replace('%s', name)}_uses_the_same_placeholders`, () => {
    // Çeviride unutulan bir `{count}` ekranda boşluk bırakır ve testsiz fark edilmez.
    const mismatched = enKeys.filter((key) => {
      const source = read(en as Tree, key);
      const target = read(catalogue, key);
      if (typeof source !== 'string' || typeof target !== 'string') return false;
      return placeholders(source).join(',') !== placeholders(target).join(',');
    });
    expect(mismatched, `${name}: yer tutucuları uyuşmayan: ${mismatched.join(', ')}`).toEqual([]);
  });

  it(`test_${'%s'.replace('%s', name)}_has_nothing_left_untranslated`, () => {
    // Tam kopya bir metin genelde çevrilmeyi unutmuş demektir.
    const allowed = SAME_PER_LOCALE[name] ?? new Set<string>();
    const identical = enKeys.filter(
      (key) =>
        !SAME_ON_PURPOSE.has(key) &&
        !allowed.has(key) &&
        read(en as Tree, key) === read(catalogue, key),
    );
    expect(identical, `${name}: çevrilmemiş olabilir: ${identical.join(', ')}`).toEqual([]);
  });
});
