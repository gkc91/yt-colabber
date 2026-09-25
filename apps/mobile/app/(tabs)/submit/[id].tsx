import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Progress } from '@/components/Progress';
import { Screen } from '@/components/Screen';
import { Body, Stat } from '@/components/Type';
import { space } from '@/design/tokens';
import { rateReview, resultsQueryKey, useResults, type ResultReview } from '@/features/results/api';
import { AiSummary } from '@/features/results/components/AiSummary';
import { HookResults } from '@/features/results/components/HookResults';
import { ReviewList } from '@/features/results/components/ReviewList';
import { ThumbnailResults } from '@/features/results/components/ThumbnailResults';
import { storage } from '@/lib/storage';
import { t } from '@/i18n';

export default function SubmissionResultsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const results = useResults(id);
  const media = useQuery({
    queryKey: ['submission-media', id],
    queryFn: () => storage.getSignedUrls({ submissionId: id }),
    enabled: !!id,
  });

  const [busyReviewId, setBusyReviewId] = useState<string | null>(null);
  const rate = useMutation({
    mutationFn: rateReview,
    onSettled: async () => {
      setBusyReviewId(null);
      await queryClient.invalidateQueries({ queryKey: resultsQueryKey(id) });
    },
  });

  if (results.isPending) {
    return (
      <Screen center>
        <ActivityIndicator />
      </Screen>
    );
  }

  if (results.error || !results.data) {
    return (
      <Screen center>
        <Body>{t('results.notFound')}</Body>
      </Screen>
    );
  }

  const { submission, thumbnails, hook, reviews } = results.data;

  // Sahip hem "yararlı/değil" hem "vaadi anladı mı" işaretler; ikisi de rate_review'e gider,
  // eksik olan alan null geçilir ki diğerini sıfırlamasın.
  const onRate = (review: ResultReview, helpful: boolean) => {
    setBusyReviewId(review.id);
    rate.mutate({ reviewId: review.id, helpful, promiseUnderstood: review.promise_understood });
  };
  const onPromise = (review: ResultReview, understood: boolean) => {
    setBusyReviewId(review.id);
    rate.mutate({
      reviewId: review.id,
      helpful: review.helpful ?? true,
      promiseUnderstood: understood,
    });
  };

  return (
    <Screen gap={space.xxl}>
      {/* Raporun künyesi: kaç kişinin baktığı, her şeyden önce. */}
      <View style={styles.header}>
        <Stat
          value={`${submission.received_reviews}/${submission.requested_reviews}`}
          label={t('results.reviewsLabel')}
        />
        <Progress done={submission.received_reviews} total={submission.requested_reviews} />
      </View>

      {submission.received_reviews === 0 ? (
        <Body tone="muted">{t('results.waiting')}</Body>
      ) : (
        <>
          <AiSummary submissionId={id} summary={submission.ai_summary} />
          <ThumbnailResults stats={thumbnails} thumbnailUrls={media.data?.thumbnails ?? []} />
          <HookResults hook={hook} clipSeconds={submission.clip_duration_seconds} />
          <ReviewList
            reviews={reviews}
            titles={submission.title_options}
            busyReviewId={busyReviewId}
            onRate={onRate}
            onPromise={onPromise}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: space.lg,
  },
});
