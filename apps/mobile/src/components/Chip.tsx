import { Pressable, StyleSheet, Text } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { radius, space } from '@/design/tokens';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Çoklu seçimde 'checkbox' verilmeli; tek seçimde radio (varsayılan). */
  role?: 'radio' | 'checkbox';
  /**
   * Görünen etiket yeterince ayırt edici değilse erişilebilirlik adı.
   *
   * Profil ekranında AYNI ekranda iki "Türkçe" chip'i var: biri "Türkçe videoları da
   * değerlendir", diğeri "arayüz Türkçe". Gözle bakan kişi bölüm başlığından ayırıyor;
   * chip'ler arasında gezinen ekran okuyucu kullanıcısı ayıramıyordu.
   */
  accessibilityLabel?: string;
};

/**
 * Seçili chip mürekkep rengi, kırmızı değil: profilde beş niş seçildiğinde sayfa beş
 * kırmızıyla dolmasın. Kırmızı ekranda tek bir yere ait (DESIGN.md §3).
 *
 * SEÇİLİ DURUMU `aria-checked` İLE VERİLİYOR, `accessibilityState` ile değil (2026-09-30).
 * İki ayrı hata vardı: (1) React Native Web `accessibilityState.checked` ve `.selected`
 * alanlarını web'e HİÇ yansıtmıyor — `disabled` yansıyor, bunlar yansımıyor; profil
 * ekranındaki 25 chip'in hiçbirinde `aria-checked` yoktu, yani ekran okuyucu "onay kutusu"
 * diyor ama neyin seçili olduğunu söyleyemiyordu. (2) `radio` için doğru ARIA niteliği
 * `aria-selected` değil `aria-checked`; `aria-selected` option/tab/row içindir. RN 0.86
 * aria-* proplarını hem yerelde hem web'de desteklediği için ikisi tek düzeltmeyle kapandı.
 */
export function Chip({ label, selected, onPress, role = 'radio', accessibilityLabel }: Props) {
  const colors = Colors[useColorScheme()];

  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? label}
      aria-checked={selected}
      onPress={onPress}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: colors.text, borderColor: colors.text }
          : { borderColor: colors.border, backgroundColor: colors.surface },
      ]}
    >
      <Text style={[styles.label, { color: selected ? colors.background : colors.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  label: {
    fontSize: 15,
  },
});
