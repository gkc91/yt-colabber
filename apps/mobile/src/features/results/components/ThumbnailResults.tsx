import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/Card';
import { Section } from '@/components/Section';
import { Meta, Small, Stat } from '@/components/Type';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { radius, space } from '@/design/tokens';
import { t } from '@/i18n';

import { percent, pickRate, winnerIndex, type ThumbnailStat } from '../rules';

type Props = {
  stats: ThumbnailStat[];
  thumbnailUrls: string[];
};

/** Thumbnail başına gösterim, seçilme oranı, ortalama karar süresi, kazanan (PRODUCT §7). */
export function ThumbnailResults({ stats, thumbnailUrls }: Props) {
  const winner = winnerIndex(stats);

  return (
    <Section title={t('results.thumbnails.title')}>
      {stats.length === 0 ? <Small tone="muted">{t('results.noData')}</Small> : null}

      {stats.map((stat) => (
        <Card key={stat.idx} style={styles.card} gap={space.lg}>
          <Image
            source={{ uri: thumbnailUrls[stat.idx] }}
            style={styles.thumbnail}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
          <View style={styles.stats}>
            <Stat
              value={`${percent(pickRate(stat))}%`}
              label={t('results.thumbnails.clicked')}
              tone={winner === stat.idx ? 'positive' : 'ink'}
            />
            {winner === stat.idx ? <WinnerBadge /> : null}
            <Meta>
              {t('results.thumbnails.detail', {
                picked: stat.picked,
                shown: stat.shown,
                seconds: ((stat.avg_decision_ms ?? 0) / 1000).toFixed(1),
              })}
            </Meta>
          </View>
        </Card>
      ))}

      {stats.length > 1 && winner === null ? (
        <Small tone="muted">{t('results.thumbnails.noWinner')}</Small>
      ) : null}
    </Section>
  );
}

/** Kazanan rozeti: dolgu değil, çerçeve. Sayfada tek "işe yarıyor" işareti. */
function WinnerBadge() {
  const colors = Colors[useColorScheme()];
  return (
    <View style={[styles.badge, { borderColor: colors.positive }]}>
      <Meta tone="positive" style={styles.badgeLabel}>
        {t('results.thumbnails.winner')}
      </Meta>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnail: {
    width: 120,
    aspectRatio: 16 / 9,
    borderRadius: radius.button,
  },
  stats: {
    flex: 1,
    gap: space.sm,
    alignItems: 'flex-start',
  },
  badge: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 2,
  },
  badgeLabel: {
    textTransform: 'uppercase',
  },
});
