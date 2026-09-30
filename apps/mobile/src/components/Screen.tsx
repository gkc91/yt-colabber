// Ekran çerçevesi (DESIGN.md §5): kâğıt zemin, ortalanmış ve 640 dp ile sınırlı içerik.
// Geniş ekranda metin yayılmaz; telefonda kenar boşluğu sabittir.
import type { ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
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
 * Boşluğa dokununca klavye kapansın — ama içeriğin SARMALAYICISI OLARAK DEĞİL.
 *
 * ÖNCEKİ HÂLİ BÜTÜN UYGULAMAYI BOZUYORDU (2026-09-30, sahibi ve testçi bağımsız buldu):
 * bu iş `TouchableWithoutFeedback` ile ScrollView'ı SARARAK yapılıyordu. Sarmalayıcı,
 * çocuklarından önce dokunuşa talip oluyor; sahibinin bulduğu tekrar bunu birebir
 * gösteriyor — "boş bir yere tıklayıp sonra ilk butona tıklayınca çalışmıyor". Boş yere
 * yapılan dokunuş sarmalayıcıyı devreye sokuyor, ondan sonraki ilk dokunuş düğmeye
 * ulaşmıyor, ikincisi ulaşıyor. Şikâyet "bütün butonlarda" diye geldi, çünkü bu bileşen
 * gerçekten bütün ekranların altında.
 *
 * ŞİMDİ KARDEŞ: içeriğin ARKASINDA duran, mutlak konumlu bir katman. Boş yere yapılan
 * dokunuş buraya düşer (üstünde dokunmaya talip hiçbir şey yok), düğmeye yapılan dokunuş
 * düğmeye gider (düğme daha SONRA çiziliyor ve dokunma sırasında öne geçiyor). Hiçbir
 * zaman bir çocuğun dokunuşuna talip olmuyor.
 *
 * `accessible={false}`: bu bir düğme değil, yalnızca bir jest — ekran okuyucuya "düğme"
 * diye duyurulursa içeriğin tamamı tek bir kontrol gibi okunur.
 */
function DismissLayer() {
  return (
    <Pressable accessible={false} style={StyleSheet.absoluteFill} onPress={Keyboard.dismiss} />
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
      /*
       * `flex: 1` ŞART (2026-09-30, cihaz ekran görüntüsünde yakalandı): bu olmadan
       * ScrollView yalnızca İÇERİĞİ kadar yer kaplıyor ve alta sabitlenmesi gereken
       * footer içeriğin hemen altında, ekranın ortasında kalıyor. Web'de fark
       * edilmemişti çünkü React Native Web'in ScrollView'ı kendiliğinden `flexGrow: 1`
       * taşıyor; yerelde taşımıyor. İki platformun aynı görünmesi bu satıra bağlı.
       */
      style={[styles.page, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.scroll, footer ? styles.scrollWithFooter : null, style]}
      keyboardShouldPersistTaps="handled"
      // iOS'ta kaydırmaya başlayınca klavye kapansın; dokunma jestiyle birlikte iki yol.
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
    >
      <DismissLayer />
      <View style={[styles.frame, { gap }]}>{children}</View>
    </ScrollView>
  );

  return (
    /*
     * KLAVYE KORUMASI HER EKRANDA (2026-09-30, cihazda bildirildi).
     *
     * Önceden bu sarmalayıcı YALNIZCA `footer` verilen ekranlarda vardı. Değerlendirme
     * ekranı (`review/[taskId]`) footer kullanmıyor, dolayısıyla hiç korunmuyordu: klavye
     * açılınca metin alanı ve "Next" düğmesi klavyenin ALTINDA kalıyordu. Testçinin üç
     * ayrı şikâyeti de tek bir kök sebepten geliyordu —
     *   "ne yazdığımı göremiyorum"      → alan klavyenin altında,
     *   "ekran daha yukarı kaymıyor"    → kaydırılacak içerik bitmiş, alan hâlâ altta,
     *   "Next ilk basışta çalışmıyor"   → düğme klavyenin altında, ilk dokunuş klavyeye
     *                                     gidip onu kapatıyor, ikincisi düğmeye ulaşıyor.
     *
     * ANDROID'DE `height`, iOS'ta `padding`: Expo'nun klavye rehberindeki eşleşme bu.
     * Buradaki asıl incelik, SDK 53'ten beri Android'de edge-to-edge'in zorunlu olması —
     * pencere artık `adjustResize` ile KÜÇÜLMÜYOR, klavye yüksekliği inset olarak
     * bildiriliyor. Testçinin ekran görüntüsünde hiçbir şeyin kaymamış olması tam olarak
     * bunun kanıtı. Yani işi bu bileşen yapmak zorunda; eski yorumdaki "Android'de pencere
     * zaten yeniden boyutlanıyor" varsayımı artık doğru değildi.
     */
    <KeyboardAvoidingView
      style={[styles.page, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {body}
      {footer ? (
        <View
          style={[
            styles.footer,
            { backgroundColor: colors.background, borderTopColor: colors.border },
            footerPad,
          ]}
        >
          <View style={styles.frame}>{footer}</View>
        </View>
      ) : null}
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
    // İçerik kısa olsa da kapsayıcı ekranı doldursun: klavyeyi kapatan arka plan katmanı
    // (`DismissLayer`) buranın sınırlarını kaplıyor.
    flexGrow: 1,
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
