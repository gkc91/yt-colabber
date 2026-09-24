import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { rateReview, resultsQueryKey, useResults, type ResultReview } from '@/features/results/api';
import { AiSummary } from '@/features/results/components/AiSummary';
import { HookResults } from '@/features/results/components/HookResults';
import { ReviewList } from '@/features/results/components/ReviewList';
import { ThumbnailResults } from '@/features/results/components/ThumbnailResults';
import { storage } from '@/lib/storage';
import { t } from '@/i18n';

export default function SubmissionResultsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = Colors[useColorScheme()];
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
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (results.error || !results.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>{t('results.notFound')}</Text>
      </View>
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
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={[styles.progress, { color: colors.muted }]}>
        {t('submit.reviewsProgress', {
          received: submission.received_reviews,
          requested: submission.requested_reviews,
        })}
      </Text>

      {submission.received_reviews === 0 ? (
        <Text style={styles.message}>{t('results.waiting')}</Text>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 28,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  progress: {
    fontSize: 14,
    fontWeight: '600',
  },
  message: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
});
