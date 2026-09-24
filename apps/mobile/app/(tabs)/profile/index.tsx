import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { Section } from '@/components/Section';
import { Meta, Small, Stat } from '@/components/Type';
import { space } from '@/design/tokens';
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
      <Screen center>
        <ActivityIndicator />
      </Screen>
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
    <Screen gap={space.xxl}>
      {/* ---------- özet ---------- */}
      <Section title={t('profile.stats.title')}>
        <View style={styles.stats}>
          <Stat
            style={styles.stat}
            label={t('credits.balance')}
            value={String(balance.data ?? '—')}
          />
          <Stat
            style={styles.stat}
            label={t('profile.stats.reputation')}
            value={Number(profile.data?.reputation ?? 1).toFixed(2)}
          />
          <Stat
            style={styles.stat}
            label={t('profile.stats.given')}
            value={String(profile.data?.reviews_given ?? 0)}
          />
          <Stat
            style={styles.stat}
            label={t('profile.stats.received')}
            value={String(profile.data?.reviews_received ?? 0)}
          />
        </View>
        {profile.data?.is_flagged ? (
          <Small tone="accent">{t('profile.stats.flagged')}</Small>
        ) : null}
      </Section>

      {/* ---------- kanal ve niş ---------- */}
      <Section title={t('profile.yourChannel.title')}>
        <Small tone="muted">
          {t('profile.yourChannel.body', {
            niche: ownNiche?.name ?? '—',
            language: ownLanguage?.label ?? profile.data?.language ?? '—',
          })}
        </Small>

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
            {nicheError ? <Small tone="accent">{nicheError}</Small> : null}
            <Button
              title={t('report.cancel')}
              variant="secondary"
              onPress={() => setChangingNiche(false)}
            />
          </>
        ) : (
          <>
            <Meta>
              {nicheUnlocked
                ? t('profile.niche.canChange')
                : t('profile.niche.locked', { days: daysLeft })}
            </Meta>
            <Button
              title={t('profile.niche.change')}
              variant="secondary"
              disabled={!nicheUnlocked}
              onPress={() => setChangingNiche(true)}
            />
          </>
        )}
      </Section>

      {/* ---------- değerlendirme kapsamı ---------- */}
      <Section title={t('profile.scope.title')}>
        <Small tone="muted">{t('profile.scope.body')}</Small>

        <Meta style={styles.label}>
          {t('profile.scope.niches', { used: alsoNicheIds.length, max: MAX_EXTRA_NICHES })}
        </Meta>
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

        <Meta style={styles.label}>
          {t('profile.scope.languages', { used: alsoLanguages.length, max: MAX_EXTRA_LANGUAGES })}
        </Meta>
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
      </Section>

      {/* ---------- kredi geçmişi ---------- */}
      <Section title={t('profile.credits.title')}>
        {credits.isPending ? <ActivityIndicator /> : <CreditHistory entries={credits.data ?? []} />}
      </Section>

      {/* ---------- hesap ---------- */}
      <Section title={t('profile.account.title')}>
        <Button
          title={t('profile.account.signOut')}
          variant="secondary"
          onPress={() => signOut()}
        />
        <Meta>{t('profile.account.deleteHint')}</Meta>
        {removeAccount.error ? <Small tone="accent">{t('auth.genericError')}</Small> : null}
        <Button
          title={t('profile.account.delete')}
          variant="secondary"
          onPress={confirmDelete}
          loading={removeAccount.isPending}
        />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: {
    textTransform: 'uppercase',
    marginTop: space.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: space.lg,
  },
  stat: {
    // İki sütunlu künye: sayılar alt alta hizalansın.
    minWidth: '45%',
  },
});
