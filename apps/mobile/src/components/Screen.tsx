// Ekran çerçevesi (DESIGN.md §5): kâğıt zemin, ortalanmış ve 640 dp ile sınırlı içerik.
// Geniş ekranda metin yayılmaz; telefonda kenar boşluğu sabittir.
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { layout, space } from '@/design/tokens';

interface Props {
  children: ReactNode;
  /** Kaydırma gerekmeyen (ortalanmış boş/hata) ekranlar için. */
  center?: boolean;
  gap?: number;
  style?: ViewStyle;
}

export function Screen({ children, center = false, gap = space.xl, style }: Props) {
  const colors = Colors[useColorScheme()];

  if (center) {
    return (
      <View style={[styles.page, styles.center, { backgroundColor: colors.background }, style]}>
        <View style={[styles.frame, { gap }]}>{children}</View>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.scroll, style]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.frame, { gap }]}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  center: {
    justifyContent: 'center',
    paddingHorizontal: layout.gutter,
  },
  scroll: {
    paddingHorizontal: layout.gutter,
    paddingTop: space.xl,
    paddingBottom: space.xxxl,
    alignItems: 'center',
  },
  frame: {
    width: '100%',
    maxWidth: layout.maxWidth,
    alignSelf: 'center',
  },
});
