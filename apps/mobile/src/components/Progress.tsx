// İlerleme çubuğu: kaç değerlendirme geldi, kaç istendi. Dekorasyon değil — testin
// durumunu bir bakışta okutan tek şey (DESIGN.md §8: hareket/görsel anlam taşıyorsa vardır).
import { StyleSheet, View } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

export function Progress({ done, total }: { done: number; total: number }) {
  const colors = Colors[useColorScheme()];
  const ratio = total > 0 ? Math.min(1, done / total) : 0;
  const complete = done >= total && total > 0;

  return (
    <View
      style={[styles.track, { backgroundColor: colors.border }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: done }}
    >
      <View
        style={[
          styles.fill,
          { width: `${ratio * 100}%`, backgroundColor: complete ? colors.positive : colors.text },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 3,
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
