import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { t, type MessageKey } from '@/i18n';

import { HISTOGRAM_BUCKETS, leaveHistogram, percent, sortedTags, type HookStat } from '../rules';

type Props = { hook: HookStat; clipSeconds: number };

/** Ayrılma histogramı, medyan, sonuna kadar izleme oranı ve etiketler (PRODUCT §7). */
export function HookResults({ hook, clipSeconds }: Props) {
  const colors = Colors[useColorScheme()];
  const buckets = leaveHistogram(hook.leave_seconds, clipSeconds);
  const peak = Math.max(1, ...buckets);
  const bucketSeconds = Math.max(1, Math.round(clipSeconds / HISTOGRAM_BUCKETS));

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{t('results.hook.title')}</Text>

      <View style={styles.summary}>
        <Stat
          label={t('results.hook.finished')}
          value={`${percent(hook.finished_ratio)}%`}
          color={colors.muted}
        />
        <Stat
          label={t('results.hook.median')}
          value={hook.median_leave === null ? '—' : `${Math.round(hook.median_leave)}s`}
          color={colors.muted}
        />
      </View>

      <View style={styles.chart} accessibilityLabel={t('results.hook.chartLabel')}>
        {buckets.map((count, index) => (
          <View key={index} style={styles.barColumn}>
            <View
              style={[
                styles.bar,
                {
                  height: `${(count / peak) * 100}%`,
                  backgroundColor: count > 0 ? colors.tint : colors.border,
                },
              ]}
            />
          </View>
        ))}
      </View>
      <View style={styles.axis}>
        <Text style={[styles.axisLabel, { color: colors.muted }]}>0s</Text>
        <Text style={[styles.axisLabel, { color: colors.muted }]}>
          {t('results.hook.bucket', { seconds: bucketSeconds })}
        </Text>
        <Text style={[styles.axisLabel, { color: colors.muted }]}>{clipSeconds}s</Text>
      </View>

      <Text style={styles.subheading}>{t('results.hook.tags')}</Text>
      {sortedTags(hook.tags).length === 0 ? (
        <Text style={[styles.muted, { color: colors.muted }]}>{t('results.noData')}</Text>
      ) : (
        sortedTags(hook.tags).map(({ tag, count }) => (
          <View key={tag} style={styles.tagRow}>
            <Text style={styles.tagName}>{t(`review.tags.${tag}` as MessageKey)}</Text>
            <Text style={[styles.tagCount, { color: colors.muted }]}>{count}</Text>
          </View>
        ))
      )}
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statLabel, { color }]}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
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
  subheading: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  summary: {
    flexDirection: 'row',
    gap: 24,
  },
  stat: {
    gap: 2,
  },
  statLabel: {
    fontSize: 13,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 96,
  },
  barColumn: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    minHeight: 3,
    borderRadius: 3,
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  axisLabel: {
    fontSize: 12,
  },
  muted: {
    fontSize: 14,
  },
  tagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tagName: {
    fontSize: 15,
  },
  tagCount: {
    fontSize: 15,
    fontWeight: '700',
  },
});
