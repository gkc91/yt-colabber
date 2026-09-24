import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Rule } from '@/components/Card';
import { Body, Meta, Small, Title } from '@/components/Type';
import { layout, space } from '@/design/tokens';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useSession } from '@/features/auth/session';
import { useBalance } from '@/features/credits/api';
import {
  enablePushNotifications,
  getPushPermission,
  pushSupported,
} from '@/features/notifications/api';
import { useNextTask } from '@/features/review/api';
import { track } from '@/lib/track';
import { t } from '@/i18n';

export default function ReviewScreen() {
  const { session } = useSession();
  const colors = Colors[useColorScheme()];
  const balance = useBalance(session?.user.id);
  const task = useNextTask(!!session);
  const assignment = task.data;
  const [pushState, setPushState] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const refetchTask = task.refetch;
  const refetchBalance = balance.refetch;

  useFocusEffect(
    useCallback(() => {
      refetchTask();
      refetchBalance();
      if (pushSupported)
        getPushPermission().then((p) => setPushState(p === 'granted' ? 'granted' : 'denied'));
    }, [refetchTask, refetchBalance]),
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Kredi her zaman aynı yerde: üstte, tek satır, altında çizgi. */}
      <View style={styles.balance} accessibilityRole="summary">
        <View style={styles.balanceRow}>
          <Meta style={styles.balanceLabel}>{t('credits.balance')}</Meta>
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
            <Body tone="muted" style={styles.centered}>
              {t('review.ready.body')}
            </Body>
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
            <Title style={styles.centered}>{t('review.empty.title')}</Title>
            <Body tone="muted" style={styles.centered}>
              {t('review.empty.body')}
            </Body>
            {pushSupported && pushState === 'denied' ? (
              <Button
                title={t('review.empty.enablePush')}
                variant="secondary"
                onPress={() =>
                  enablePushNotifications(session?.user.id as string)
                    .then((result) => setPushState(result === 'granted' ? 'granted' : 'denied'))
                    .catch(() => setPushState('denied'))
                }
              />
            ) : null}
            {pushState === 'granted' ? (
              <Meta style={styles.centered}>{t('review.empty.pushOn')}</Meta>
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
  balanceLabel: {
    textTransform: 'uppercase',
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
});
