// BU DOSYA PLATFORMDAN BAĞIMSIZ. `AsyncStorage` ve `expo-localization` bilerek burada
// DEĞİL (bkz. `localeStorage.ts`): ikisi de `react-native`i çekiyor, o da Flow tipli ve
// vitest onu ayrıştıramıyor. İlk denemede buraya konulmuştu ve `t()`'nin bütün testleri
// bir anda kırıldı — çeviri mantığının testsiz kalması, kolaylık için ödenecek bir bedel
// değil.
import de from './de.json';
import en from './en.json';
import es from './es.json';
import fr from './fr.json';
import hi from './hi.json';
import pt from './pt.json';
import tr from './tr.json';

/**
 * Arayüz dilleri. Kabul ettiğimiz İÇERİK dillerini kapsıyor (`features/onboarding/options`):
 * içeriğini kabul ettiğimiz birinin uygulamayı okuyabilmesi gerekir.
 *
 * ARAYÜZ DİLİ İLE İÇERİK DİLİ AYRI ŞEYLER. İçerik dili (`profiles.language`) hangi
 * videoları değerlendirdiğini belirler ve eşleştirmeyi besler; arayüz dili yalnızca
 * cihazda durur (`ui-locale`) ve sunucuya hiç gitmez. Bu yüzden arayüz dili eklemek
 * eşleştirme havuzunu BÖLMEZ — Türk olup İngilizce video yapan biri Türkçe arayüz
 * kullanıp İngilizce havuzda değerlendirilir. TASKS G1'deki "60-100 değerlendirici"
 * barajı İÇERİK dili eklemek için geçerlidir, arayüz dili için değil.
 *
 * Landing (`apps/landing`, LOCALES) yalnızca en+tr konuşuyor; o bir pazarlama kararı ve
 * bu listeyle aynı olmak zorunda değil.
 */
export const LOCALES = ['en', 'tr', 'es', 'pt', 'de', 'fr', 'hi'] as const;
export type Locale = (typeof LOCALES)[number];

const CATALOGUES: Record<Locale, unknown> = { en, tr, es, pt, de, fr, hi };

export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

// Etkin dil MODÜL DÜZEYİNDE tutuluyor, React state'inde değil: `t()` ekranların her
// yerinden düz bir fonksiyon olarak çağrılıyor (400'den fazla yerde) ve hook'a çevirmek
// bu kadar çağrıyı yeniden yazmak demekti. Dil değişince ağaç `key` ile yeniden monte
// ediliyor (`useLocale`), yani ekranlar eski metinle kalmıyor.
let active: Locale = DEFAULT_LOCALE;
const listeners = new Set<(locale: Locale) => void>();

export const getLocale = (): Locale => active;

export function setLocale(locale: Locale): void {
  if (active === locale) return;
  active = locale;
  for (const listener of listeners) listener(locale);
}

export function subscribeToLocale(listener: (locale: Locale) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Etiketleri büyütmenin tek doğru yolu; stil dosyasında `textTransform` kullanma.
 *
 * ETKİN DİLE GÖRE, sabit bir dile göre değil. Android'de `textTransform: 'uppercase'`
 * cihazın yerel ayarını kullanıyor ve Türkçe bir telefonda İngilizce "practice" kelimesi
 * "PRACTİCE" oluyordu; çözüm metnin dilini kullanmaktı. Artık metin gerçekten Türkçe
 * olabildiği için o dil sabit değil: Türkçe "pratik" → "PRATİK" DOĞRUDUR, "PRATIK" değil.
 */
export const caps = (text: string): string => text.toLocaleUpperCase(active);

type Messages = typeof en;

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;

/** Yer tutucular: "{count} reviews" → t('…', { count: 5 }) */
export type MessageVars = Record<string, string | number>;

/**
 * Tekil/çoğul: `{count:credit|credits}` → sayı 1 ise soldaki, değilse sağdaki.
 *
 * NEDEN VAR: bu sözdizimi gelmeden önce metinler "You have {count} credits" diyordu ve
 * bakiyesi 1 olan herkes "1 credits" görüyordu. Aynı hata dört ayrı yerdeydi ("1 days",
 * "1 thumbnails", "1 titles"), yani metni tek tek yeniden yazmak değil, sorunu ortadan
 * kaldırmak gerekiyordu. Tam bir ICU uygulaması değil — İngilizcenin ihtiyacı olan iki
 * biçim yeterli. TÜRKÇEDE SAYIDAN SONRA ÇOĞUL EKİ GELMEZ ("5 kredi"), bu yüzden tr.json
 * bu sözdizimini hiç kullanmıyor; biçim isteğe bağlı olduğu için bu kendiliğinden doğru.
 */
const PLURAL = /\{(\w+):([^|{}]*)\|([^{}]*)\}/g;
const PLACEHOLDER = /\{(\w+)\}/g;

function lookup(catalogue: unknown, key: string): string | null {
  let node: unknown = catalogue;
  for (const part of key.split('.')) {
    if (!node || typeof node !== 'object') return null;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : null;
}

export function t(key: MessageKey, vars?: MessageVars): string {
  // Eksik çeviri İngilizceye düşer: yarım bir katalog, anahtarın kendisini ekrana
  // basmaktan iyidir. `tr` ve `en` anahtarlarının aynı olduğu ayrıca testleniyor.
  const template = lookup(CATALOGUES[active], key) ?? lookup(en, key);
  if (template === null) return key;
  if (!vars) return template;
  // Çoğul ÖNCE: içindeki `{name}` yer tutucusu değil, seçim anahtarıdır.
  return template
    .replace(PLURAL, (match, name: string, one: string, other: string) =>
      name in vars ? (Number(vars[name]) === 1 ? one : other) : match,
    )
    .replace(PLACEHOLDER, (match, name: string) => (name in vars ? String(vars[name]) : match));
}
