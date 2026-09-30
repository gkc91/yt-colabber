import en from './en.json';

/**
 * Arayüz metinlerinin dili. Büyük harfe çevirme bu dile göre yapılır, cihazınkine
 * göre değil: Android'de `textTransform: 'uppercase'` cihazın yerel ayarını kullanır
 * ve Türkçe bir telefonda İngilizce "practice" kelimesi "PRACTİCE" olur (i → İ).
 */
export const UI_LOCALE = 'en';

/** Etiketleri büyütmenin tek doğru yolu; stil dosyasında textTransform kullanma. */
export const caps = (text: string): string => text.toLocaleUpperCase(UI_LOCALE);

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
 * biçim yeterli; başka bir dil eklendiğinde burası büyüyecek.
 */
const PLURAL = /\{(\w+):([^|{}]*)\|([^{}]*)\}/g;
const PLACEHOLDER = /\{(\w+)\}/g;

export function t(key: MessageKey, vars?: MessageVars): string {
  let node: unknown = en;
  for (const part of key.split('.')) {
    node = (node as Record<string, unknown>)[part];
  }
  if (typeof node !== 'string') return key;
  if (!vars) return node;
  // Çoğul ÖNCE: içindeki `{name}` yer tutucusu değil, seçim anahtarıdır.
  return node
    .replace(PLURAL, (match, name: string, one: string, other: string) =>
      name in vars ? (Number(vars[name]) === 1 ? one : other) : match,
    )
    .replace(PLACEHOLDER, (match, name: string) => (name in vars ? String(vars[name]) : match));
}
