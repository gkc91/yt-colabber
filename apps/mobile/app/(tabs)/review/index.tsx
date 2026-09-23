import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useSession } from '@/features/auth/session';
import { useBalance } from '@/features/credits/api';
import { useNextTask } from '@/features/review/api';
import { t } from '@/i18n';

export default function ReviewScreen() {
  const { session } = useSession();
  const colors = Colors[useColorScheme()];
  const balance = useBalance(session?.user.id);
  const task = useNextTask(!!session);
  const assignment = task.data;
  const refetchTask = task.refetch;
  const refetchBalance = balance.refetch;

  useFocusEffect(
    useCallback(() => {
      refetchTask();
      refetchBalance();
    }, [refetchTask, refetchBalance]),
  );

  return (
    <View style={styles.container}>
      <View style={styles.balance} accessibilityRole="summary">
        <Text style={[styles.balanceLabel, { color: colors.muted }]}>{t('credits.balance')}</Text>
        <Text style={styles.balanceValue} testID="credit-balance">
          {balance.data ?? t('credits.loading')}
        </Text>
      </View>

      <View style={styles.body}>
        {task.isPending ? <ActivityIndicator /> : null}

        {!task.isPending && assignment ? (
          <>
            <Text style={styles.title}>{t('review.ready.title')}</Text>
            <Text style={styles.text}>{t('review.ready.body')}</Text>
            <Button
              title={t('review.ready.start')}
              onPress={() =>
                router.push({
                  pathname: '/review/[taskId]',
                  params: { taskId: assignment.task.id },
                })
              }
            />
          </>
        ) : null}

        {!task.isPending && !assignment ? (
          <>
            <Text style={styles.title}>{t('review.empty.title')}</Text>
            <Text style={styles.text}>{t('review.empty.body')}</Text>
          </>
        ) : null}

        {task.error ? (
          <Text style={[styles.text, { color: colors.danger }]}>{errorText(task.error)}</Text>
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
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  balanceLabel: {
    fontSize: 15,
  },
  balanceValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
});
