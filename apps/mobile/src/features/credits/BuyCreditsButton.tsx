// Bakiyenin yanındaki "+" (2026-09-29).
//
// NEDEN: paywall'a tek giriş, sihirbazın "kredin yetmiyor" uyarısıydı; sonra profile bir
// düğme eklendi ama kredi sayısının GÖRÜLDÜĞÜ yerde hiçbir şey yoktu. "Kredim az" diye
// bakan kişi tam o anda bakiyeye bakıyor — eylem de orada olmalı.
//
// Bilerek küçük ve ikincil: PRODUCT §9'a göre asıl yol değerlendirme vermek, satın alma
// zamanını harcamak istemeyenler için. Ekranın ortasında duran bir "SATIN AL" düğmesi
// ürünün vaadini tersine çevirirdi.
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Title } from '@/components/Type';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { radius } from '@/design/tokens';
import { t } from '@/i18n';

export function BuyCreditsButton() {
  const colors = Colors[useColorScheme()];

  return (
    <Pressable
      accessibilityRole="button"
      // Yalnızca "+" görünüyor; ekran okuyucu için ne yaptığı yazılı olmalı.
      accessibilityLabel={t('credits.buyMore')}
      onPress={() => router.push('/paywall')}
      style={({ pressed }) => [
        styles.button,
        { borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
      ]}
      // Dokunma alanı görünen kutudan geniş: 32 dp'lik bir daire parmak için küçük.
      hitSlop={10}
    >
      <Title style={styles.plus}>+</Title>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plus: {
    lineHeight: 26,
  },
});
