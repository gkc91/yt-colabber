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
import { Pressable, StyleSheet, View } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { radius } from '@/design/tokens';
import { t } from '@/i18n';

const SIZE = 32;
const ARM = 14;
const THICKNESS = 2;

export function BuyCreditsButton() {
  const colors = Colors[useColorScheme()];
  const bar = { backgroundColor: colors.text };

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
      {/* İç kutu flex ile ortalanıyor (kenarlıktan etkilenmez); kollar onun içinde. */}
      <View style={styles.mark}>
        <View style={[styles.arm, styles.horizontal, bar]} />
        <View style={[styles.arm, styles.vertical, bar]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /*
   * "+" BİR YAZI DEĞİL, İKİ ÇUBUK — ve çubuklar İÇ BİR KUTUNUN içinde (2026-09-30).
   *
   * Üç deneme sürdü, üçü de aynı dersi verdi: ölçmediğin şeyi düzeltmiş sayılmazsın.
   *   1. `Title` ile yazı: `title` ölçeğinin `letterSpacing: -0.6` değeri tek karakterlik
   *      metnin kutusunu sola kaydırıyordu.
   *   2. Kendi ölçüsü olan düz `Text`: tarayıcıda ölçüldü ve "ortalandı" denildi, ama
   *      ÖLÇÜLEN ŞEY METNİN KUTUSUYDU, MÜREKKEBİ DEĞİL. Bir "+" glifi taban çizgisine
   *      göre yerleşir, satır kutusunun ortasına değil.
   *   3. Kutuya göre mutlak konumlanan iki çubuk: mutlak konum KENARLIĞIN İÇİNDEN
   *      başlıyor. `StyleSheet.hairlineWidth` web'de 1 piksel, dolayısıyla her iki kol da
   *      1 dp sağa ve aşağı kaydı — koyu piksellerin ağırlık merkezi ölçüldüğünde yatayda
   *      0.42, dikeyde 0.92 dp sapma çıktı.
   *
   * Şimdiki hâl: iç kutu `alignItems`/`justifyContent` ile ortalanıyor (flex kenarlığı
   * doğru hesaplar), kollar da kenarlığı olmayan o kutunun içinde sabit ofsetlerle
   * duruyor. Fonttan da kenarlıktan da bağımsız.
   */
  mark: {
    width: ARM,
    height: ARM,
  },
  arm: {
    position: 'absolute',
    borderRadius: THICKNESS / 2,
  },
  horizontal: {
    width: ARM,
    height: THICKNESS,
    left: 0,
    top: (ARM - THICKNESS) / 2,
  },
  vertical: {
    width: THICKNESS,
    height: ARM,
    left: (ARM - THICKNESS) / 2,
    top: 0,
  },
});
