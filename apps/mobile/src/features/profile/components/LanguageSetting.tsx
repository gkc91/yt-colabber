// Arayüz dili (profil ayarı).
//
// İÇERİK DİLİNDEN AYRI: `profiles.language` hangi videoları değerlendirdiğini belirler ve
// eşleştirmeyi etkiler; bu ayar yalnızca ekrandaki yazının dilidir. İkisini tek ayara
// bağlamak, arayüzünü Türkçeye alan birinin değerlendirme havuzunu da değiştirmek olurdu.
//
// Varsayılan CİHAZIN dili; bu ayar onu ezer. Sadece otomatik olsaydı İngilizce telefon
// kullanıp Türkçe arayüz isteyen kişinin çaresi kalmazdı; sadece ayar olsaydı herkes
// açılışta ayar aramak zorunda kalırdı.
import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { Section } from '@/components/Section';
import { Small } from '@/components/Type';
import { space } from '@/design/tokens';
import { getLocale, LOCALES, t, type Locale } from '@/i18n';
import { chooseLocale } from '@/i18n/localeStorage';

/** Dil adları kendi dillerinde yazılır; çevrilmezler. */
const NAMES: Record<Locale, string> = {
  en: 'English',
  tr: 'Türkçe',
};

export function LanguageSetting() {
  const current = getLocale();

  return (
    <Section title={t('profile.language.title')}>
      <Small tone="muted">{t('profile.language.body')}</Small>
      <View style={styles.chips}>
        {LOCALES.map((locale) => (
          <Chip
            key={locale}
            label={NAMES[locale]}
            // Aynı ekranda içerik dili chip'leri de var ve onlar da "Türkçe" diyor.
            accessibilityLabel={t('profile.language.pick', { language: NAMES[locale] })}
            selected={locale === current}
            onPress={() => {
              void chooseLocale(locale);
            }}
          />
        ))}
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
});
