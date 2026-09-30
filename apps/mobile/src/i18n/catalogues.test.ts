import { describe, expect, it } from 'vitest';

import en from './en.json';
import tr from './tr.json';

/**
 * Bu dosya ikinci dilin ASIL bakım maliyetini kapatıyor.
 *
 * Bu projede sürekli yeni metin ekleniyor. Bir anahtar `en.json`'a eklenip `tr.json`'a
 * eklenmezse `t()` sessizce İngilizceye düşer ve kimse fark etmez; üçüncü ayda yarısı
 * İngilizce bir Türkçe arayüz olur. Bunun tek çaresi derleme zamanında düşen bir test.
 */
type Tree = Record<string, unknown>;

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

describe('i18n catalogues', () => {
  const enKeys = keys(en as Tree);
  const trKeys = keys(tr as Tree);

  it('test_turkish_has_every_english_key', () => {
    const missing = enKeys.filter((key) => !trKeys.includes(key));
    expect(missing, `tr.json eksik: ${missing.join(', ')}`).toEqual([]);
  });

  it('test_turkish_has_no_key_english_does_not', () => {
    const extra = trKeys.filter((key) => !enKeys.includes(key));
    expect(extra, `tr.json fazla: ${extra.join(', ')}`).toEqual([]);
  });

  it('test_both_catalogues_use_the_same_placeholders', () => {
    // Çeviride unutulan bir `{count}` ekranda boşluk bırakır ve testsiz fark edilmez.
    const mismatched = enKeys.filter((key) => {
      const source = read(en as Tree, key);
      const target = read(tr as Tree, key);
      if (typeof source !== 'string' || typeof target !== 'string') return false;
      return placeholders(source).join(',') !== placeholders(target).join(',');
    });
    expect(mismatched, `yer tutucuları uyuşmayan: ${mismatched.join(', ')}`).toEqual([]);
  });

  it('test_no_string_is_left_untranslated_by_accident', () => {
    // Tam kopya bir metin genelde çevrilmeyi unutmuş demektir. Marka adları, kısaltmalar
    // ve sayı aralıkları gibi ÇEVRİLMEMESİ gereken şeyler burada muaf.
    const sameOnPurpose = new Set([
      'auth.title',
      'auth.emailPlaceholder',
      'onboarding.bands.b0_100',
      'onboarding.bands.b100k_plus',
      'credits.loading',
      'submit.wizard.thumbnailNumber',
      'submit.wizard.proOnly',
      'submit.wizard.formatWhere.vertical',
      'paywall.stores.ios',
      'paywall.stores.android',
      'profile.collab.bioCount',
      'profile.credits.proTitle',
    ]);
    const identical = enKeys.filter((key) => {
      if (sameOnPurpose.has(key)) return false;
      return read(en as Tree, key) === read(tr as Tree, key);
    });
    expect(identical, `çevrilmemiş olabilir: ${identical.join(', ')}`).toEqual([]);
  });
});
