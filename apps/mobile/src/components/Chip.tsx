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
};

/**
 * Seçili chip mürekkep rengi, kırmızı değil: profilde beş niş seçildiğinde sayfa beş
 * kırmızıyla dolmasın. Kırmızı ekranda tek bir yere ait (DESIGN.md §3).
 */
export function Chip({ label, selected, onPress, role = 'radio' }: Props) {
  const colors = Colors[useColorScheme()];

  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={role === 'checkbox' ? { checked: selected } : { selected }}
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
