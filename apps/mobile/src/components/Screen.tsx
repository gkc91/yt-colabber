// Ekran çerçevesi (DESIGN.md §5): kâğıt zemin, ortalanmış ve 640 dp ile sınırlı içerik.
// Geniş ekranda metin yayılmaz; telefonda kenar boşluğu sabittir.
import type { ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { layout, space } from '@/design/tokens';

interface Props {
  children: ReactNode;
  /** Kaydırma gerekmeyen (ortalanmış boş/hata) ekranlar için. */
  center?: boolean;
  gap?: number;
  style?: ViewStyle;
  /**
   * Ekranın altına SABİTLENEN eylem alanı (CTA).
   *
   * NEDEN (2026-09-29, cihazda bildirildi): CTA'lar kaydırılan içeriğin son elemanıydı,
   * yani içerik kısaysa düğme ekranın ortasında "havada" duruyordu. Buraya verilen içerik
   * akışın dışında, en altta ve sistem çubuğunun ÜSTÜNDE duruyor.
   */
  footer?: ReactNode;
}

/**
 * Boşluğa dokununca klavye kapansın (2026-09-29, iOS'ta hiç kapanmıyordu).
 *
 * `TouchableWithoutFeedback` bilerek: ekstra bir View üretmiyor, yani düzeni bozmuyor.
 * `accessible={false}` de bilerek: bu bir düğme değil, yalnızca boşluğa dokunma jesti —
 * ekran okuyucuya "düğme" diye duyurulursa içeriğin tamamı tek bir kontrol gibi okunur.
 */
function DismissKeyboard({ children }: { children: ReactNode }) {
  return (
    <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
      {children}
    </TouchableWithoutFeedback>
  );
}

export function Screen({ children, center = false, gap = space.xl, style, footer }: Props) {
  const colors = Colors[useColorScheme()];
  const insets = useSafeAreaInsets();

  // Sistem çubuğunun kendi yüksekliği + düğmenin kendi nefes payı. İkisi ayrı: cihazda
  // çubuk yoksa (eski Android, web) yalnızca nefes payı kalır, düğme kenara yapışmaz.
  const footerPad = { paddingBottom: insets.bottom + space.lg };

  const body = center ? (
    <View style={[styles.page, styles.center, { backgroundColor: colors.background }, style]}>
      <View style={[styles.frame, { gap }]}>{children}</View>
    </View>
  ) : (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.scroll, footer ? styles.scrollWithFooter : null, style]}
      keyboardShouldPersistTaps="handled"
      // iOS'ta kaydırmaya başlayınca klavye kapansın; dokunma jestiyle birlikte iki yol.
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
    >
      <View style={[styles.frame, { gap }]}>{children}</View>
    </ScrollView>
  );

  if (!footer) {
    return <DismissKeyboard>{body}</DismissKeyboard>;
  }

  return (
    // Android'de pencere zaten yeniden boyutlanıyor (Expo varsayılanı `resize`), iOS'ta
    // klavye içeriğin üstüne bindiği için yükseklik buradan veriliyor. İkisi de CTA'nın
    // klavyenin ARKASINDA kalmamasını sağlıyor.
    <KeyboardAvoidingView
      style={[styles.page, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <DismissKeyboard>{body}</DismissKeyboard>
      <View
        style={[
          styles.footer,
          { backgroundColor: colors.background, borderTopColor: colors.border },
          footerPad,
        ]}
      >
        <View style={styles.frame}>{footer}</View>
      </View>
    </KeyboardAvoidingView>
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
  // Sabit footer varken alttaki büyük boşluğa gerek yok; footer zaten yer kaplıyor.
  scrollWithFooter: {
    paddingBottom: space.xl,
  },
  footer: {
    paddingHorizontal: layout.gutter,
    paddingTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  frame: {
    width: '100%',
    maxWidth: layout.maxWidth,
    alignSelf: 'center',
  },
});
