import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { t } from '@/i18n';

import { percent, pickRate, winnerIndex, type ThumbnailStat } from '../rules';

type Props = {
  stats: ThumbnailStat[];
  thumbnailUrls: string[];
};

/** Thumbnail başına gösterim, seçilme oranı, ortalama karar süresi, kazanan (PRODUCT §7). */
export function ThumbnailResults({ stats, thumbnailUrls }: Props) {
  const colors = Colors[useColorScheme()];
  const winner = winnerIndex(stats);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{t('results.thumbnails.title')}</Text>
      {stats.length === 0 ? (
        <Text style={[styles.empty, { color: colors.muted }]}>{t('results.noData')}</Text>
      ) : null}

      {stats.map((stat) => (
        <View key={stat.idx} style={[styles.card, { borderColor: colors.border }]}>
          <Image
            source={{ uri: thumbnailUrls[stat.idx] }}
            style={styles.thumbnail}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
          <View style={styles.stats}>
            <View style={styles.rateRow}>
              <Text style={styles.rate}>
                {t('results.thumbnails.rate', { rate: percent(pickRate(stat)) })}
              </Text>
              {winner === stat.idx ? (
                <Text style={[styles.winner, { color: colors.tint }]}>
                  {t('results.thumbnails.winner')}
                </Text>
              ) : null}
            </View>
            <Text style={[styles.detail, { color: colors.muted }]}>
              {t('results.thumbnails.detail', {
                picked: stat.picked,
                shown: stat.shown,
                seconds: ((stat.avg_decision_ms ?? 0) / 1000).toFixed(1),
              })}
            </Text>
          </View>
        </View>
      ))}

      {stats.length > 1 && winner === null ? (
        <Text style={[styles.empty, { color: colors.muted }]}>
          {t('results.thumbnails.noWinner')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
  },
  empty: {
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  thumbnail: {
    width: 120,
    aspectRatio: 16 / 9,
    borderRadius: 8,
  },
  stats: {
    flex: 1,
    gap: 4,
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  rate: {
    fontSize: 22,
    fontWeight: '700',
  },
  winner: {
    fontSize: 13,
    fontWeight: '700',
  },
  detail: {
    fontSize: 13,
  },
});
