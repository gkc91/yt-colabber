// Kart: gölge yok, saç teli çizgi var (DESIGN.md §3). Katmanı çizgi ve zemin farkı taşır.
import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { radius, space } from '@/design/tokens';

export function Card({
  children,
  gap = space.md,
  style,
}: {
  children: ReactNode;
  gap?: number;
  style?: ViewStyle;
}) {
  const colors = Colors[useColorScheme()];
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, gap },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Bölümler arasındaki tek çizgi; başlık + çizgi, rapor ritmi. */
export function Rule({ style }: { style?: ViewStyle }) {
  const colors = Colors[useColorScheme()];
  return <View style={[styles.rule, { backgroundColor: colors.border }, style]} />;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.card,
    padding: space.lg,
  },
  rule: {
    height: StyleSheet.hairlineWidth * 2,
    width: '100%',
  },
});
