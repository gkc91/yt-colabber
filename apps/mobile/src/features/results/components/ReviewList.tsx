import { Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { ReportSheet } from '@/features/reports/ReportSheet';
import { t } from '@/i18n';

import type { ResultReview } from '../api';

type Props = {
  reviews: ResultReview[];
  titles: string[];
  busyReviewId: string | null;
  onRate: (review: ResultReview, helpful: boolean) => void;
  onPromise: (review: ResultReview, understood: boolean) => void;
};

/**
 * Başlık tahminleri + yorumlar. Sahip iki şey işaretler:
 *  - "doğru/yanlış anladı" → değerlendirmenin promise_understood alanı (başlık istatistiği)
 *  - "yararlı/değil" → değerlendiricinin itibarı (rate_review)
 */
export function ReviewList({ reviews, titles, busyReviewId, onRate, onPromise }: Props) {
  const colors = Colors[useColorScheme()];

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{t('results.reviews.title')}</Text>
      {reviews.length === 0 ? (
        <Text style={[styles.muted, { color: colors.muted }]}>{t('results.noData')}</Text>
      ) : null}

      {reviews.map((review) => (
        <View key={review.id} style={[styles.card, { borderColor: colors.border }]}>
          <Text style={[styles.shownTitle, { color: colors.muted }]} numberOfLines={1}>
            {t('results.reviews.sawTitle', { title: titles[review.title_index] ?? '' })}
          </Text>
          <Text style={styles.guess}>“{review.title_guess}”</Text>

          <View style={styles.actions}>
            <Choice
              label={t('results.reviews.understood')}
              active={review.promise_understood === true}
              disabled={busyReviewId === review.id}
              onPress={() => onPromise(review, true)}
            />
            <Choice
              label={t('results.reviews.misunderstood')}
              active={review.promise_understood === false}
              disabled={busyReviewId === review.id}
              onPress={() => onPromise(review, false)}
            />
          </View>

          {review.comment ? <Text style={styles.comment}>{review.comment}</Text> : null}

          <Text style={[styles.leave, { color: colors.muted }]}>
            {review.leave_second === null
              ? t('results.reviews.watchedAll')
              : t('results.reviews.leftAt', { second: review.leave_second })}
          </Text>

          <ReportSheet
            target={{ type: 'review', id: review.id }}
            label={t('report.reportReview')}
          />

          <View style={styles.actions}>
            <Choice
              label={t('results.reviews.helpful')}
              active={review.helpful === true}
              disabled={busyReviewId === review.id}
              onPress={() => onRate(review, true)}
            />
            <Choice
              label={t('results.reviews.notHelpful')}
              active={review.helpful === false}
              disabled={busyReviewId === review.id}
              onPress={() => onRate(review, false)}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

function Choice({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const colors = Colors[useColorScheme()];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.choice,
        { borderColor: active ? colors.tint : colors.border },
        active && { backgroundColor: colors.tint },
        disabled && { opacity: 0.6 },
      ]}
    >
      <Text style={[styles.choiceLabel, { color: active ? colors.onTint : colors.text }]}>
        {label}
      </Text>
    </Pressable>
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
  muted: {
    fontSize: 14,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  shownTitle: {
    fontSize: 12,
  },
  guess: {
    fontSize: 16,
    lineHeight: 22,
  },
  comment: {
    fontSize: 15,
    lineHeight: 21,
  },
  leave: {
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  choice: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  choiceLabel: {
    fontSize: 14,
  },
});
