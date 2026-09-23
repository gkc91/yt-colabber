import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useSession } from '@/features/auth/session';
import { fetchNextTask, submitReview } from '@/features/review/api';
import { DoneStep } from '@/features/review/components/DoneStep';
import { FeedStep } from '@/features/review/components/FeedStep';
import { GuessStep } from '@/features/review/components/GuessStep';
import { HookStep } from '@/features/review/components/HookStep';
import {
  buildFeedItems,
  leaveSecondFor,
  watchedSecondsFor,
  secondsSince,
  type ReasonTag,
} from '@/features/review/rules';
import { storage } from '@/lib/storage';
import { t } from '@/i18n';

type Stage = 'feed' | 'guess' | 'hook';

export default function ReviewTaskScreen() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const colors = Colors[useColorScheme()];

  // Görev zaten açık olduğu için next_review_task aynı görevi döner (0007).
  const task = useQuery({ queryKey: ['review-task'], queryFn: fetchNextTask });
  const media = useQuery({
    queryKey: ['review-media', taskId],
    queryFn: () => storage.getSignedUrls({ taskId }),
    enabled: !!taskId,
  });

  const [stage, setStage] = useState<Stage>('feed');
  // Gönderimden sonra sunucuda başka görev kalmayabilir; "+1 kredi" ekranı bu değere
  // bakar, görev sorgusuna değil.
  const [completedSubmissionId, setCompletedSubmissionId] = useState<string | null>(null);
  const [pick, setPick] = useState<{ candidate: boolean; position: number; ms: number } | null>(
    null,
  );
  const [guess, setGuess] = useState('');
  const [tags, setTags] = useState<ReasonTag[]>([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Toplam süre ekran açılışından ölçülür; sunucu da now() - assigned_at ile doğrular (0003).
  // Saat render sırasında değil, ekran bağlandığında okunur.
  const openedAt = useRef(0);
  const feedShownAt = useRef(0);
  useEffect(() => {
    const now = Date.now();
    openedAt.current = now;
    feedShownAt.current = now;
  }, []);

  const assignment = task.data && task.data.task.id === taskId ? task.data : null;

  if (completedSubmissionId) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <DoneStep submissionId={completedSubmissionId} />
      </ScrollView>
    );
  }

  if (task.isPending || media.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!assignment) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>{t('review.errors.task_expired')}</Text>
      </View>
    );
  }

  const { task: reviewTask, title, clipDurationSeconds } = assignment;
  const candidateThumbnail = media.data?.thumbnails[0] ?? '';
  const items = buildFeedItems(
    { title, thumbnailUrl: candidateThumbnail },
    reviewTask.decoys,
    reviewTask.candidate_position,
  );

  const onPick = (index: number) => {
    setPick({
      candidate: items[index].kind === 'candidate',
      position: index,
      ms: Date.now() - feedShownAt.current,
    });
    setStage('guess');
  };

  const onFinish = async (leftAt: number | null) => {
    if (!pick) return;
    setSubmitting(true);
    setError(null);
    try {
      const reviewId = await submitReview({
        taskId: reviewTask.id,
        pickedCandidate: pick.candidate,
        pickedPosition: pick.position,
        decisionMs: pick.ms,
        titleGuess: guess.trim(),
        leaveSecond: leaveSecondFor(leftAt, clipDurationSeconds),
        watchedSeconds: watchedSecondsFor(leftAt, clipDurationSeconds),
        tags,
        comment: comment.trim() || null,
        timeSpentSeconds: secondsSince(openedAt.current),
      });

      if (!reviewId) {
        // 0003: çok hızlı değerlendirme kredi kazandırmaz, görev kapanır.
        setError(t('review.errors.review_too_fast'));
        return;
      }
      // Sıradaki görev Değerlendir sekmesine dönünce alınır; burada tazelersek
      // bu ekranın verisi altından kayar.
      await queryClient.invalidateQueries({ queryKey: ['balance', session?.user.id] });
      setCompletedSubmissionId(reviewTask.submission_id);
    } catch (e) {
      setError(submitErrorText(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {stage === 'feed' ? <FeedStep items={items} onPick={onPick} /> : null}

      {stage === 'guess' ? (
        <GuessStep
          thumbnailUrl={candidateThumbnail}
          title={title}
          guess={guess}
          onChange={setGuess}
          onContinue={() => setStage('hook')}
        />
      ) : null}

      {stage === 'hook' ? (
        <HookStep
          clipUrl={media.data?.clip ?? ''}
          comment={comment}
          tags={tags}
          submitting={submitting}
          onChangeComment={setComment}
          onChangeTags={setTags}
          onFinish={onFinish}
        />
      ) : null}

      {error ? <Text style={[styles.message, { color: colors.danger }]}>{error}</Text> : null}
    </ScrollView>
  );
}

function submitErrorText(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('task_expired')) return t('review.errors.task_expired');
  if (message.includes('submission_closed')) return t('review.errors.submission_closed');
  if (message.includes('invalid_watched_seconds') || message.includes('invalid_leave_second')) {
    return t('review.errors.invalid_watch');
  }
  return t('auth.genericError');
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 16,
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
  message: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
});
