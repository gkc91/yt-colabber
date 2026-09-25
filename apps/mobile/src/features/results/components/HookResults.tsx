import { StyleSheet, View } from 'react-native';

import { Rule } from '@/components/Card';
import { Section } from '@/components/Section';
import { Body, Meta, Small, Stat } from '@/components/Type';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { space } from '@/design/tokens';
import { t, type MessageKey } from '@/i18n';

import { HISTOGRAM_BUCKETS, leaveHistogram, percent, sortedTags, type HookStat } from '../rules';
import { isPositiveTag } from '@/features/review/rules';

type Props = { hook: HookStat; clipSeconds: number };

/** Ayrılma histogramı, medyan, sonuna kadar izleme oranı ve etiketler (PRODUCT §7). */
export function HookResults({ hook, clipSeconds }: Props) {
  const colors = Colors[useColorScheme()];
  const buckets = leaveHistogram(hook.leave_seconds, clipSeconds);
  const peak = Math.max(1, ...buckets);
  const bucketSeconds = Math.max(1, Math.round(clipSeconds / HISTOGRAM_BUCKETS));
  // İzleyiciyi en çok kaybettiğin an sayfadaki tek kırmızı: asıl haber o (DESIGN.md §3).
  const worst = buckets.some((count) => count > 0) ? buckets.indexOf(peak) : -1;
  const tags = sortedTags(hook.tags);
  // İki ayrı soru, iki ayrı liste: "neden bıraktılar" ile "ne tuttu" aynı başlık altında
  // toplanırsa sahibin okuduğu şey yanlış olur.
  const stopped = tags.filter((entry) => !isPositiveTag(entry.tag));
  const stayed = tags.filter((entry) => isPositiveTag(entry.tag));

  return (
    <Section title={t('results.hook.title')} gap={space.lg}>
      <View style={styles.summary}>
        <Stat value={`${percent(hook.finished_ratio)}%`} label={t('results.hook.finished')} />
        <Stat
          value={hook.median_leave === null ? '—' : `${Math.round(hook.median_leave)}s`}
          label={t('results.hook.median')}
        />
      </View>

      <View>
        <View style={styles.chart} accessibilityLabel={t('results.hook.chartLabel')}>
          {buckets.map((count, index) => (
            <View key={index} style={styles.barColumn}>
              <View
                style={[
                  styles.bar,
                  {
                    height: `${(count / peak) * 100}%`,
                    backgroundColor:
                      index === worst ? colors.tint : count > 0 ? colors.text : colors.border,
                  },
                ]}
              />
            </View>
          ))}
        </View>
        <Rule />
        <View style={styles.axis}>
          <Meta>0s</Meta>
          <Meta>{t('results.hook.bucket', { seconds: bucketSeconds })}</Meta>
          <Meta>{clipSeconds}s</Meta>
        </View>
      </View>

      {stopped.length > 0 || tags.length === 0 ? (
        <TagList title={t('results.hook.tags')} rows={stopped} />
      ) : null}
      {stayed.length > 0 ? <TagList title={t('results.hook.tagsPositive')} rows={stayed} /> : null}
    </Section>
  );
}

/** Etiket listesi: ad solda, sayı sağda, hizalı rakamlar. */
function TagList({ title, rows }: { title: string; rows: { tag: string; count: number }[] }) {
  return (
    <View style={styles.tags}>
      <Meta style={styles.tagsLabel}>{title}</Meta>
      {rows.length === 0 ? <Small tone="muted">{t('results.noData')}</Small> : null}
      {rows.map(({ tag, count }) => (
        <View key={tag} style={styles.tagRow}>
          <Body>{t(`review.tags.${tag}` as MessageKey)}</Body>
          <Body style={styles.tagCount}>{count}</Body>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: 'row',
    gap: space.xxl,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.xs,
    height: 120,
  },
  barColumn: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    minHeight: 2,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: space.sm,
  },
  tags: {
    gap: space.sm,
  },
  tagsLabel: {
    textTransform: 'uppercase',
  },
  tagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: space.md,
    minHeight: 28,
  },
  tagCount: {
    fontVariant: ['tabular-nums'],
  },
});
