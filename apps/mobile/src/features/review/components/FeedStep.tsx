import { Image } from 'expo-image';
import { Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { t } from '@/i18n';

import type { FeedItem } from '../rules';

type Props = {
  items: FeedItem[];
  onPick: (index: number) => void;
};

/** Adım 1 — feed testi: aday, niş videolarının arasında 2 sütunlu ızgarada (PRODUCT §5). */
export function FeedStep({ items, onPick }: Props) {
  const colors = Colors[useColorScheme()];

  return (
    <View style={styles.container}>
      <Text style={styles.question}>{t('review.feed.question')}</Text>
      <View style={styles.grid}>
        {items.map((item, index) => (
          <Pressable
            key={item.kind === 'decoy' ? item.videoId : 'candidate'}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            style={styles.cell}
            onPress={() => onPick(index)}
          >
            <Image
              source={{ uri: item.thumbnailUrl }}
              style={[styles.thumbnail, { borderColor: colors.border }]}
              contentFit="cover"
              transition={100}
              accessibilityIgnoresInvertColors
            />
            <Text style={styles.title} numberOfLines={2}>
              {item.title}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  question: {
    fontSize: 20,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  cell: {
    // 2 sütun
    width: '47%',
    flexGrow: 1,
    gap: 6,
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  title: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
  },
});
