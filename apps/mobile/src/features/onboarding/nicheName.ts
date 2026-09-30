// Niş adının ekranda görünen hâli.
//
// NEDEN VAR: `niches` tablosunda tek bir `name` sütunu var ve o İngilizce. Hintçe bir
// ekranda "आप English में Animation के टेस्ट देखते हैं" gibi yarı İngilizce bir cümle
// çıkıyordu. Landing bunu çoktan çözmüştü (`nicheName(niche, locale)`), uygulama
// çözmemişti.
//
// MIGRATION YOK, BİLEREK: çeviriler istemcide duruyor. Sütunu dile göre çoğaltmak yedi
// sütun ya da ayrı bir tablo demekti ve bu veri hiç değişmiyor — on beş satır, iki yılda
// bir kez dokunulur. Yeni bir niş çevirisiz eklenirse ekranda veritabanındaki İngilizce
// adı görünür; bu yarım bir çeviri değil, anlaşılır bir yedek.
import { t, type MessageKey } from '@/i18n';
import en from '@/i18n/en.json';

const KNOWN = new Set(Object.keys(en.niches));

export function nicheName(slug: string | null | undefined, fallback: string): string {
  if (!slug || !KNOWN.has(slug)) return fallback;
  return t(`niches.${slug}` as MessageKey);
}
