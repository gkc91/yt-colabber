// Dil tercihinin cihazla konuşan tarafı (AsyncStorage + expo-localization).
//
// `index.ts`'ten AYRI: ikisi de `react-native`i çekiyor, o da Flow tipli ve vitest onu
// ayrıştıramıyor. Çeviri mantığı (`t`, `caps`) testsiz kalmasın diye sınır burada.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';

import { DEFAULT_LOCALE, isLocale, setLocale, type Locale } from './index';

const STORAGE_KEY = 'ui-locale';

/** Cihazın dili: `tr-TR` → `tr`. Tanımadığımız bir dil İngilizceye düşer. */
export function deviceLocale(): Locale {
  try {
    for (const locale of getLocales()) {
      const code = (locale.languageCode ?? '').toLowerCase();
      if (isLocale(code)) return code;
    }
  } catch {
    // Web export'un sunucu tarafı render'ında `getLocales` yok.
  }
  return DEFAULT_LOCALE;
}

/**
 * Açılışta bir kez: kayıtlı tercih varsa o, yoksa cihazın dili.
 *
 * Kayıtlı tercih CİHAZ DİLİNİ EZER: İngilizce telefon kullanıp arayüzü Türkçe isteyen
 * (ya da tersi) biri var ve tercihi her açılışta silinmemeli.
 */
export async function initLocale(): Promise<Locale> {
  let stored: string | null = null;
  try {
    stored = await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    // Depolama okunamazsa cihaz diliyle devam.
  }
  const locale = isLocale(stored) ? stored : deviceLocale();
  setLocale(locale);
  return locale;
}

/** Kullanıcının seçimi: hem etkin dili değiştirir hem kalıcılaştırır. */
export async function chooseLocale(locale: Locale): Promise<void> {
  setLocale(locale);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Kaydedilemezse uygulama yine o dilde çalışır, sadece kalıcı olmaz.
  }
}
