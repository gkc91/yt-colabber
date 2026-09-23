import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { signOut } from '@/features/auth/api';
import { useSession } from '@/features/auth/session';
import { useBalance } from '@/features/credits/api';
import { useNiches } from '@/features/onboarding/api';
import { LANGUAGES } from '@/features/onboarding/options';
import {
  changeNiche,
  deleteAccount,
  profileQueryKey,
  useCreditHistory,
  useProfile,
} from '@/features/profile/api';
import { CreditHistory } from '@/features/profile/components/CreditHistory';
import { canChangeNiche, daysUntilNicheChange } from '@/features/profile/nicheChange';
import {
  MAX_EXTRA_LANGUAGES,
  MAX_EXTRA_NICHES,
  reviewScopeQueryKey,
  saveReviewScope,
  toggleWithin,
  useReviewScope,
} from '@/features/profile/reviewScope';
import { t, type MessageKey } from '@/i18n';

export default function ProfileScreen() {
  const { session } = useSession();
  const userId = session?.user.id as string;
  const colors = Colors[useColorScheme()];
  const queryClient = useQueryClient();

  const profile = useProfile(userId);
  const balance = useBalance(userId);
  const credits = useCreditHistory(userId);
  const niches = useNiches();
  const scope = useReviewScope(userId);

  const [edited, setEdited] = useState<{ niches: number[]; languages: string[] } | null>(null);
  const alsoNicheIds = edited?.niches ?? scope.data?.alsoNicheIds ?? [];
  const alsoLanguages = edited?.languages ?? scope.data?.alsoLanguages ?? [];
  const dirty = edited !== null;

  const [changingNiche, setChangingNiche] = useState(false);
  const [nicheError, setNicheError] = useState<string | null>(null);

  const saveScope = useMutation({
    mutationFn: () => saveReviewScope(userId, { alsoNicheIds, alsoLanguages }),
    onSuccess: async () => {
      setEdited(null);
      await queryClient.invalidateQueries({ queryKey: reviewScopeQueryKey(userId) });
      await queryClient.invalidateQueries({ queryKey: ['review-task'] });
    },
  });

  const switchNiche = useMutation({
    mutationFn: changeNiche,
    onSuccess: async () => {
      setChangingNiche(false);
      setNicheError(null);
      await queryClient.invalidateQueries({ queryKey: profileQueryKey(userId) });
      await queryClient.invalidateQueries({ queryKey: reviewScopeQueryKey(userId) });
      await queryClient.invalidateQueries({ queryKey: ['review-task'] });
    },
    onError: (error: Error) =>
      setNicheError(t(`profile.niche.errors.${error.message}` as MessageKey)),
  });

  const removeAccount = useMutation({ mutationFn: deleteAccount });

  if (profile.isPending || niches.isPending || scope.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const ownNiche = niches.data?.find((niche) => niche.id === profile.data?.niche_id);
  const ownLanguage = LANGUAGES.find((language) => language.code === profile.data?.language);
  const daysLeft = daysUntilNicheChange(profile.data?.niche_changed_at ?? null);
  const nicheUnlocked = canChangeNiche(profile.data?.niche_changed_at ?? null);

  const confirmDelete = () => {
    const message = t('profile.account.deleteConfirm');
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(message)) removeAccount.mutate();
      return;
    }
    Alert.alert(t('profile.account.delete'), message, [
      { text: t('report.cancel'), style: 'cancel' },
      {
        text: t('profile.account.delete'),
        style: 'destructive',
        onPress: () => removeAccount.mutate(),
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* ---------- özet ---------- */}
      <View style={styles.section}>
        <Text style={styles.heading}>{t('profile.stats.title')}</Text>
        <View style={styles.stats}>
          <Stat label={t('credits.balance')} value={String(balance.data ?? '—')} />
          <Stat
            label={t('profile.stats.reputation')}
            value={Number(profile.data?.reputation ?? 1).toFixed(2)}
          />
          <Stat label={t('profile.stats.given')} value={String(profile.data?.reviews_given ?? 0)} />
          <Stat
            label={t('profile.stats.received')}
            value={String(profile.data?.reviews_received ?? 0)}
          />
        </View>
        {profile.data?.is_flagged ? (
          <Text style={[styles.body, { color: colors.danger }]}>{t('profile.stats.flagged')}</Text>
        ) : null}
      </View>

      {/* ---------- kanal ve niş ---------- */}
      <View style={styles.section}>
        <Text style={styles.heading}>{t('profile.yourChannel.title')}</Text>
        <Text style={[styles.body, { color: colors.muted }]}>
          {t('profile.yourChannel.body', {
            niche: ownNiche?.name ?? '—',
            language: ownLanguage?.label ?? profile.data?.language ?? '—',
          })}
        </Text>

        {changingNiche ? (
          <>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {niches.data?.map((niche) => (
                <Chip
                  key={niche.id}
                  label={niche.name}
                  selected={niche.id === profile.data?.niche_id}
                  onPress={() => switchNiche.mutate(niche.id)}
                />
              ))}
            </View>
            {nicheError ? (
              <Text style={[styles.body, { color: colors.danger }]}>{nicheError}</Text>
            ) : null}
            <Button
              title={t('report.cancel')}
              variant="secondary"
              onPress={() => setChangingNiche(false)}
            />
          </>
        ) : (
          <>
            <Text style={[styles.hint, { color: colors.muted }]}>
              {nicheUnlocked
                ? t('profile.niche.canChange')
                : t('profile.niche.locked', { days: daysLeft })}
            </Text>
            <Button
              title={t('profile.niche.change')}
              variant="secondary"
              disabled={!nicheUnlocked}
              onPress={() => setChangingNiche(true)}
            />
          </>
        )}
      </View>

      {/* ---------- değerlendirme kapsamı ---------- */}
      <View style={styles.section}>
        <Text style={styles.heading}>{t('profile.scope.title')}</Text>
        <Text style={[styles.body, { color: colors.muted }]}>{t('profile.scope.body')}</Text>

        <Text style={styles.label}>
          {t('profile.scope.niches', { used: alsoNicheIds.length, max: MAX_EXTRA_NICHES })}
        </Text>
        <View style={styles.chips}>
          {niches.data
            ?.filter((niche) => niche.id !== profile.data?.niche_id)
            .map((niche) => (
              <Chip
                key={niche.id}
                role="checkbox"
                label={niche.name}
                selected={alsoNicheIds.includes(niche.id)}
                onPress={() =>
                  setEdited({
                    niches: toggleWithin(alsoNicheIds, niche.id, MAX_EXTRA_NICHES),
                    languages: alsoLanguages,
                  })
                }
              />
            ))}
        </View>

        <Text style={styles.label}>
          {t('profile.scope.languages', { used: alsoLanguages.length, max: MAX_EXTRA_LANGUAGES })}
        </Text>
        <View style={styles.chips}>
          {LANGUAGES.filter((language) => language.code !== profile.data?.language).map(
            (language) => (
              <Chip
                key={language.code}
                role="checkbox"
                label={language.label}
                selected={alsoLanguages.includes(language.code)}
                onPress={() =>
                  setEdited({
                    niches: alsoNicheIds,
                    languages: toggleWithin(alsoLanguages, language.code, MAX_EXTRA_LANGUAGES),
                  })
                }
              />
            ),
          )}
        </View>

        <Button
          title={dirty ? t('profile.scope.save') : t('profile.scope.saved')}
          onPress={() => saveScope.mutate()}
          disabled={!dirty}
          loading={saveScope.isPending}
        />
      </View>

      {/* ---------- kredi geçmişi ---------- */}
      <View style={styles.section}>
        <Text style={styles.heading}>{t('profile.credits.title')}</Text>
        {credits.isPending ? <ActivityIndicator /> : <CreditHistory entries={credits.data ?? []} />}
      </View>

      {/* ---------- hesap ---------- */}
      <View style={styles.section}>
        <Text style={styles.heading}>{t('profile.account.title')}</Text>
        <Button
          title={t('profile.account.signOut')}
          variant="secondary"
          onPress={() => signOut()}
        />
        <Text style={[styles.hint, { color: colors.muted }]}>
          {t('profile.account.deleteHint')}
        </Text>
        {removeAccount.error ? (
          <Text style={[styles.body, { color: colors.danger }]}>{t('auth.genericError')}</Text>
        ) : null}
        <Button
          title={t('profile.account.delete')}
          variant="secondary"
          onPress={confirmDelete}
          loading={removeAccount.isPending}
        />
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const colors = Colors[useColorScheme()];
  return (
    <View style={styles.stat}>
      <Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
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
  },
  section: {
    gap: 10,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 4,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
  },
  hint: {
    fontSize: 13,
    lineHeight: 19,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  stat: {
    gap: 2,
  },
  statLabel: {
    fontSize: 13,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
  },
});
