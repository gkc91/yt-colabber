import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useSession } from '@/features/auth/session';
import { useNiches } from '@/features/onboarding/api';
import { LANGUAGES } from '@/features/onboarding/options';
import {
  MAX_EXTRA_LANGUAGES,
  MAX_EXTRA_NICHES,
  reviewScopeQueryKey,
  saveReviewScope,
  toggleWithin,
  useReviewScope,
} from '@/features/profile/reviewScope';
import { t } from '@/i18n';

export default function ProfileScreen() {
  const { session } = useSession();
  const userId = session?.user.id as string;
  const colors = Colors[useColorScheme()];
  const queryClient = useQueryClient();

  const niches = useNiches();
  const scope = useReviewScope(userId);

  // Düzenleme yapılana kadar sunucudaki seçim gösterilir; efektle kopyalamaya gerek yok.
  const [edited, setEdited] = useState<{ niches: number[]; languages: string[] } | null>(null);
  const alsoNicheIds = edited?.niches ?? scope.data?.alsoNicheIds ?? [];
  const alsoLanguages = edited?.languages ?? scope.data?.alsoLanguages ?? [];
  const dirty = edited !== null;

  const save = useMutation({
    mutationFn: () => saveReviewScope(userId, { alsoNicheIds, alsoLanguages }),
    onSuccess: async () => {
      setEdited(null);
      await queryClient.invalidateQueries({ queryKey: reviewScopeQueryKey(userId) });
      await queryClient.invalidateQueries({ queryKey: ['review-task'] });
    },
  });

  if (scope.isPending || niches.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const ownNiche = niches.data?.find((niche) => niche.id === scope.data?.nicheId);
  const ownLanguage = LANGUAGES.find((language) => language.code === scope.data?.language);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.section}>
        <Text style={styles.heading}>{t('profile.yourChannel.title')}</Text>
        <Text style={[styles.body, { color: colors.muted }]}>
          {t('profile.yourChannel.body', {
            niche: ownNiche?.name ?? '—',
            language: ownLanguage?.label ?? scope.data?.language ?? '—',
          })}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>{t('profile.scope.title')}</Text>
        <Text style={[styles.body, { color: colors.muted }]}>{t('profile.scope.body')}</Text>

        <Text style={styles.label}>
          {t('profile.scope.niches', { used: alsoNicheIds.length, max: MAX_EXTRA_NICHES })}
        </Text>
        <View style={styles.chips}>
          {niches.data
            ?.filter((niche) => niche.id !== scope.data?.nicheId)
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
          {t('profile.scope.languages', {
            used: alsoLanguages.length,
            max: MAX_EXTRA_LANGUAGES,
          })}
        </Text>
        <View style={styles.chips}>
          {LANGUAGES.filter((language) => language.code !== scope.data?.language).map(
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

        {save.error ? (
          <Text style={[styles.body, { color: colors.danger }]}>{t('auth.genericError')}</Text>
        ) : null}

        <Button
          title={dirty ? t('profile.scope.save') : t('profile.scope.saved')}
          onPress={() => save.mutate()}
          disabled={!dirty}
          loading={save.isPending}
        />
      </View>

      <Text style={[styles.body, { color: colors.muted }]}>{t('profile.placeholder')}</Text>
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
