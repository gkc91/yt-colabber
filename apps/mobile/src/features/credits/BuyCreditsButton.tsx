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
import { Pressable, StyleSheet, Text } from 'react-native';

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
      <Text style={[styles.plus, { color: colors.text }]}>+</Text>
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
  /*
   * "+" ARTIK `Title` DEĞİL, kendi ölçüsü olan düz bir metin (sahibi işaretin dairenin
   * içinde ortalı olmadığını bildirdi). İki sebep vardı ve ikisi de tipografi ölçeğinden
   * geliyordu: `title` ölçeği `letterSpacing: -0.6` taşıyor ve harf aralığı SON harften
   * SONRA da uygulandığı için tek karakterlik bir metnin kutusu sola kayıyor; ayrıca
   * 28 punto yazıya elle verilen `lineHeight: 26` metni kutusunun dışına taşırıyordu.
   * Burada aralık sıfır, satır yüksekliği düğmenin kendi yüksekliği ve Android'in font
   * dolgusu kapalı — üçü birden olmadan ortalama güvenilir değil.
   */
  plus: {
    fontSize: 22,
    lineHeight: 32,
    fontWeight: '600',
    letterSpacing: 0,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
