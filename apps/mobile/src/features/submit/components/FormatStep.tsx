import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/Card';
import { Heading, Small, Title } from '@/components/Type';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { radius, space } from '@/design/tokens';
import { t } from '@/i18n';

import type { ClipFormat } from '../rules';

type Props = {
  format: ClipFormat | null;
  onChange: (format: ClipFormat) => void;
};

/**
 * Sihirbazın ilk adımı. Yön klipten de okunabiliyor ama klip ÜÇÜNCÜ adımda seçiliyor,
 * oysa thumbnail birincide yükleniyor — yönü sonradan öğrenmek, yanlış orandaki bir
 * kapağı kabul edip sonra reddetmek demekti. Önce soruyoruz, klip gelince doğruluyoruz.
 */
export function FormatStep({ format, onChange }: Props) {
  const colors = Colors[useColorScheme()];

  return (
    <View style={styles.container}>
      <Title>{t('submit.wizard.formatTitle')}</Title>
      <Small tone="muted">{t('submit.wizard.formatHint')}</Small>

      <View style={styles.row}>
        {(['horizontal', 'vertical'] as const).map((option) => {
          const selected = format === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              // Chip ile aynı düzeltme (2026-09-30): `accessibilityState.selected` web'e
              // hiç yansımıyordu ve radio'nun doğru niteliği zaten `aria-checked`.
              aria-checked={selected}
              style={styles.option}
              onPress={() => onChange(option)}
            >
              <Card gap={space.md} style={selected ? { borderColor: colors.text } : undefined}>
                {/* Oranın kendisi anlatır: kutunun şekli seçeneğin şekli. */}
                <View
                  style={[
                    styles.shape,
                    option === 'vertical' ? styles.vertical : styles.horizontal,
                    { backgroundColor: selected ? colors.text : colors.border },
                  ]}
                />
                <Heading>{t(`submit.wizard.format.${option}`)}</Heading>
                <Small tone="muted">{t(`submit.wizard.formatWhere.${option}`)}</Small>
              </Card>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.lg,
  },
  row: {
    flexDirection: 'row',
    gap: space.md,
  },
  option: {
    flex: 1,
  },
  shape: {
    borderRadius: radius.button,
    alignSelf: 'center',
  },
  horizontal: {
    width: 96,
    height: 54,
  },
  vertical: {
    width: 40,
    height: 71,
  },
});
