import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/Card';
import { Section } from '@/components/Section';
import { Body, Meta, Small } from '@/components/Type';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { layout, radius, space } from '@/design/tokens';
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
  return (
    <Section
      title={t('results.reviews.title')}
      note={reviews.length > 0 ? String(reviews.length) : undefined}
    >
      {reviews.length === 0 ? <Small tone="muted">{t('results.noData')}</Small> : null}

      {reviews.map((review) => (
        <Card key={review.id} gap={space.md}>
          <Meta numberOfLines={1}>
            {t('results.reviews.sawTitle', { title: titles[review.title_index] ?? '' })}
          </Meta>
          {/* Tahmin kartın konusu: alıntı gibi dursun, istatistik gibi değil. */}
          <Body style={styles.guess}>“{review.title_guess}”</Body>

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

          {review.comment ? <Small>{review.comment}</Small> : null}

          <Meta>
            {review.leave_second === null
              ? t('results.reviews.watchedAll')
              : t('results.reviews.leftAt', { second: review.leave_second })}
          </Meta>

          <View style={styles.footer}>
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
            <ReportSheet
              target={{ type: 'review', id: review.id }}
              label={t('report.reportReview')}
            />
          </View>
        </Card>
      ))}
    </Section>
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
        { borderColor: active ? colors.text : colors.border },
        active && { backgroundColor: colors.text },
        disabled && { opacity: 0.6 },
      ]}
    >
      <Meta style={{ color: active ? colors.background : colors.text }}>{label}</Meta>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  guess: {
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    gap: space.sm,
    flexWrap: 'wrap',
  },
  footer: {
    gap: space.sm,
  },
  choice: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
    minHeight: layout.minTouch - space.md,
  },
});
