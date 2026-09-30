import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { fonts, layout, radius, space } from '@/design/tokens';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
};

export function Button({ title, onPress, variant = 'primary', disabled, loading }: Props) {
  const colors = Colors[useColorScheme()];
  const inactive = disabled || loading;
  const primary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      /*
       * Kenarlara pay (2026-09-30, sahibi bildirdi: "illa yazıya tıklamam lazım,
       * düğmenin kenarları çalışmıyor"). Görünen kutu zaten 48 dp ama parmak nadiren
       * ortaya iniyor; `hitSlop` dokunma alanını görünenin dışına taşırıyor ve iki
       * düğme arasındaki boşlukta kalan dokunuşları da yakalıyor.
       */
      hitSlop={space.sm}
      style={({ pressed }) => [
        styles.base,
        primary
          ? { backgroundColor: colors.tint }
          : { borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth * 2 },
        (pressed || inactive) && { opacity: 0.6 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? colors.onTint : colors.text} />
      ) : (
        <Text style={[styles.label, { color: primary ? colors.onTint : colors.text }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: layout.minTouch + space.xs,
    borderRadius: radius.button,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    fontFamily: fonts.heading,
    letterSpacing: -0.2,
  },
});
