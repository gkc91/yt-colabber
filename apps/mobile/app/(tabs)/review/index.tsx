import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card, Rule } from '@/components/Card';
import { Body, Label, Meta, Small, Title } from '@/components/Type';
import { layout, space } from '@/design/tokens';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useSession } from '@/features/auth/session';
import { useBalance } from '@/features/credits/api';
import {
  PushUnavailable,
  enablePushNotifications,
  pushStatus,
  pushSupported,
} from '@/features/notifications/api';
import { isAssignment, useNextTask } from '@/features/review/api';
import { track } from '@/lib/track';
import { t } from '@/i18n';

export default function ReviewScreen() {
  const { session } = useSession();
  const colors = Colors[useColorScheme()];
  const balance = useBalance(session?.user.id);
  const task = useNextTask(!!session);
  const result = task.data;
  const assignment = result && isAssignment(result) ? result : null;
  // Tavana çarpmak, nişin boş olmasıyla aynı şey değil: ayrı metin gösteriyoruz.
  const atDailyLimit = !!result && !isAssignment(result) && result.reason === 'daily_limit';
  // 'failed': izin var ama token alınamadı (Android'de Firebase eksikse olur). Bunu
  // "kullanıcı reddetti" diye göstermek yanlış olur — hiçbir şey gelmeyeceğini söylemeliyiz.
  const [pushState, setPushState] = useState<'unknown' | 'granted' | 'denied' | 'failed'>(
    'unknown',
  );
  const refetchTask = task.refetch;
  const refetchBalance = balance.refetch;

  useFocusEffect(
    useCallback(() => {
      refetchTask();
      refetchBalance();
      if (pushSupported && session)
        pushStatus(session.user.id)
          .then((p) => setPushState(p === 'granted' ? 'granted' : 'denied'))
          .catch(() => setPushState('denied'));
    }, [refetchTask, refetchBalance, session]),
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Kredi her zaman aynı yerde: üstte, tek satır, altında çizgi. */}
      <View style={styles.balance} accessibilityRole="summary">
        <View style={styles.balanceRow}>
          <Label style={styles.balanceLabelText}>{t('credits.balance')}</Label>
          <Title style={styles.balanceValue} testID="credit-balance">
            {balance.data ?? t('credits.loading')}
          </Title>
        </View>
        <Rule />
      </View>

      <View style={styles.body}>
        {task.isPending ? <ActivityIndicator /> : null}

        {!task.isPending && assignment ? (
          <>
            <Title style={styles.centered}>{t('review.ready.title')}</Title>
            {/* Üç adım tek tek yazılı: insan neye gireceğini bilerek başlasın. */}
            <Card gap={space.sm} style={styles.steps}>
              {[t('review.ready.step1'), t('review.ready.step2'), t('review.ready.step3')].map(
                (step, index) => (
                  <View key={step} style={styles.step}>
                    <Meta style={styles.stepNumber}>{index + 1}</Meta>
                    <Small style={styles.stepText}>{step}</Small>
                  </View>
                ),
              )}
            </Card>
            <Meta style={styles.centered}>{t('review.ready.body')}</Meta>
            <Button
              title={t('review.ready.start')}
              onPress={() => {
                track.capture('task_started', { is_demo: assignment.isDemo });
                router.push({
                  pathname: '/review/[taskId]',
                  params: { taskId: assignment.task.id },
                });
              }}
            />
          </>
        ) : null}

        {!task.isPending && !assignment ? (
          <>
            <Title style={styles.centered}>
              {t(atDailyLimit ? 'review.empty.limitTitle' : 'review.empty.title')}
            </Title>
            <Body tone="muted" style={styles.centered}>
              {t(atDailyLimit ? 'review.empty.limitBody' : 'review.empty.body')}
            </Body>
            {!atDailyLimit && pushSupported && pushState === 'denied' ? (
              <Button
                title={t('review.empty.enablePush')}
                variant="secondary"
                onPress={() =>
                  enablePushNotifications(session?.user.id as string)
                    .then((result) => setPushState(result === 'granted' ? 'granted' : 'denied'))
                    .catch((error) =>
                      setPushState(error instanceof PushUnavailable ? 'failed' : 'denied'),
                    )
                }
              />
            ) : null}
            {pushState === 'granted' ? (
              <Meta style={styles.centered}>{t('review.empty.pushOn')}</Meta>
            ) : null}
            {pushState === 'failed' ? (
              <Small tone="accent" style={styles.centered}>
                {t('review.empty.pushFailed')}
              </Small>
            ) : null}
          </>
        ) : null}

        {task.error ? (
          <Small tone="accent" style={styles.centered}>
            {errorText(task.error)}
          </Small>
        ) : null}
      </View>
    </View>
  );
}

function errorText(error: Error): string {
  if (error.message.includes('reviewer_blocked')) return t('review.errors.reviewer_blocked');
  if (error.message.includes('niche_cache_empty')) return t('review.errors.niche_cache_empty');
  return t('auth.genericError');
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  balance: {
    paddingHorizontal: layout.gutter,
    paddingTop: space.lg,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingBottom: space.md,
  },
  balanceLabelText: {
    flex: 1,
  },
  balanceValue: {
    fontVariant: ['tabular-nums'],
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: layout.gutter,
    gap: space.lg,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  centered: {
    textAlign: 'center',
  },
  steps: {
    width: '100%',
  },
  step: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.md,
  },
  stepNumber: {
    fontVariant: ['tabular-nums'],
    minWidth: 14,
  },
  stepText: {
    flex: 1,
  },
});
