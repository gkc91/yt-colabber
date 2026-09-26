// Rapor ritmi (DESIGN.md §4): başlık, altında tek saç teli çizgi, sonra içerik.
// Her bölüm aynı şekilde açılır; göz sayfayı tarayarak okuyabilsin.
import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Rule } from '@/components/Card';
import { Heading, Meta } from '@/components/Type';
import { space } from '@/design/tokens';

export function Section({
  title,
  note,
  children,
  gap = space.md,
  style,
}: {
  title: string;
  /** Başlığın sağındaki sessiz sayaç/etiket — varsa. */
  note?: string;
  children: ReactNode;
  gap?: number;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.section, style]}>
      <View style={styles.header}>
        <Heading style={styles.title}>{title}</Heading>
        {note ? <Meta>{note}</Meta> : null}
      </View>
      <Rule />
      <View style={{ gap }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: space.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  // Satırda büyüyecek metne genişliğini AÇIKÇA vermek gerekiyor. Yoksa Android
  // ölçümü dar çıkarıyor, başlık ikinci satıra taşıyor ve satır yüksekliği baseline'a
  // göre olduğu için o satır kırpılıyor: "Also review" ekranda "Also" görünüyordu.
  // Web'de aynı düzen sorunsuz çizdiği için önizlemede fark edilmiyor.
  title: {
    flex: 1,
  },
});
