import { Link, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, FlatList, StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useSession } from '@/features/auth/session';
import { useMySubmissions, type MySubmission } from '@/features/submit/api';
import { remainingTime } from '@/features/submit/rules';
import { t, type MessageKey } from '@/i18n';

export default function SubmissionsScreen() {
  const { session } = useSession();
  const submissions = useMySubmissions(session?.user.id);
  const refetchSubmissions = submissions.refetch;

  // Sihirbazdan dönünce liste tazelensin.
  useFocusEffect(
    useCallback(() => {
      refetchSubmissions();
    }, [refetchSubmissions]),
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={submissions.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <SubmissionRow submission={item} />}
        ListEmptyComponent={
          submissions.isPending ? (
            <ActivityIndicator style={styles.loading} />
          ) : (
            <Text style={styles.empty}>{t('submit.empty')}</Text>
          )
        }
      />
      <View style={styles.footer}>
        <Link href="/submit/new" asChild>
          <Button title={t('submit.newTest')} onPress={() => {}} />
        </Link>
      </View>
    </View>
  );
}

function SubmissionRow({ submission }: { submission: MySubmission }) {
  const colors = Colors[useColorScheme()];
  const left = remainingTime(submission.closes_at);
  const isOpen = submission.status === 'open';

  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      <Text style={styles.rowTitle} numberOfLines={1}>
        {submission.title_options[0]}
      </Text>
      <View style={styles.rowMeta}>
        <Text style={[styles.rowStatus, { color: colors.muted }]}>
          {t(`submit.status.${submission.status}` as MessageKey)}
        </Text>
        <Text style={styles.rowCount}>
          {t('submit.reviewsProgress', {
            received: submission.received_reviews,
            requested: submission.requested_reviews,
          })}
        </Text>
      </View>
      <Text style={[styles.rowTime, { color: colors.muted }]}>
        {isOpen && !left.expired
          ? t('submit.remaining', { hours: left.hours, minutes: left.minutes })
          : t('submit.closed')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    padding: 16,
    gap: 12,
    flexGrow: 1,
  },
  loading: {
    marginTop: 48,
  },
  empty: {
    marginTop: 48,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  row: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowStatus: {
    fontSize: 14,
  },
  rowCount: {
    fontSize: 14,
    fontWeight: '600',
  },
  rowTime: {
    fontSize: 13,
  },
  footer: {
    padding: 16,
  },
});
