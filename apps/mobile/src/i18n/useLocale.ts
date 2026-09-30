// Dil değişince ekranların yeniden çizilmesini sağlayan kanca.
//
// `t()` bir hook DEĞİL, düz bir fonksiyon ve 400'den fazla yerde çağrılıyor. Hepsini
// hook'a çevirmek bu kadar çağrıyı yeniden yazmak demekti; onun yerine ağaç dil
// değişince `key` ile yeniden monte ediliyor. Sihirbazın adım sıfırlaması da aynı
// yöntemi kullanıyor (0046) ve orada olduğu gibi burada da avantajı şu: sonradan eklenen
// her ekran kendiliğinden kapsanıyor, güncellenmesi unutulacak bir liste kalmıyor.
import { useEffect, useState } from 'react';

import { getLocale, subscribeToLocale, type Locale } from './index';
import { initLocale } from './localeStorage';

export function useLocale(): { locale: Locale; ready: boolean } {
  const [locale, setLocaleState] = useState<Locale>(getLocale);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    initLocale()
      .then((resolved) => {
        if (alive) setLocaleState(resolved);
      })
      .finally(() => {
        // Dil okunamasa bile uygulama açılmalı: varsayılan İngilizceyle devam eder.
        if (alive) setReady(true);
      });
    const unsubscribe = subscribeToLocale(setLocaleState);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  return { locale, ready };
}
