import { Link, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Body, Heading, Meta } from '@/components/Type';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { layout, space } from '@/design/tokens';
import { useSession } from '@/features/auth/session';
import { useMySubmissions, type MySubmission } from '@/features/submit/api';
import { remainingTime } from '@/features/submit/rules';
import { t, type MessageKey } from '@/i18n';

export default function SubmissionsScreen() {
  const { session } = useSession();
  const colors = Colors[useColorScheme()];
  const submissions = useMySubmissions(session?.user.id);
  const refetchSubmissions = submissions.refetch;

  // Sihirbazdan dönünce liste tazelensin.
  useFocusEffect(
    useCallback(() => {
      refetchSubmissions();
    }, [refetchSubmissions]),
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={submissions.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Link href={{ pathname: '/submit/[id]', params: { id: item.id } }} asChild>
            <Pressable accessibilityRole="button">
              <SubmissionRow submission={item} />
            </Pressable>
          </Link>
        )}
        ListEmptyComponent={
          submissions.isPending ? (
            <ActivityIndicator style={styles.loading} />
          ) : (
            <Body tone="muted" style={styles.empty}>
              {t('submit.empty')}
            </Body>
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
  const left = remainingTime(submission.closes_at);
  const isOpen = submission.status === 'open';

  return (
    <Card gap={space.sm}>
      <Heading numberOfLines={1}>{submission.title_options[0]}</Heading>
      <View style={styles.rowMeta}>
        <Meta>{t(`submit.status.${submission.status}` as MessageKey)}</Meta>
        <Meta style={styles.rowCount}>
          {t('submit.reviewsProgress', {
            received: submission.received_reviews,
            requested: submission.requested_reviews,
          })}
        </Meta>
      </View>
      <Meta>
        {isOpen && !left.expired
          ? t('submit.remaining', { hours: left.hours, minutes: left.minutes })
          : t('submit.closed')}
      </Meta>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    paddingHorizontal: layout.gutter,
    paddingTop: space.lg,
    gap: space.md,
    flexGrow: 1,
    width: '100%',
    maxWidth: layout.maxWidth,
    alignSelf: 'center',
  },
  loading: {
    marginTop: space.xxxl,
  },
  empty: {
    marginTop: space.xxxl,
  },
  rowMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.md,
  },
  rowCount: {
    fontVariant: ['tabular-nums'],
  },
  footer: {
    paddingHorizontal: layout.gutter,
    paddingVertical: space.lg,
    width: '100%',
    maxWidth: layout.maxWidth,
    alignSelf: 'center',
  },
});
